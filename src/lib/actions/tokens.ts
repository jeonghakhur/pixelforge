'use server';

import { db } from '@/lib/db';
import { tokens, projects, histories, tokenSources, appSettings, tokenSnapshots, tokenTypeConfigs } from '@/lib/db/schema';
import { eq, desc, sql, and, lt } from 'drizzle-orm';
import { getActiveProjectId } from '@/lib/db/active-project';
import { extractFileKey, extractNodeId, FigmaClient, type FigmaVariablesResponse } from '@/lib/figma/api';
import { extractTokensAction } from '@/lib/actions/project';
import { getFigmaToken } from '@/lib/config';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { generateTokensCss } from '@/lib/tokens/css-exporter';
function deleteTokensCss() {
  try { fs.unlinkSync(path.join(process.cwd(), 'design-tokens', 'tokens.css')); } catch { /* 없으면 무시 */ }
}

// ─────────────────────────────────────────────────────────
// 활성 프로젝트 관리 (단일 프로젝트 원칙)
// ─────────────────────────────────────────────────────────

/** 활성 프로젝트 전체 레코드 반환 (active-project 헬퍼 기반). */
function getActiveProject() {
  const id = getActiveProjectId();
  if (!id) return undefined;
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

/** 플러그인 sync 또는 JSON 임포트 후 활성 프로젝트를 명시적으로 설정. */
export async function setActiveProject(projectId: string): Promise<void> {
  const existing = db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, 'active_project_id'))
    .get();

  if (existing) {
    db.update(appSettings)
      .set({ value: projectId })
      .where(eq(appSettings.key, 'active_project_id'))
      .run();
  } else {
    db.insert(appSettings).values({ key: 'active_project_id', value: projectId }).run();
  }
}

export interface TokenRow {
  id: string;
  name: string;
  type: string;
  value: string;
  raw: string | null;
  source: 'variables' | 'styles-api' | 'section-scan' | 'node-scan' | null;
  mode: string | null;
  collectionName: string | null;
  alias: string | null;
  sortOrder: number;
}

export async function getTokensByType(type: string): Promise<TokenRow[]> {
  const project = getActiveProject();
  if (!project) return [];
  return db.select({
    id: tokens.id,
    name: tokens.name,
    type: tokens.type,
    value: tokens.value,
    raw: tokens.raw,
    source: tokens.source,
    mode: tokens.mode,
    collectionName: tokens.collectionName,
    alias: tokens.alias,
    sortOrder: tokens.sortOrder,
  })
    .from(tokens)
    .where(and(eq(tokens.projectId, project.id), eq(tokens.type, type)))
    .orderBy(tokens.sortOrder)
    .all();
}

export async function getAllTokensAction(): Promise<TokenRow[]> {
  const project = getActiveProject();
  if (!project) return [];
  return db.select({
    id: tokens.id,
    name: tokens.name,
    type: tokens.type,
    value: tokens.value,
    raw: tokens.raw,
    source: tokens.source,
    mode: tokens.mode,
    collectionName: tokens.collectionName,
    alias: tokens.alias,
    sortOrder: tokens.sortOrder,
  })
    .from(tokens)
    .where(eq(tokens.projectId, project.id))
    .all();
}

export interface TokenSummary {
  /** type id → count (e.g. "color" → 42) */
  counts: Record<string, number>;
  lastExtracted: string | null;
}

export async function getTokenSummary(): Promise<TokenSummary> {
  const project = getActiveProject();
  const counts = project
    ? db.select({
        type: tokens.type,
        count: sql<number>`count(*)`,
      })
        .from(tokens)
        .where(eq(tokens.projectId, project.id))
        .groupBy(tokens.type)
        .all()
    : [];

  const countMap: Record<string, number> = {};
  for (const row of counts) {
    countMap[row.type] = row.count;
  }

  const lastHistory = db.select({
    createdAt: histories.createdAt,
  })
    .from(histories)
    .where(eq(histories.action, 'extract_tokens'))
    .orderBy(desc(histories.createdAt))
    .limit(1)
    .get();

  let lastExtracted: string | null = null;
  if (lastHistory?.createdAt) {
    const d = lastHistory.createdAt;
    lastExtracted = d instanceof Date ? d.toISOString() : new Date(d as number * 1000).toISOString();
  }

  return { counts: countMap, lastExtracted };
}

