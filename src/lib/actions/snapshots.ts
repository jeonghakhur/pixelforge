'use server';

import { db } from '@/lib/db';
import { tokens, projects, tokenSnapshots } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import type { TokenRow } from '@/lib/actions/tokens';
import {
  tokensToSnapshotData,
  computeTokenCounts,
  computeSnapshotDiff,
  type SnapshotTokenItem,
  type SnapshotDiffSummary,
} from '@/lib/tokens/snapshot-engine';

// ===========================
// 타입
// ===========================
export interface SnapshotListItem {
  id: string;
  version: number;
  source: string;
  figmaVersion: string | null;
  tokenCounts: Record<string, number>;
  diffSummary: SnapshotDiffSummary | null;
  createdAt: string;
}

export interface SnapshotDetail {
  id: string;
  version: number;
  source: string;
  figmaVersion: string | null;
  tokenCounts: Record<string, number>;
  tokensData: SnapshotTokenItem[];
  diffSummary: SnapshotDiffSummary | null;
  createdAt: string;
}

// ===========================
// 스냅샷 생성 (토큰 추출 시 호출)
// ===========================
export async function createSnapshotAction(
  projectId: string,
  source: 'variables' | 'styles-api' | 'section-scan' | 'node-scan',
  figmaVersion?: string | null,
): Promise<{ error: string | null; snapshotId: string | null; version: number }> {
  try {
    // 현재 토큰 전체 조회
    const allTokens = db.select({
      id: tokens.id,
      name: tokens.name,
      type: tokens.type,
      value: tokens.value,
      raw: tokens.raw,
      source: tokens.source,
      mode: tokens.mode,
      collectionName: tokens.collectionName,
      alias: tokens.alias,
    })
      .from(tokens)
      .where(eq(tokens.projectId, projectId))
      .all() as TokenRow[];

    if (allTokens.length === 0) {
      return { error: '저장할 토큰이 없습니다.', snapshotId: null, version: 0 };
    }

    const snapshotData = tokensToSnapshotData(allTokens);
    const counts = computeTokenCounts(snapshotData);

    // 다음 버전 번호 계산
    const lastSnapshot = db.select({ version: tokenSnapshots.version })
      .from(tokenSnapshots)
      .where(eq(tokenSnapshots.projectId, projectId))
      .orderBy(desc(tokenSnapshots.version))
      .limit(1)
      .get();

    const nextVersion = (lastSnapshot?.version ?? 0) + 1;

    // 이전 스냅샷과 diff 계산
    let diffSummary: SnapshotDiffSummary | null = null;
    if (lastSnapshot) {
      const prevSnapshot = db.select({ tokensData: tokenSnapshots.tokensData })
        .from(tokenSnapshots)
        .where(and(
          eq(tokenSnapshots.projectId, projectId),
          eq(tokenSnapshots.version, lastSnapshot.version),
        ))
        .get();

      if (prevSnapshot) {
        const prevItems = JSON.parse(prevSnapshot.tokensData) as SnapshotTokenItem[];
        diffSummary = computeSnapshotDiff(prevItems, snapshotData);
      }
    }

    const snapshotId = crypto.randomUUID();
    db.insert(tokenSnapshots).values({
      id: snapshotId,
      projectId,
      version: nextVersion,
      source,
      figmaVersion: figmaVersion ?? null,
      tokenCounts: JSON.stringify(counts),
      tokensData: JSON.stringify(snapshotData),
      diffSummary: diffSummary ? JSON.stringify(diffSummary) : null,
    }).run();

    return { error: null, snapshotId, version: nextVersion };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '스냅샷 생성 실패', snapshotId: null, version: 0 };
  }
}

// ===========================
// 스냅샷 목록 조회
// ===========================
export async function getSnapshotsAction(): Promise<{
  error: string | null;
  snapshots: SnapshotListItem[];
}> {
  const project = db.select({ id: projects.id }).from(projects).orderBy(desc(projects.updatedAt)).limit(1).get();
  if (!project) return { error: null, snapshots: [] };

  const rows = db.select({
    id: tokenSnapshots.id,
    version: tokenSnapshots.version,
    source: tokenSnapshots.source,
    figmaVersion: tokenSnapshots.figmaVersion,
    tokenCounts: tokenSnapshots.tokenCounts,
    diffSummary: tokenSnapshots.diffSummary,
    createdAt: tokenSnapshots.createdAt,
  })
    .from(tokenSnapshots)
    .where(eq(tokenSnapshots.projectId, project.id))
    .orderBy(desc(tokenSnapshots.version))
    .all();

  const snapshots: SnapshotListItem[] = rows.map((row) => ({
    id: row.id,
    version: row.version,
    source: row.source,
    figmaVersion: row.figmaVersion,
    tokenCounts: JSON.parse(row.tokenCounts) as Record<string, number>,
    diffSummary: row.diffSummary ? JSON.parse(row.diffSummary) as SnapshotDiffSummary : null,
    createdAt: row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : new Date((row.createdAt as unknown as number) * 1000).toISOString(),
  }));

  return { error: null, snapshots };
}

