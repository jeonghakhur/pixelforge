'use server';

import { db } from '@/lib/db';
import { projects, tokens, histories, components, tokenSources } from '@/lib/db/schema';
import { FigmaClient, extractFileKey, extractNodeId, parseFileStructure, type FigmaPageInfo, type FigmaFileResponse } from '@/lib/figma/api';
import { extractTokens as extractFromNode } from '@/lib/tokens/extractor';
import type { ColorToken, TypographyToken, SpacingToken, RadiusToken, StyleMap } from '@/lib/tokens/extractor';
import { extractFromVariables } from '@/lib/tokens/variables-extractor';
import type { ColorTokenV, SpacingTokenV, RadiusTokenV, TypographyTokenV } from '@/lib/tokens/variables-extractor';
import { getFigmaToken } from '@/lib/config';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { ALL_TOKEN_TYPE_IDS } from '@/lib/tokens/token-types';
export type { TokenType } from '@/lib/tokens/token-types';
import type { TokenType } from '@/lib/tokens/token-types';
const ALL_TYPES = ALL_TOKEN_TYPE_IDS;

export interface ExtractOptions {
  /** 추출할 토큰 타입 (기본: 전체) */
  types?: TokenType[];
  /** 추출할 Figma 노드 ID 목록 (기본: 전체 문서) */
  nodeIds?: string[];
}

export interface ExtractResult {
  error: string | null;
  colors: number;
  typography: number;
  spacing: number;
  radii: number;
  projectId: string | null;
  /** 타입별 토큰 데이터 해시 (변경 감지용) */
  hashes?: Partial<Record<'color' | 'typography' | 'spacing' | 'radius', string>>;
  /** 이전 추출과 동일해서 DB 쓰기를 건너뛴 타입 */
  unchanged?: Partial<Record<'color' | 'typography' | 'spacing' | 'radius', boolean>>;
}

export interface FileStructureResult {
  error: string | null;
  fileName: string;
  pages: FigmaPageInfo[];
  /** URL에서 감지된 특정 프레임 node-id (없으면 null) */
  detectedNodeId: string | null;
  /** DB 캐시에서 반환된 경우 true */
  fromCache: boolean;
}

export interface RecentProject {
  id: string;
  name: string;
  figmaUrl: string | null;
  figmaKey: string | null;
  pagesCache: string | null;
  updatedAt: Date;
  colors: number;
  typography: number;
  spacing: number;
  radius: number;
}

export interface ProjectListItem {
  id: string;
  name: string;
  totalTokens: number;
  updatedAt: Date;
}

function generateId(): string {
  return crypto.randomUUID();
}