export interface HistoryEntry {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
}

export async function getRecentHistoriesAction(limit = 8): Promise<HistoryEntry[]> {
  const rows = db
    .select({
      id: histories.id,
      action: histories.action,
      summary: histories.summary,
      createdAt: histories.createdAt,
    })
    .from(histories)
    .orderBy(desc(histories.createdAt))
    .limit(limit)
    .all();

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    summary: r.summary,
    createdAt: r.createdAt instanceof Date
      ? r.createdAt.toISOString()
      : new Date((r.createdAt as number) * 1000).toISOString(),
  }));
}

// ===========================
// 토큰 수정 / 삭제
// ===========================
export async function deleteTokenAction(id: string): Promise<{ error: string | null }> {
  try {
    db.delete(tokens).where(eq(tokens.id, id)).run();

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '삭제 실패' };
  }
}

export async function deleteAllTokensAction(): Promise<{ error: string | null; deleted: number }> {
  try {
    const count = db.select({ count: sql<number>`count(*)` }).from(tokens).get()?.count ?? 0;
    db.delete(tokenSnapshots).run();
    db.delete(tokenSources).run();
    db.delete(tokenTypeConfigs).run();
    db.delete(histories).run();
    db.delete(tokens).run();
    deleteTokensCss();
    return { error: null, deleted: count };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '삭제 실패', deleted: 0 };
  }
}

export async function deleteTokensByTypeAction(
  type: string,
): Promise<{ error: string | null; deleted: number }> {
  try {
    const project = getActiveProject();
    if (!project) return { error: null, deleted: 0 };

    const rows = db.select({ id: tokens.id }).from(tokens)
      .where(and(eq(tokens.projectId, project.id), eq(tokens.type, type))).all();

    // token_sources 삭제
    db.delete(tokenSources).where(
      and(eq(tokenSources.projectId, project.id), eq(tokenSources.type, type)),
    ).run();

    db.delete(tokens).where(and(eq(tokens.projectId, project.id), eq(tokens.type, type))).run();

    return { error: null, deleted: rows.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '삭제 실패', deleted: 0 };
  }
}

export async function updateTokenValueAction(
  id: string,
  value: string,
  raw?: string,
): Promise<{ error: string | null }> {
  try {
    // JSON 유효성 검증
    JSON.parse(value);
    db.update(tokens)
      .set({ value, ...(raw !== undefined ? { raw } : {}) })
      .where(eq(tokens.id, id))
      .run();
    return { error: null };
  } catch {
    return { error: '올바르지 않은 값입니다.' };
  }
}

// ===========================
// CSS Export
// ===========================
export interface CssExportResult {
  error: string | null;
  css: string | null;
  tokenCount: number;
}

export async function exportTokensCssAction(): Promise<CssExportResult> {
  const allTokens = db.select().from(tokens).all();

  if (allTokens.length === 0) {
    return { error: '내보낼 토큰이 없습니다.', css: null, tokenCount: 0 };
  }

  const project = getActiveProject();
  const css = generateTokensCss(allTokens as TokenRow[], {
    fileName: project?.name ?? 'Design Tokens',
    extractedAt: new Date().toISOString(),
  });

  return { error: null, css, tokenCount: allTokens.length };
}

export async function getProjectInfo(): Promise<{ name: string; figmaUrl: string } | null> {
  const project = getActiveProject();
  if (!project || !project.figmaUrl) return null;
  return { name: project.name, figmaUrl: project.figmaUrl };
}

// ===========================
// 타입별 토큰 소스 (token_sources)
// ===========================

export interface TokenSource {
  type: string;
  figmaUrl: string;
  figmaKey: string;
  lastExtractedAt: Date | null;
  tokenCount: number;
  uiScreenshot: string | null;
  figmaScreenshot: string | null;
}