// ===========================
// 스냅샷 상세 조회
// ===========================
export async function getSnapshotDetailAction(snapshotId: string): Promise<{
  error: string | null;
  snapshot: SnapshotDetail | null;
}> {
  const row = db.select()
    .from(tokenSnapshots)
    .where(eq(tokenSnapshots.id, snapshotId))
    .get();

  if (!row) return { error: '스냅샷을 찾을 수 없습니다.', snapshot: null };

  return {
    error: null,
    snapshot: {
      id: row.id,
      version: row.version,
      source: row.source,
      figmaVersion: row.figmaVersion,
      tokenCounts: JSON.parse(row.tokenCounts) as Record<string, number>,
      tokensData: JSON.parse(row.tokensData) as SnapshotTokenItem[],
      diffSummary: row.diffSummary ? JSON.parse(row.diffSummary) as SnapshotDiffSummary : null,
      createdAt: row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date((row.createdAt as unknown as number) * 1000).toISOString(),
    },
  };
}

// ===========================
// 두 스냅샷 간 diff 비교
// ===========================
export async function compareSnapshotsAction(
  snapshotIdA: string,
  snapshotIdB: string,
): Promise<{ error: string | null; diff: SnapshotDiffSummary | null }> {
  const [a, b] = [
    db.select({ tokensData: tokenSnapshots.tokensData, version: tokenSnapshots.version })
      .from(tokenSnapshots).where(eq(tokenSnapshots.id, snapshotIdA)).get(),
    db.select({ tokensData: tokenSnapshots.tokensData, version: tokenSnapshots.version })
      .from(tokenSnapshots).where(eq(tokenSnapshots.id, snapshotIdB)).get(),
  ];

  if (!a || !b) return { error: '스냅샷을 찾을 수 없습니다.', diff: null };

  const oldItems = JSON.parse(a.tokensData) as SnapshotTokenItem[];
  const newItems = JSON.parse(b.tokensData) as SnapshotTokenItem[];

  // 낮은 버전 → 높은 버전 순서로 diff
  const diff = a.version < b.version
    ? computeSnapshotDiff(oldItems, newItems)
    : computeSnapshotDiff(newItems, oldItems);

  return { error: null, diff };
}

// ===========================
// 스냅샷으로 롤백
// ===========================
export async function rollbackToSnapshotAction(snapshotId: string): Promise<{
  error: string | null;
  restoredCount: number;
}> {
  const snapshot = db.select({
    projectId: tokenSnapshots.projectId,
    tokensData: tokenSnapshots.tokensData,
    version: tokenSnapshots.version,
    source: tokenSnapshots.source,
  })
    .from(tokenSnapshots)
    .where(eq(tokenSnapshots.id, snapshotId))
    .get();

  if (!snapshot) return { error: '스냅샷을 찾을 수 없습니다.', restoredCount: 0 };

  try {
    const items = JSON.parse(snapshot.tokensData) as SnapshotTokenItem[];

    // 기존 토큰 삭제
    db.delete(tokens).where(eq(tokens.projectId, snapshot.projectId)).run();

    // 스냅샷 토큰 복원
    for (const item of items) {
      db.insert(tokens).values({
        id: crypto.randomUUID(),
        projectId: snapshot.projectId,
        version: 1,
        type: item.type,
        name: item.name,
        value: item.value,
        raw: item.raw,
        source: snapshot.source as 'variables' | 'styles-api' | 'section-scan' | 'node-scan',
        mode: item.mode,
        collectionName: item.collectionName,
        alias: item.alias,
      }).run();
    }

    return { error: null, restoredCount: items.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '롤백 실패', restoredCount: 0 };
  }
}

// ===========================
// 스냅샷 삭제
// ===========================
export async function deleteSnapshotAction(snapshotId: string): Promise<{ error: string | null }> {
  try {
    db.delete(tokenSnapshots).where(eq(tokenSnapshots.id, snapshotId)).run();
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '삭제 실패' };
  }
}

// ===========================
// Drift Detection (Figma 현재 상태 vs DB)
// ===========================

import { FigmaClient, extractFileKey } from '@/lib/figma/api';
import { extractFromVariables } from '@/lib/tokens/variables-extractor';
import { getFigmaToken } from '@/lib/config';
import {
  computeDrift,
  type DriftReport,
  type FigmaTokenForCompare,
} from '@/lib/tokens/drift-detector';

