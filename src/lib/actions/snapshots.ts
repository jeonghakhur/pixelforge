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
  const project = db.select({ id: projects.id }).from(projects).limit(1).get();
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