export async function getTokenSourceAction(type: string): Promise<TokenSource | null> {
  const project = getActiveProject();
  if (!project) return null;

  const row = db.select()
    .from(tokenSources)
    .where(and(eq(tokenSources.projectId, project.id), eq(tokenSources.type, type)))
    .get();

  if (!row) return null;

  return {
    type: row.type,
    figmaUrl: row.figmaUrl,
    figmaKey: row.figmaKey,
    lastExtractedAt: row.lastExtractedAt,
    tokenCount: row.tokenCount,
    uiScreenshot: row.uiScreenshot,
    figmaScreenshot: row.figmaScreenshot,
  };
}

export interface TokenDiff {
  added: number;
  changed: number;
  removed: number;
}

export interface ExtractByTypeResult {
  error: string | null;
  count: number;
  type: string;
  screenshotPath: string | null;
  /** true면 Figma 데이터가 이전과 동일해 DB 쓰기/스크린샷을 건너뜀 */
  unchanged?: boolean;
  /** 이전 대비 변경 요약 (unchanged가 아닐 때만 존재) */
  diff?: TokenDiff;
}

function computeTokenDiff(
  before: { name: string; raw: string | null; value: string }[],
  after:  { name: string; raw: string | null; value: string }[],
): TokenDiff {
  const beforeMap = new Map(before.map((t) => [t.name, t.raw ?? t.value]));
  const afterMap  = new Map(after.map((t) => [t.name, t.raw ?? t.value]));
  let added = 0, changed = 0, removed = 0;
  for (const [name, val] of afterMap) {
    if (!beforeMap.has(name)) added++;
    else if (beforeMap.get(name) !== val) changed++;
  }
  for (const name of beforeMap.keys()) {
    if (!afterMap.has(name)) removed++;
  }
  return { added, changed, removed };
}