export type { DriftReport, DriftItem } from '@/lib/tokens/drift-detector';

/** Figma Variables → FigmaTokenForCompare[] 변환 */
function variablesToComparableTokens(
  variablesRes: import('@/lib/figma/api').FigmaVariablesResponse,
): FigmaTokenForCompare[] {
  const result = extractFromVariables(variablesRes);
  const items: FigmaTokenForCompare[] = [];

  for (const c of result.colors) {
    items.push({
      type: 'color',
      name: c.name,
      value: JSON.stringify({ hex: c.hex, rgba: c.rgba }),
      raw: c.hex,
      mode: c.mode,
    });
  }
  for (const t of result.typography) {
    items.push({
      type: 'typography',
      name: t.name,
      value: JSON.stringify({
        fontFamily: t.fontFamily,
        fontSize: t.fontSize,
        fontWeight: t.fontWeight,
        lineHeight: t.lineHeight,
        letterSpacing: t.letterSpacing,
      }),
      raw: `${t.fontFamily} ${t.fontSize}px`,
      mode: t.mode,
    });
  }
  for (const s of result.spacing) {
    items.push({
      type: 'spacing',
      name: s.name,
      value: JSON.stringify({
        paddingTop: s.paddingTop,
        paddingRight: s.paddingRight,
        paddingBottom: s.paddingBottom,
        paddingLeft: s.paddingLeft,
        gap: s.gap,
      }),
      raw: `gap:${s.gap ?? 0}`,
      mode: s.mode,
    });
  }
  for (const r of result.radius) {
    items.push({
      type: 'radius',
      name: r.name,
      value: JSON.stringify({ value: r.value, corners: r.corners }),
      raw: `${r.value}px`,
      mode: r.mode,
    });
  }

  return items;
}

export async function detectDriftAction(): Promise<{
  error: string | null;
  report: DriftReport | null;
}> {
  const figmaToken = getFigmaToken();
  if (!figmaToken) {
    return { error: 'Figma API 토큰이 설정되지 않았습니다.', report: null };
  }

  const project = db.select({
    id: projects.id,
    figmaKey: projects.figmaKey,
    figmaUrl: projects.figmaUrl,
  }).from(projects).orderBy(desc(projects.updatedAt)).limit(1).get();

  if (!project?.figmaKey) {
    return { error: '프로젝트를 찾을 수 없습니다. 먼저 토큰을 추출해주세요.', report: null };
  }

  try {
    const client = new FigmaClient(figmaToken);
    const variablesRes = await client.getVariables(project.figmaKey);

    if (!variablesRes) {
      return {
        error: 'Figma Variables API에 접근할 수 없습니다. 파일 권한을 확인해주세요.',
        report: null,
      };
    }

    const figmaTokens = variablesToComparableTokens(variablesRes);

    // DB 현재 토큰 조회
    const dbTokenRows = db.select({
      id: tokens.id,
      name: tokens.name,
      type: tokens.type,
      value: tokens.value,
      raw: tokens.raw,
      source: tokens.source,
      mode: tokens.mode,
      collectionName: tokens.collectionName,
      alias: tokens.alias,
    })
      .from(tokens)
      .where(eq(tokens.projectId, project.id))
      .all() as TokenRow[];

    const report = computeDrift(figmaTokens, dbTokenRows);
    return { error: null, report };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Drift 감지 실패',
      report: null,
    };
  }
}

// ===========================
// Plugin JSON 기반 Drift Detection
// (Professional 요금제 — Variables REST API 사용 불가 시)
// ===========================

import { parsePluginJson } from '@/lib/tokens/plugin-json-parser';

export async function detectDriftFromJsonAction(jsonString: string): Promise<{
  error: string | null;
  report: DriftReport | null;
  format: string;
}> {
  const parseResult = parsePluginJson(jsonString);
  if (parseResult.error) {
    return { error: parseResult.error, report: null, format: parseResult.format };
  }

  const project = db.select({ id: projects.id })
    .from(projects).orderBy(desc(projects.updatedAt)).limit(1).get();

  if (!project) {
    return {
      error: '프로젝트를 찾을 수 없습니다. 먼저 토큰을 추출해주세요.',
      report: null,
      format: parseResult.format,
    };
  }

  const dbTokenRows = db.select({
    id: tokens.id,
    name: tokens.name,
    type: tokens.type,
    value: tokens.value,
    raw: tokens.raw,
    source: tokens.source,
    mode: tokens.mode,
    collectionName: tokens.collectionName,
    alias: tokens.alias,
  })
    .from(tokens)
    .where(eq(tokens.projectId, project.id))
    .all() as TokenRow[];

  const report = computeDrift(parseResult.tokens, dbTokenRows);
  return { error: null, report, format: parseResult.format };
}