// ===========================
// Figma 파일 캐시
// ===========================
function getCachePath(fileKey: string): string {
  const dir = path.join(process.cwd(), '.pixelforge', 'cache');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${fileKey}.json`);
}

/**
 * 버전 체크 후 파일 캐시 반환.
 * - DB에 저장된 버전 == 현재 Figma 버전 → 캐시 파일 사용
 * - 버전이 다르거나 캐시 없음 → API fetch → 캐시 저장 + DB 버전 업데이트
 */
async function loadFileCached(
  client: FigmaClient,
  fileKey: string,
): Promise<FigmaFileResponse> {
  const cachePath = getCachePath(fileKey);

  // DB에서 저장된 버전 조회
  const stored = db.select({ id: projects.id, figmaVersion: projects.figmaVersion })
    .from(projects)
    .where(eq(projects.figmaKey, fileKey))
    .get();

  const storedVersion = stored?.figmaVersion ?? null;

  // 캐시 파일 있고 버전이 일치하면 바로 반환
  if (storedVersion && fs.existsSync(cachePath)) {
    const latestVersion = await client.getFileVersion(fileKey);
    if (latestVersion && latestVersion === storedVersion) {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as FigmaFileResponse;
      return cached;
    }
  }

  // 최신 파일 fetch → 캐시 저장
  const file = await client.getFile(fileKey);
  fs.writeFileSync(cachePath, JSON.stringify(file), 'utf-8');

  // DB 버전 업데이트
  if (stored) {
    db.update(projects)
      .set({ figmaVersion: (file as FigmaFileResponse & { version?: string }).version ?? null })
      .where(eq(projects.id, stored.id))
      .run();
  }

  return file;
}

function buildStyleMap(styles: Record<string, { name: string; styleType: string }>): StyleMap {
  const map: StyleMap = {};
  for (const [id, style] of Object.entries(styles)) {
    map[id] = {
      name: style.name,
      styleType: style.styleType as 'FILL' | 'TEXT' | 'EFFECT' | 'GRID',
    };
  }
  return map;
}

function serializeColorValue(token: ColorToken): string {
  return JSON.stringify({ hex: token.hex, rgba: token.rgba });
}

function serializeTypographyValue(token: TypographyToken): string {
  return JSON.stringify({
    fontFamily: token.fontFamily,
    fontSize: token.fontSize,
    fontWeight: token.fontWeight,
    lineHeight: token.lineHeight,
    letterSpacing: token.letterSpacing,
  });
}

function serializeSpacingValue(token: SpacingToken): string {
  return JSON.stringify({
    paddingTop: token.paddingTop,
    paddingRight: token.paddingRight,
    paddingBottom: token.paddingBottom,
    paddingLeft: token.paddingLeft,
    gap: token.gap,
  });
}

function serializeRadiusValue(token: RadiusToken): string {
  return JSON.stringify({ value: token.value, corners: token.corners });
}

/**
 * 토큰 배열을 이름순 정렬 후 SHA-256 해시로 변환.
 * 이전 추출과 동일한 데이터인지 비교하는 용도.
 */
function computeTokenHash(items: Array<{ name: string; value: string }>): string {
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

// ===========================
// Figma 파일 구조 분석
// ===========================
export async function analyzeFileAction(figmaUrl: string, forceRefresh = false): Promise<FileStructureResult> {
  const figmaToken = getFigmaToken();
  if (!figmaToken) {
    return { error: 'Figma API 토큰이 설정되지 않았습니다.', fileName: '', pages: [], detectedNodeId: null, fromCache: false };
  }

  const fileKey = extractFileKey(figmaUrl);
  if (!fileKey) {
    return { error: '올바른 Figma URL이 아닙니다.', fileName: '', pages: [], detectedNodeId: null, fromCache: false };
  }

  const detectedNodeId = extractNodeId(figmaUrl);

  // node-id가 있으면 해당 노드만 빠르게 조회 (전체 파일 fetch 생략)
  if (detectedNodeId) {
    try {
      const client = new FigmaClient(figmaToken);
      const nodesRes = await client.getNodes(fileKey, [detectedNodeId]);
      const nodeDoc = nodesRes.nodes[detectedNodeId]?.document;

      if (!nodeDoc) {
        return { error: '해당 노드를 찾을 수 없습니다.', fileName: '', pages: [], detectedNodeId, fromCache: false };
      }

      const pages: FigmaPageInfo[] = [{
        id: nodeDoc.id,
        name: nodeDoc.name,
        frames: [{ id: nodeDoc.id, name: nodeDoc.name, type: nodeDoc.type }],
      }];

      return { error: null, fileName: nodesRes.name, pages, detectedNodeId, fromCache: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      return { error: message, fileName: '', pages: [], detectedNodeId, fromCache: false };
    }
  }

  // 캐시 확인 (forceRefresh가 아닌 경우)
  if (!forceRefresh) {
    const cached = db.select().from(projects).where(eq(projects.figmaKey, fileKey)).get();
    if (cached?.pagesCache) {
      try {
        const pages = JSON.parse(cached.pagesCache) as FigmaPageInfo[];
        return { error: null, fileName: cached.name, pages, detectedNodeId, fromCache: true };
      } catch {
        // 캐시 파싱 실패 시 API 재호출
      }
    }
  }

  try {
    const client = new FigmaClient(figmaToken);
    const file = await loadFileCached(client, fileKey);
    const pages = parseFileStructure(file.document);

    // 분석 결과를 DB에 캐시 저장
    const existing = db.select().from(projects).where(eq(projects.figmaKey, fileKey)).get();
    if (existing) {
      db.update(projects)
        .set({ name: file.name, figmaUrl, pagesCache: JSON.stringify(pages), updatedAt: new Date() })
        .where(eq(projects.id, existing.id))
        .run();
    } else {
      db.insert(projects).values({
        id: generateId(),
        name: file.name,
        figmaUrl,
        figmaKey: fileKey,
        pagesCache: JSON.stringify(pages),
      }).run();
    }

    return { error: null, fileName: file.name, pages, detectedNodeId, fromCache: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
    return { error: message, fileName: '', pages: [], detectedNodeId: null, fromCache: false };
  }
}

// ===========================
// 최근 프로젝트 목록 조회
// ===========================
export async function getRecentProjects(): Promise<RecentProject[]> {
  const projectRows = db.select().from(projects).orderBy(desc(projects.updatedAt)).limit(10).all();

  return projectRows.map((row) => {
    const tokenCounts = db
      .select({ type: tokens.type, cnt: sql<number>`count(*)` })
      .from(tokens)
      .where(eq(tokens.projectId, row.id))
      .groupBy(tokens.type)
      .all();

    const cm: Record<string, number> = {};
    for (const { type, cnt } of tokenCounts) { cm[type] = cnt; }

    return {
      id: row.id,
      name: row.name,
      figmaUrl: row.figmaUrl,
      figmaKey: row.figmaKey,
      pagesCache: row.pagesCache ?? null,
      updatedAt: row.updatedAt,
      colors: cm['color'] ?? 0,
      typography: cm['typography'] ?? 0,
      spacing: cm['spacing'] ?? 0,
      radius: cm['radius'] ?? 0,
    };
  });
}

// ===========================
// 사이드바용 프로젝트 목록 (간략)
// ===========================
export async function getProjectList(): Promise<ProjectListItem[]> {
  const projectRows = db.select().from(projects).orderBy(desc(projects.updatedAt)).limit(20).all();

  return projectRows.map((row) => {
    const totalResult = db
      .select({ cnt: sql<number>`count(*)` })
      .from(tokens)
      .where(eq(tokens.projectId, row.id))
      .get();

    return {
      id: row.id,
      name: row.name,
      totalTokens: totalResult?.cnt ?? 0,
      updatedAt: row.updatedAt,
    };
  });
}

// ===========================
// 프로젝트 삭제
// ===========================
export async function deleteProject(id: string): Promise<{ error: string | null }> {
  try {
    db.delete(histories).where(eq(histories.projectId, id)).run();
    db.delete(tokens).where(eq(tokens.projectId, id)).run();
    db.delete(components).where(eq(components.projectId, id)).run();
    db.delete(projects).where(eq(projects.id, id)).run();
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : '삭제에 실패했습니다.';
    return { error: message };
  }
}

// ===========================
// 토큰 추출 (선택적 지원)
// ===========================
export async function extractTokensAction(
  figmaUrl: string,
  options?: ExtractOptions,
): Promise<ExtractResult> {
  const selectedTypes = options?.types ?? ALL_TYPES;

  // URL에 node-id 있으면 해당 노드만, 없으면 전체 문서
  const urlNodeId = extractNodeId(figmaUrl);
  const nodeIds = options?.nodeIds?.length
    ? options.nodeIds
    : urlNodeId ? [urlNodeId] : [];

  const figmaToken = getFigmaToken();
  if (!figmaToken) {
    return { error: 'Figma API 토큰이 설정되지 않았습니다. 설정 페이지에서 토큰을 입력해주세요.', colors: 0, typography: 0, spacing: 0, radii: 0, projectId: null };
  }

  const fileKey = extractFileKey(figmaUrl);
  if (!fileKey) {
    return { error: '올바른 Figma URL이 아닙니다.', colors: 0, typography: 0, spacing: 0, radii: 0, projectId: null };
  }

  try {
    const client = new FigmaClient(figmaToken);

    type ExtSource = 'variables' | 'styles-api' | 'section-scan' | 'node-scan';
    let colors: (ColorToken | ColorTokenV)[];
    let typography: (TypographyToken | TypographyTokenV)[];
    let spacing: (SpacingToken | SpacingTokenV)[];
    let radius: (RadiusToken | RadiusTokenV)[];
    let extractionSource: ExtSource;
    let fileName: string;
    let sourceByType: Partial<Record<'color' | 'typography' | 'spacing' | 'radius', ExtSource>> = {};

    // ── 1. Variables API 우선 시도 (nodeIds 유무와 무관 — 파일 전체 변수 반환)
    const variablesRes = await client.getVariables(fileKey);
    const variablesData = variablesRes ? extractFromVariables(variablesRes) : null;

    if (variablesData?.hasData) {
      const file = await loadFileCached(client, fileKey);
      fileName = file.name;
      colors = variablesData.colors;
      typography = variablesData.typography;
      spacing = variablesData.spacing;
      radius = variablesData.radius;
      extractionSource = 'variables';
    } else if (nodeIds.length > 0) {
      // ── 2. nodeIds 지정 시 해당 노드만 순회 (3-Layer)
      // 전체 파일 대신 getNodes + getStyles 병렬 호출로 불필요한 문서 트리 다운로드 방지
      const [nodesRes, stylesRes] = await Promise.all([
        client.getNodes(fileKey, nodeIds),
        client.getStyles(fileKey),
      ]);
      fileName = nodesRes.name;
      // getStyles 응답을 getFile().styles 형식으로 변환 (키: "S:{key}")
      const rawStyles: Record<string, { name: string; styleType: string }> = {};
      for (const s of stylesRes.meta.styles) {
        rawStyles[`S:${s.key}`] = { name: s.name, styleType: s.style_type };
      }
      const styleMap = buildStyleMap(rawStyles);
      const rootNodes = Object.values(nodesRes.nodes).map((n) => n.document);

      const merged = {
        colors: [] as ColorToken[],
        typography: [] as TypographyToken[],
        spacing: [] as SpacingToken[],
        radius: [] as RadiusToken[],
      };
      // 타입별 source 개별 추적 — 마지막 노드로 덮어쓰기 방지
      for (const node of rootNodes) {
        const { tokens: e, source } = extractFromNode(node, styleMap);
        if (e.colors.length > 0)     { merged.colors.push(...e.colors);         sourceByType['color']      = source; }
        if (e.typography.length > 0) { merged.typography.push(...e.typography); sourceByType['typography'] = source; }
        if (e.spacing.length > 0)    { merged.spacing.push(...e.spacing);       sourceByType['spacing']    = source; }
        if (e.radius.length > 0)     { merged.radius.push(...e.radius);         sourceByType['radius']     = source; }
      }
      colors = merged.colors;
      typography = merged.typography;
      spacing = merged.spacing;
      radius = merged.radius;
      // 전체 대표 source는 가장 많이 쓰인 값으로 (히스토리/스냅샷용)
      const sourceCounts = Object.values(sourceByType).reduce<Record<string, number>>((acc, s) => {
        if (s) acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      }, {});
      extractionSource = (Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as ExtSource) ?? 'node-scan';
    } else {
      // ── 3. 전체 문서 노드 순회 폴백 (3-Layer)
      const file = await loadFileCached(client, fileKey);
      fileName = file.name;
      const styleMap = buildStyleMap(file.styles);
      const { tokens: extracted, source } = extractFromNode(file.document, styleMap);
      colors = extracted.colors;
      typography = extracted.typography;
      spacing = extracted.spacing;
      radius = extracted.radius;
      extractionSource = source;
    }

    // ── 3. 중복 제거 (이름 기준 우선 — Variables API는 이름이 토큰 고유 식별자)
    const dedup = <T>(items: T[], keyFn: (i: T) => string): T[] => {
      const seen = new Set<string>();
      return items.filter((i) => { const k = keyFn(i); if (seen.has(k)) return false; seen.add(k); return true; });
    };
    const finalColors   = dedup(colors,     (c) => c.name);
    const finalTypo     = dedup(typography, (t) => t.name || `${t.fontFamily}-${t.fontSize}-${t.fontWeight}`);
    const finalSpacing  = dedup(spacing,    (s) => s.name || `${s.paddingTop}-${s.paddingRight}-${s.paddingBottom}-${s.paddingLeft}-${s.gap}`);
    const finalRadius   = dedup(radius,     (r) => r.name || String((r as RadiusToken).value));

    // ── 4. 프로젝트 찾기 또는 생성
    const existing = db.select().from(projects).where(eq(projects.figmaKey, fileKey)).get();
    let projectId: string;

    if (existing) {
      projectId = existing.id;
      db.update(projects)
        .set({ updatedAt: new Date(), figmaUrl, name: fileName })
        .where(eq(projects.id, projectId))
        .run();
    } else {
      projectId = generateId();
      db.insert(projects).values({ id: projectId, name: fileName, figmaUrl, figmaKey: fileKey, pagesCache: null }).run();
    }

    // ── 5. 타입별 해시 계산 → 변경 없으면 해당 타입 스킵
    const newHashes: Partial<Record<'color' | 'typography' | 'spacing' | 'radius', string>> = {};
    const unchangedTypes: Partial<Record<'color' | 'typography' | 'spacing' | 'radius', boolean>> = {};

    if (selectedTypes.includes('color')) {
      newHashes['color'] = computeTokenHash(
        finalColors.map((c) => ({ name: c.name, value: serializeColorValue(c as ColorToken) })),
      );
    }
    if (selectedTypes.includes('typography')) {
      newHashes['typography'] = computeTokenHash(
        finalTypo.map((t) => ({ name: t.name || `${t.fontFamily}-${t.fontSize}`, value: serializeTypographyValue(t as TypographyToken) })),
      );
    }
    if (selectedTypes.includes('spacing')) {
      newHashes['spacing'] = computeTokenHash(
        finalSpacing.map((s) => ({ name: s.name || `${s.paddingTop}-${s.gap}`, value: serializeSpacingValue(s as SpacingToken) })),
      );
    }
    if (selectedTypes.includes('radius')) {
      newHashes['radius'] = computeTokenHash(
        finalRadius.map((r) => ({ name: r.name || String((r as RadiusToken).value), value: serializeRadiusValue(r as RadiusToken) })),
      );
    }

    // 기존 저장된 해시와 비교
    for (const type of selectedTypes as Array<'color' | 'typography' | 'spacing' | 'radius'>) {
      if (!newHashes[type]) continue;
      const stored = db.select({ contentHash: tokenSources.contentHash })
        .from(tokenSources)
        .where(and(eq(tokenSources.projectId, projectId), eq(tokenSources.type, type)))
        .get();
      if (stored?.contentHash && stored.contentHash === newHashes[type]) {
        unchangedTypes[type] = true;
      }
    }

    // 변경된 타입만 DELETE + INSERT (unchanged 타입은 보존)
    const changedTypes = selectedTypes.filter(
      (t) => !unchangedTypes[t as keyof typeof unchangedTypes],
    );

    const isAllTypes = selectedTypes.length === ALL_TYPES.length &&
      ALL_TYPES.every((t) => selectedTypes.includes(t));

    if (changedTypes.length > 0) {
      if (isAllTypes && changedTypes.length === ALL_TYPES.length) {
        db.delete(tokens).where(eq(tokens.projectId, projectId)).run();
      } else {
        db.delete(tokens).where(
          and(eq(tokens.projectId, projectId), inArray(tokens.type, changedTypes))
        ).run();
      }
    }

    const version = 1;

    if (changedTypes.includes('color')) {
      const colorSource = sourceByType?.['color'] ?? extractionSource;
      for (const color of finalColors) {
        const c = color as ColorToken & Partial<ColorTokenV>;
        db.insert(tokens).values({
          id: generateId(), projectId, version, type: 'color',
          name: c.name, value: serializeColorValue(c), raw: c.hex,
          source: colorSource,
          mode: c.mode ?? null,
          collectionName: c.collectionName ?? null,
          alias: c.alias ?? null,
        }).run();
      }
    }
    if (changedTypes.includes('typography')) {
      const typoSource = sourceByType?.['typography'] ?? extractionSource;
      for (const typo of finalTypo) {
        const t = typo as TypographyToken & Partial<TypographyTokenV>;
        db.insert(tokens).values({
          id: generateId(), projectId, version, type: 'typography',
          name: t.name, value: serializeTypographyValue(t), raw: `${t.fontFamily} ${t.fontSize}px`,
          source: typoSource,
          mode: t.mode ?? null,
          collectionName: t.collectionName ?? null,
          alias: t.alias ?? null,
        }).run();
      }
    }
    if (changedTypes.includes('spacing')) {
      const spacingSource = sourceByType?.['spacing'] ?? extractionSource;
      for (const sp of finalSpacing) {
        const s = sp as SpacingToken & Partial<SpacingTokenV>;
        db.insert(tokens).values({
          id: generateId(), projectId, version, type: 'spacing',
          name: s.name, value: serializeSpacingValue(s),
          raw: `${s.paddingTop ?? 0}/${s.paddingRight ?? 0}/${s.paddingBottom ?? 0}/${s.paddingLeft ?? 0} gap:${s.gap ?? 0}`,
          source: spacingSource,
          mode: s.mode ?? null,
          collectionName: s.collectionName ?? null,
          alias: s.alias ?? null,
        }).run();
      }
    }
    if (changedTypes.includes('radius')) {
      const radiusSource = sourceByType?.['radius'] ?? extractionSource;
      for (const rad of finalRadius) {
        const r = rad as RadiusToken & Partial<RadiusTokenV>;
        db.insert(tokens).values({
          id: generateId(), projectId, version, type: 'radius',
          name: r.name, value: serializeRadiusValue(r), raw: `${r.value}px`,
          source: radiusSource,
          mode: r.mode ?? null,
          collectionName: r.collectionName ?? null,
          alias: r.alias ?? null,
        }).run();
      }
    }

    const scopeLabel = nodeIds.length > 0 ? `${nodeIds.length}개 프레임` : '전체 문서';
    const SOURCE_LABELS: Record<string, string> = {
      variables: 'Variables API', 'styles-api': 'Named Styles',
      'section-scan': '섹션 스캔', 'node-scan': '노드 스캔',
    };
    const sourceLabel = SOURCE_LABELS[extractionSource] ?? '노드 스캔';

    db.insert(histories).values({
      id: generateId(),
      projectId,
      action: 'extract_tokens',
      summary: `[${scopeLabel} / ${sourceLabel}] ${fileName}에서 토큰 추출: 색상 ${finalColors.length}개, 타이포 ${finalTypo.length}개, 간격 ${finalSpacing.length}개, 반경 ${finalRadius.length}개`,
      metadata: JSON.stringify({
        colors: finalColors.length, typography: finalTypo.length,
        spacing: finalSpacing.length, radius: finalRadius.length,
        source: extractionSource, nodeIds,
      }),
    }).run();

    // tokens.css git auto-commit (변경이 있을 때 항상)
    const hasChanges = finalColors.length > 0 || finalTypo.length > 0
      || finalSpacing.length > 0 || finalRadius.length > 0;

    if (hasChanges) {
      const { getAllTokensForProject } = await import('@/lib/db/queries');
      const { generateAllCssCode } = await import('@/lib/tokens/css-generator');
      const { commitTokensCss, buildCommitMessage } = await import('@/lib/git/token-commits');

      const allTokens = getAllTokensForProject(projectId);
      const css = generateAllCssCode(allTokens);
      const message = buildCommitMessage({
        colors: finalColors.length,
        typography: finalTypo.length,
        spacing: finalSpacing.length,
        radii: finalRadius.length,
      });
      commitTokensCss(css, message); // 에러 무시 — 추출 성공을 막지 않음
    }

    return {
      error: null,
      colors: selectedTypes.includes('color') ? finalColors.length : 0,
      typography: selectedTypes.includes('typography') ? finalTypo.length : 0,
      spacing: selectedTypes.includes('spacing') ? finalSpacing.length : 0,
      radii: selectedTypes.includes('radius') ? finalRadius.length : 0,
      projectId,
      hashes: newHashes,
      unchanged: unchangedTypes,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
    return { error: message, colors: 0, typography: 0, spacing: 0, radii: 0, projectId: null };
  }
}