export async function extractTokensByTypeAction(
  type: string,
  figmaUrl: string,
): Promise<ExtractByTypeResult> {
  const fileKey = extractFileKey(figmaUrl);
  if (!fileKey) {
    return { error: '올바른 Figma URL이 아닙니다.', count: 0, type, screenshotPath: null };
  }

  // 추출 전 기존 토큰 스냅샷 (diff 계산용)
  const beforeProject = getActiveProject();
  const beforeTokens = beforeProject
    ? db.select({ name: tokens.name, value: tokens.value, raw: tokens.raw })
        .from(tokens)
        .where(and(eq(tokens.projectId, beforeProject.id), eq(tokens.type, type)))
        .all()
    : [];

  // 해당 타입만 추출
  const result = await extractTokensAction(figmaUrl, { types: [type] });
  if (result.error) {
    return { error: result.error, count: 0, type, screenshotPath: null };
  }

  const projectId = result.projectId;
  if (!projectId) {
    return { error: '프로젝트를 찾을 수 없습니다.', count: 0, type, screenshotPath: null };
  }

  // 추출된 토큰 수 계산
  const countMap: Record<string, number> = {
    color: result.colors,
    typography: result.typography,
    spacing: result.spacing,
    radius: result.radii,
  };
  const count = countMap[type] ?? 0;
  const isUnchanged = result.unchanged?.[type as 'color' | 'typography' | 'spacing' | 'radius'] === true;
  const newHash = result.hashes?.[type as 'color' | 'typography' | 'spacing' | 'radius'];

  // token_sources upsert
  const sourceId = crypto.randomUUID();
  const existing = db.select({ id: tokenSources.id })
    .from(tokenSources)
    .where(and(eq(tokenSources.projectId, projectId), eq(tokenSources.type, type)))
    .get();

  if (existing) {
    db.update(tokenSources)
      .set({
        figmaUrl,
        figmaKey: fileKey,
        lastExtractedAt: new Date(),
        tokenCount: count,
        ...(newHash ? { contentHash: newHash } : {}),
        updatedAt: new Date(),
      })
      .where(eq(tokenSources.id, existing.id))
      .run();
  } else {
    db.insert(tokenSources).values({
      id: sourceId,
      projectId,
      type,
      figmaUrl,
      figmaKey: fileKey,
      lastExtractedAt: new Date(),
      tokenCount: count,
      ...(newHash ? { contentHash: newHash } : {}),
    }).run();
  }

  // 추출 후 토큰 가져와서 diff 계산
  const afterTokens = db.select({ name: tokens.name, value: tokens.value, raw: tokens.raw })
    .from(tokens)
    .where(and(eq(tokens.projectId, projectId), eq(tokens.type, type)))
    .all();
  const diff = computeTokenDiff(beforeTokens, afterTokens);

  // 변경 없으면 스크린샷 스킵
  if (isUnchanged) {
    const src = db.select({ uiScreenshot: tokenSources.uiScreenshot, figmaScreenshot: tokenSources.figmaScreenshot })
      .from(tokenSources)
      .where(and(eq(tokenSources.projectId, projectId), eq(tokenSources.type, type)))
      .get();
    return {
      error: null,
      count,
      type,
      unchanged: true,
      screenshotPath: src?.uiScreenshot ?? null,
    };
  }

  // PixelForge UI 스크린샷 + Figma 원본 동시 캡처 (non-blocking)
  let screenshotPath: string | null = null;
  let figmaScreenshotPath: string | null = null;
  try {
    const nodeId = extractNodeId(figmaUrl);
    const [capResult, figmaCapResult] = await Promise.allSettled([
      captureTokenPageScreenshotAction(type),
      captureFigmaFrameAction(type, fileKey, nodeId),
    ]);

    if (capResult.status === 'fulfilled') screenshotPath = capResult.value.screenshotPath;
    if (figmaCapResult.status === 'fulfilled') figmaScreenshotPath = figmaCapResult.value.screenshotPath;

    if (screenshotPath || figmaScreenshotPath) {
      const src = db.select({ id: tokenSources.id })
        .from(tokenSources)
        .where(and(eq(tokenSources.projectId, projectId), eq(tokenSources.type, type)))
        .get();
      if (src) {
        db.update(tokenSources)
          .set({
            ...(screenshotPath ? { uiScreenshot: screenshotPath } : {}),
            ...(figmaScreenshotPath ? { figmaScreenshot: figmaScreenshotPath } : {}),
            updatedAt: new Date(),
          })
          .where(eq(tokenSources.id, src.id))
          .run();
      }
    }
  } catch {
    // 캡처 실패는 무시
  }

  return { error: null, count, type, screenshotPath, diff };
}

// ===========================
// 스크린샷 삭제
// ===========================

export async function deleteTokenScreenshotsAction(
  type: string,
): Promise<{ error: string | null }> {
  const project = getActiveProject();
  if (!project) return { error: '프로젝트를 찾을 수 없습니다.' };

  const source = db.select({
    id: tokenSources.id,
    uiScreenshot: tokenSources.uiScreenshot,
    figmaScreenshot: tokenSources.figmaScreenshot,
  })
    .from(tokenSources)
    .where(and(eq(tokenSources.projectId, project.id), eq(tokenSources.type, type)))
    .get();

  if (!source) return { error: null };

  // 파일 삭제
  for (const p of [source.uiScreenshot, source.figmaScreenshot]) {
    if (p) {
      try { fs.unlinkSync(path.join(process.cwd(), 'public', p)); } catch { /* 무시 */ }
    }
  }

  // DB 초기화
  db.update(tokenSources)
    .set({ uiScreenshot: null, figmaScreenshot: null, updatedAt: new Date() })
    .where(eq(tokenSources.id, source.id))
    .run();

  return { error: null };
}

// ===========================
// 토큰 검증 (Figma vs DB 이름/개수 비교)
// ===========================

export interface VerifyTokensResult {
  error: string | null;
  type: string;
  figmaCount: number;
  dbCount: number;
  countMatched: boolean;
  matchedCount: number;
  missingInDb: string[];   // Figma에 있는데 DB에 없는 이름
  extraInDb: string[];     // DB에 있는데 Figma에 없는 이름
}

/**
 * Figma Variables API에서 지정 타입의 변수 이름 목록 추출
 * - color: resolvedType === 'COLOR'
 * - spacing/radius/typography: resolvedType === 'FLOAT' + inferFloatTokenType
 */
function getFigmaNamesForType(
  response: FigmaVariablesResponse,
  type: string,
): string[] {
  const { variableCollections, variables } = response.meta;
  const nameSet = new Set<string>();

  for (const collection of Object.values(variableCollections)) {
    for (const varId of collection.variableIds) {
      const variable = variables[varId];
      if (!variable || variable.hiddenFromPublishing) continue;

      // 첫 모드 값만 확인 (이름 검증 목적)
      const firstMode = collection.modes[0];
      if (!firstMode) continue;
      const rawValue = variable.valuesByMode[firstMode.modeId];
      if (rawValue === undefined) continue;

      // alias 스킵
      if (typeof rawValue === 'object' && rawValue !== null && (rawValue as { type?: string }).type === 'VARIABLE_ALIAS') continue;

      if (type === 'color' && variable.resolvedType === 'COLOR') {
        nameSet.add(variable.name);
      } else if (variable.resolvedType === 'FLOAT') {
        const inferred = inferFloatTokenType(variable.name, variable.scopes ?? []);
        if (inferred === type) {
          nameSet.add(variable.name);
        }
      }
    }
  }

  return Array.from(nameSet);
}

function inferFloatTokenType(
  name: string,
  scopes: string[],
): 'spacing' | 'radius' | 'typography' | null {
  if (scopes.includes('GAP') || scopes.includes('WIDTH_HEIGHT')) return 'spacing';
  if (scopes.includes('CORNER_RADIUS')) return 'radius';
  if (scopes.includes('FONT_SIZE') || scopes.includes('LINE_HEIGHT') || scopes.includes('LETTER_SPACING')) return 'typography';

  const lower = name.toLowerCase();
  if (/spacing|gap|padding|margin/.test(lower)) return 'spacing';
  if (/radius|corner|rounded/.test(lower)) return 'radius';
  if (/font.?size|font.?weight|line.?height|letter.?spacing/.test(lower)) return 'typography';

  return null;
}

export async function verifyTokensAction(type: string): Promise<VerifyTokensResult> {
  const blank: VerifyTokensResult = {
    error: null, type, figmaCount: 0, dbCount: 0,
    countMatched: false, matchedCount: 0, missingInDb: [], extraInDb: [],
  };

  // token_sources에서 figmaKey 조회
  const project = getActiveProject();
  if (!project) return { ...blank, error: '프로젝트를 찾을 수 없습니다.' };

  const source = db.select({ figmaKey: tokenSources.figmaKey })
    .from(tokenSources)
    .where(and(eq(tokenSources.projectId, project.id), eq(tokenSources.type, type)))
    .get();

  if (!source) return { ...blank, error: '토큰 소스 정보가 없습니다. 먼저 토큰을 추출해주세요.' };

  const figmaToken = getFigmaToken();
  if (!figmaToken) return { ...blank, error: 'Figma API 토큰이 설정되지 않았습니다.' };

  // Figma Variables API 호출
  let figmaNames: string[];
  try {
    const client = new FigmaClient(figmaToken);
    const variablesRes = await client.getVariables(source.figmaKey);
    if (!variablesRes) {
      return { ...blank, error: 'Figma Variables API에 접근할 수 없습니다. (403/404) 파일 권한을 확인해주세요.' };
    }
    figmaNames = getFigmaNamesForType(variablesRes, type);
  } catch (err) {
    return { ...blank, error: err instanceof Error ? err.message : 'Figma API 호출 실패' };
  }

  // DB 토큰 이름 목록
  const dbRows = db.select({ name: tokens.name }).from(tokens).where(eq(tokens.type, type)).all();
  const dbNames = dbRows.map((r) => r.name);

  const figmaSet = new Set(figmaNames);
  const dbSet = new Set(dbNames);

  const missingInDb = figmaNames.filter((n) => !dbSet.has(n));
  const extraInDb = dbNames.filter((n) => !figmaSet.has(n));
  const matchedCount = figmaNames.filter((n) => dbSet.has(n)).length;

  return {
    error: null,
    type,
    figmaCount: figmaNames.length,
    dbCount: dbNames.length,
    countMatched: figmaNames.length === dbNames.length,
    matchedCount,
    missingInDb,
    extraInDb,
  };
}

// ===========================
// Figma 원본 프레임 캡처
// ===========================

export async function captureFigmaFrameAction(
  type: string,
  fileKey: string,
  nodeId: string | null,
): Promise<{ error: string | null; screenshotPath: string | null }> {
  try {
    const figmaToken = getFigmaToken();
    if (!figmaToken) {
      return { error: 'Figma API 토큰이 설정되지 않았습니다.', screenshotPath: null };
    }

    const client = new FigmaClient(figmaToken);

    // nodeId 없으면 파일의 첫 페이지 첫 프레임 자동 선택
    let targetNodeId = nodeId;
    if (!targetNodeId) {
      const file = await client.getFile(fileKey);
      const firstPage = file.document.children?.[0];
      const firstFrame = firstPage?.children?.find((n) =>
        ['FRAME', 'COMPONENT', 'SECTION', 'GROUP'].includes(n.type),
      );
      if (firstFrame) targetNodeId = firstFrame.id;
    }

    if (!targetNodeId) {
      return {
        error: '캡처할 프레임을 찾을 수 없습니다. Figma URL에 node-id를 포함해주세요.',
        screenshotPath: null,
      };
    }

    const result = await client.getImages(fileKey, [targetNodeId], 'png', 2);
    const imageUrl = result.images[targetNodeId];
    if (!imageUrl) {
      return { error: 'Figma에서 이미지 URL을 받지 못했습니다.', screenshotPath: null };
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`이미지 다운로드 실패: ${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const outputDir = path.join(process.cwd(), 'public', 'token-screenshots');
    fs.mkdirSync(outputDir, { recursive: true });

    const fileName = `${type}-figma.png`;
    fs.writeFileSync(path.join(outputDir, fileName), buffer);

    return { error: null, screenshotPath: `/token-screenshots/${fileName}` };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Figma 프레임 캡처 실패',
      screenshotPath: null,
    };
  }
}

export async function captureTokenPageScreenshotAction(
  type: string,
): Promise<{ error: string | null; screenshotPath: string | null }> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const targetUrl = `${baseUrl}/tokens/${type}`;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { chromium } = require('playwright') as typeof import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

    // 토큰 그리드 렌더 대기
    const tokenGrid = page.locator('[data-token-grid]');
    try {
      await tokenGrid.waitFor({ timeout: 10000 });
    } catch {
      // 토큰 없는 상태(EmptyState)도 캡처
    }

    const outputDir = path.join(process.cwd(), 'public', 'token-screenshots');
    fs.mkdirSync(outputDir, { recursive: true });

    const fileName = `${type}.png`;
    const filePath = path.join(outputDir, fileName);

    // 토큰 그리드 요소만 캡처 — 없으면 전체 페이지 fallback
    const gridEl = await tokenGrid.elementHandle();
    if (gridEl) {
      // 요소의 전체 scrollHeight/scrollWidth를 구해 뷰포트를 맞춤 → 잘림 방지
      const fullHeight = await tokenGrid.evaluate((el) => el.scrollHeight);
      const fullWidth  = await tokenGrid.evaluate((el) => el.scrollWidth);
      await page.setViewportSize({
        width:  Math.max(1440, fullWidth),
        height: Math.max(900,  fullHeight + 100), // 여백 100px
      });
      await page.waitForTimeout(300); // 리플로우 대기
      await gridEl.screenshot({ path: filePath });
    } else {
      await page.screenshot({ path: filePath, fullPage: true });
    }
    await browser.close();

    return { error: null, screenshotPath: `/token-screenshots/${fileName}` };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : '스크린샷 캡처 실패',
      screenshotPath: null,
    };
  }
}

// ─────────────────────────────────────────────────────────
// 스냅샷 롤백
// ─────────────────────────────────────────────────────────

export interface SnapshotInfo {
  id: string;
  version: number;
  source: string;
  tokenCounts: Record<string, number>;
  total: number;
  createdAt: Date;
  diffCounts: { added: number; removed: number; changed: number };
}

export async function getSnapshotListAction(projectId: string): Promise<SnapshotInfo[]> {
  const rows = await db
    .select()
    .from(tokenSnapshots)
    .where(eq(tokenSnapshots.projectId, projectId))
    .orderBy(desc(tokenSnapshots.version))
    .all();

  return rows.map((r) => {
    let counts: Record<string, number> = {};
    try { counts = JSON.parse(r.tokenCounts) as Record<string, number>; } catch {}
    const total = counts.total ?? (Object.values(counts) as number[]).reduce((a, b) => a + b, 0);

    let diffCounts = { added: 0, removed: 0, changed: 0 };
    try {
      const parsed = JSON.parse(r.diffSummary ?? '{}') as Record<string, unknown>;
      if (Array.isArray(parsed.added)) {
        diffCounts = {
          added:   (parsed.added as unknown[]).length,
          removed: (parsed.removed as unknown[]).length,
          changed: (parsed.changed as unknown[]).length,
        };
      } else {
        diffCounts = {
          added:   (parsed.added as number) ?? 0,
          removed: (parsed.removed as number) ?? 0,
          changed: (parsed.changed as number) ?? 0,
        };
      }
    } catch {}

    return {
      id: r.id,
      version: r.version,
      source: r.source,
      tokenCounts: counts,
      total,
      createdAt: r.createdAt!,
      diffCounts,
    };
  });
}

// ── 스냅샷 상세 (토큰 변경 목록) ─────────────────────────

export interface SnapshotDiffEntry {
  name: string;
  type: string;
  oldRaw?: string | null;
  newRaw?: string | null;
}

export interface SnapshotDetail {
  id: string;
  version: number;
  source: string;
  createdAt: string;
  tokenCounts: Record<string, number>;
  diff: {
    added: SnapshotDiffEntry[];
    removed: SnapshotDiffEntry[];
    changed: SnapshotDiffEntry[];
  };
}

export async function getSnapshotDetailAction(
  snapshotId: string,
): Promise<{ error: string | null; detail: SnapshotDetail | null }> {
  const row = await db
    .select()
    .from(tokenSnapshots)
    .where(eq(tokenSnapshots.id, snapshotId))
    .get();

  if (!row) return { error: '스냅샷을 찾을 수 없습니다.', detail: null };

  let diff: SnapshotDetail['diff'] = { added: [], removed: [], changed: [] };

  try {
    const parsed = JSON.parse(row.diffSummary ?? '{}') as Record<string, unknown>;

    if (Array.isArray(parsed.added)) {
      // 신규 형식 — 목록 그대로 사용
      diff = {
        added:   (parsed.added   as SnapshotDiffEntry[]),
        removed: (parsed.removed as SnapshotDiffEntry[]),
        changed: (parsed.changed as SnapshotDiffEntry[]),
      };
    } else {
      // 구형식(숫자만) — tokensData 비교로 on-demand 계산
      const prevRow = await db
        .select({ tokensData: tokenSnapshots.tokensData })
        .from(tokenSnapshots)
        .where(
          and(
            eq(tokenSnapshots.projectId, row.projectId),
            lt(tokenSnapshots.version, row.version),
          ),
        )
        .orderBy(desc(tokenSnapshots.version))
        .limit(1)
        .get();

      const { computeSnapshotDiff } = await import('@/lib/tokens/snapshot-engine');
      type SnapshotItem = { type: string; name: string; value: string; raw?: string | null };
      const prevItems: SnapshotItem[] = prevRow?.tokensData
        ? (JSON.parse(prevRow.tokensData) as SnapshotItem[])
        : [];
      const currItems: SnapshotItem[] = JSON.parse(row.tokensData) as SnapshotItem[];
      const computed = computeSnapshotDiff(
        prevItems as Parameters<typeof computeSnapshotDiff>[0],
        currItems as Parameters<typeof computeSnapshotDiff>[1],
      );

      diff = {
        added:   computed.added.map((t)   => ({ name: t.name, type: t.type })),
        removed: computed.removed.map((t) => ({ name: t.name, type: t.type })),
        changed: computed.changed.map((t) => ({ name: t.name, type: t.type, oldRaw: t.oldRaw ?? null, newRaw: t.newRaw ?? null })),
      };
    }
  } catch {}

  let tokenCounts: Record<string, number> = {};
  try { tokenCounts = JSON.parse(row.tokenCounts) as Record<string, number>; } catch {}

  return {
    error: null,
    detail: {
      id: row.id,
      version: row.version,
      source: row.source,
      createdAt: row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date((row.createdAt as number) * 1000).toISOString(),
      tokenCounts,
      diff,
    },
  };
}

export async function rollbackSnapshotAction(
  snapshotId: string,
): Promise<{ error: string | null; restoredVersion: number | null }> {
  // 1. 삭제할 스냅샷 조회
  const target = await db
    .select()
    .from(tokenSnapshots)
    .where(eq(tokenSnapshots.id, snapshotId))
    .get();

  if (!target) return { error: '스냅샷을 찾을 수 없습니다.', restoredVersion: null };

  const { projectId, source } = target;

  // 2. 스냅샷 삭제
  await db.delete(tokenSnapshots).where(eq(tokenSnapshots.id, snapshotId));

  // 3. 이전 스냅샷(새로운 최신) 조회
  const prev = await db
    .select()
    .from(tokenSnapshots)
    .where(eq(tokenSnapshots.projectId, projectId))
    .orderBy(desc(tokenSnapshots.version))
    .limit(1)
    .get();

  // 4. 프로젝트 토큰 전체 삭제 후 이전 스냅샷 데이터로 완전 복원
  type SnapshotItem = { type: string; name: string; value: string; raw?: string | null; mode?: string | null; collectionName?: string | null; alias?: string | null };

  await db.delete(tokens).where(eq(tokens.projectId, projectId));

  if (prev?.tokensData) {
    let prevItems: SnapshotItem[] = [];
    try { prevItems = JSON.parse(prev.tokensData) as SnapshotItem[]; } catch {}

    if (prevItems.length > 0) {
      await db.insert(tokens).values(
        prevItems.map((t) => ({
          id: crypto.randomUUID(),
          projectId,
          source: source as 'variables' | 'styles-api' | 'section-scan' | 'node-scan',
          type: t.type,
          name: t.name,
          value: t.value,
          raw: t.raw ?? null,
          mode: t.mode ?? null,
          collectionName: t.collectionName ?? null,
          alias: t.alias ?? null,
        })),
      );
    }
  }

  // 5. CSS 재생성
  try {
    const { generateAllCssCode } = await import('@/lib/tokens/css-generator');
    const allTokenRows = await db
      .select()
      .from(tokens)
      .where(eq(tokens.projectId, projectId))
      .all() as TokenRow[];
    const css = generateAllCssCode(allTokenRows);
    const cssDir = path.join(process.cwd(), 'design-tokens');
    fs.mkdirSync(cssDir, { recursive: true });
    fs.writeFileSync(path.join(cssDir, 'tokens.css'), css, 'utf-8');
    fs.writeFileSync(path.join(process.cwd(), 'public', 'tokens.css'), css, 'utf-8');
  } catch {}

  return { error: null, restoredVersion: prev?.version ?? null };
}

// ── 활성 프로젝트 스냅샷 목록 (컴포넌트 직접 호출용) ─────

export async function getActiveSnapshotListAction(): Promise<SnapshotInfo[]> {
  const projectId = getActiveProjectId();
  if (!projectId) return [];
  return getSnapshotListAction(projectId);
}
