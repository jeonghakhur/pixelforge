/**
 * 공통 토큰 수신 파이프라인
 *
 * 4가지 토큰 생성 방식(플러그인 / JSON 파일 / JSON 붙여넣기 / Figma URL)이
 * 모두 이 함수를 통과하도록 한다.
 *
 * runTokenPipeline(projectId, normalizedTokens, options)
 *   1. tokens 테이블 upsert (DELETE 보내온 타입만 → INSERT, 나머지 타입 유지)
 *   2. computeSnapshotDiff  (이전 스냅샷과 비교)
 *   3. tokenSnapshots INSERT (tokenCounts, diffSummary)
 *   4. CSS 재생성 → public/css/tokens.css 저장
 *   5. token_sources upsert (lastExtractedAt, tokenCount, figmaKey)
 *   6. 변경된 타입에 대해 백그라운드 스크린샷 트리거
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { tokens, tokenSnapshots, tokenSources, tokenTypeConfigs } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { NormalizedToken } from '@/lib/sync/parse-variables';
import {
  computeSnapshotDiff,
  computeTokenCounts,
  type SnapshotTokenItem,
} from '@/lib/tokens/snapshot-engine';
import { generateAllCssCode } from '@/lib/tokens/css-generator';
import type { TokenRow } from '@/lib/actions/tokens';
import { getTypeDefault } from '@/lib/tokens/token-type-defaults';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export type TokenSource = 'variables' | 'styles-api' | 'section-scan' | 'node-scan';

export interface PipelineOptions {
  source: TokenSource;
  figmaKey?: string;
  figmaVersion?: string;
  /** token_sources 행을 upsert할 때 사용할 Figma URL (플러그인 sync 시 선택적) */
  figmaUrl?: string;
}

export interface PipelineResult {
  version: number;
  tokenCounts: Record<string, number>;
  diff: {
    added: number;
    removed: number;
    changed: number;
    changedTypes: string[];
  };
  screenshotQueued: boolean;
}

// ─────────────────────────────────────────
// 내부 헬퍼
// ─────────────────────────────────────────

function normalizedToSnapshotItem(t: NormalizedToken): SnapshotTokenItem {
  return {
    type: t.type,
    name: t.name,
    value: t.value,
    raw: t.raw,
    mode: t.mode,
    collectionName: t.collectionName,
    alias: t.alias,
  };
}

function tokenRowToSnapshotItem(r: TokenRow): SnapshotTokenItem {
  return {
    type: r.type,
    name: r.name,
    value: r.value,
    raw: r.raw,
    mode: r.mode,
    collectionName: r.collectionName,
    alias: r.alias,
  };
}

function normalizedToTokenRow(t: NormalizedToken): Omit<TokenRow, 'id'> {
  return {
    type: t.type,
    name: t.name,
    value: t.value,
    raw: t.raw,
    source: 'variables' as const,
    mode: t.mode,
    collectionName: t.collectionName,
    alias: t.alias,
    sortOrder: t.sortOrder,
  };
}

/** 이전 스냅샷의 토큰 데이터를 파싱하여 SnapshotTokenItem[] 반환 */
function parsePrevTokens(tokensDataJson: string | null): SnapshotTokenItem[] {
  if (!tokensDataJson) return [];
  try {
    const parsed = JSON.parse(tokensDataJson) as unknown;
    if (Array.isArray(parsed)) return parsed as SnapshotTokenItem[];
  } catch {}
  return [];
}

// ─────────────────────────────────────────
// 메인 파이프라인
// ─────────────────────────────────────────

export async function runTokenPipeline(
  projectId: string,
  normalizedTokens: NormalizedToken[],
  options: PipelineOptions,
): Promise<PipelineResult> {
  const { source, figmaKey, figmaVersion } = options;

  // ── Step 1: 들어온 타입만 교체 (다른 타입 토큰은 유지) ──
  const incomingTypes = [...new Set(normalizedTokens.map((t) => t.type))];

  for (const type of incomingTypes) {
    await db.delete(tokens).where(and(eq(tokens.projectId, projectId), eq(tokens.type, type)));
  }

  if (normalizedTokens.length > 0) {
    await db.insert(tokens).values(
      normalizedTokens.map((t) => ({
        id: crypto.randomUUID(),
        projectId,
        source,
        type: t.type,
        name: t.name,
        value: t.value,
        raw: t.raw,
        mode: t.mode,
        collectionName: t.collectionName,
        alias: t.alias,
        sortOrder: t.sortOrder,
      })),
    );
  }

  // ── Step 2: diff 계산 ─────────────────────────
  const prevSnapshot = await db
    .select()
    .from(tokenSnapshots)
    .where(eq(tokenSnapshots.projectId, projectId))
    .orderBy(desc(tokenSnapshots.version))
    .limit(1)
    .get();

  const newItems = normalizedTokens.map(normalizedToSnapshotItem);

  // 이전 스냅샷에서 동일 타입만 추출해서 diff 계산
  const prevAllItems = parsePrevTokens(prevSnapshot?.tokensData ?? null);
  const prevItems = prevAllItems.filter((t) => incomingTypes.includes(t.type));
  const diff = computeSnapshotDiff(prevItems, newItems);

  const changedTypes = Object.keys(diff.countsByType);

  // ── Step 3: tokenSnapshots INSERT ────────────
  // 스냅샷은 전체 토큰 상태(부분 업데이트 반영 후)를 저장
  const allTokenRowsForSnapshot = await db
    .select({
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

  const allItems = allTokenRowsForSnapshot.map(tokenRowToSnapshotItem);
  const tokenCounts = computeTokenCounts(allItems);
  const nextVersion = (prevSnapshot?.version ?? 0) + 1;
  const snapshotId = crypto.randomUUID();

  await db.insert(tokenSnapshots).values({
    id: snapshotId,
    projectId,
    version: nextVersion,
    source,
    figmaVersion: figmaVersion ?? null,
    tokenCounts: JSON.stringify(tokenCounts),
    tokensData: JSON.stringify(allItems),
    diffSummary: JSON.stringify({
      added:   diff.added.map((t)   => ({ name: t.name, type: t.type, newRaw: t.newRaw ?? null })),
      removed: diff.removed.map((t) => ({ name: t.name, type: t.type, oldRaw: t.oldRaw ?? null })),
      changed: diff.changed.map((t) => ({ name: t.name, type: t.type, oldRaw: t.oldRaw ?? null, newRaw: t.newRaw ?? null })),
    }),
  });

  // ── Step 4: CSS 재생성 ────────────────────────
  try {
    const allTokenRows = await db
      .select({
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

    const css = generateAllCssCode(allTokenRows);
    const cssDir = path.join(process.cwd(), 'public', 'css');
    fs.mkdirSync(cssDir, { recursive: true });
    fs.writeFileSync(path.join(cssDir, 'tokens.css'), css, 'utf-8');
  } catch {
    // CSS 재생성 실패는 파이프라인을 중단하지 않음
  }

  // ── Step 5: token_sources upsert ─────────────
  // 플러그인 sync 후 "마지막 추출" 시간, token 수, figmaKey 업데이트
  try {
    const effectiveUrl = options.figmaUrl ?? (figmaKey ? `https://www.figma.com/design/${figmaKey}` : null);
    if (effectiveUrl && figmaKey) {
      for (const [type, count] of Object.entries(tokenCounts)) {
        const existing = db
          .select({ id: tokenSources.id })
          .from(tokenSources)
          .where(and(eq(tokenSources.projectId, projectId), eq(tokenSources.type, type)))
          .get();

        if (existing) {
          await db
            .update(tokenSources)
            .set({
              figmaKey,
              lastExtractedAt: new Date(),
              tokenCount: count,
              ...(figmaVersion ? { figmaVersion } : {}),
              updatedAt: new Date(),
            })
            .where(eq(tokenSources.id, existing.id));
        } else {
          await db.insert(tokenSources).values({
            id: crypto.randomUUID(),
            projectId,
            type,
            figmaUrl: effectiveUrl,
            figmaKey,
            figmaVersion: figmaVersion ?? null,
            lastExtractedAt: new Date(),
            tokenCount: count,
          });
        }
      }
    }
  } catch {
    // token_sources 업데이트 실패는 파이프라인을 중단하지 않음
  }

  // ── Step 5b: token_type_configs 자동 등록 ────────
  try {
    const distinctTypes = [...new Set(normalizedTokens.map((t) => t.type))];
    await upsertTokenTypeConfigs(projectId, distinctTypes);
  } catch {
    // token_type_configs 등록 실패는 파이프라인을 중단하지 않음
  }

  // ── Step 6: 스크린샷 백그라운드 트리거 ─────────
  let screenshotQueued = false;
  if (changedTypes.length > 0) {
    screenshotQueued = true;
    // 응답 블로킹 없이 백그라운드 실행
    void triggerScreenshots(changedTypes, figmaKey ?? null, projectId);
  }

  return {
    version: nextVersion,
    tokenCounts,
    diff: {
      added: diff.added.length,
      removed: diff.removed.length,
      changed: diff.changed.length,
      changedTypes,
    },
    screenshotQueued,
  };
}

// ─────────────────────────────────────────
// token_type_configs 자동 등록
// ─────────────────────────────────────────

async function upsertTokenTypeConfigs(
  projectId: string,
  types: string[],
): Promise<void> {
  if (types.length === 0) return;

  const existing = await db
    .select({ type: tokenTypeConfigs.type })
    .from(tokenTypeConfigs)
    .where(eq(tokenTypeConfigs.projectId, projectId))
    .all();

  const existingTypes = new Set(existing.map((r) => r.type));
  const newTypes = types.filter((t) => !existingTypes.has(t));
  if (newTypes.length === 0) return;

  const baseOrder = existing.length;
  await db.insert(tokenTypeConfigs).values(
    newTypes.map((type, i) => {
      const meta = getTypeDefault(type);
      return {
        id: crypto.randomUUID(),
        projectId,
        type,
        label: meta.label,
        icon: meta.icon,
        menuOrder: baseOrder + i,
        isVisible: true,
      };
    }),
  );
}

// ─────────────────────────────────────────
// 스크린샷 백그라운드 실행
// ─────────────────────────────────────────

async function triggerScreenshots(
  changedTypes: string[],
  figmaKey: string | null,
  projectId: string,
): Promise<void> {
  try {
    const { captureTokenPageScreenshotAction, captureFigmaFrameAction } = await import(
      '@/lib/actions/tokens'
    );

    // 변경된 타입에 대해 병렬 캡처 (캡처 가능한 타입만)
    const captureableTypes = changedTypes.filter((t) =>
      ['color', 'typography', 'spacing', 'radius'].includes(t),
    );

    await Promise.allSettled(
      captureableTypes.flatMap((type) => {
        const tasks = [captureTokenPageScreenshotAction(type)];
        if (figmaKey) {
          tasks.push(captureFigmaFrameAction(type, figmaKey, null));
        }
        return tasks;
      }),
    );
  } catch {
    // 스크린샷 실패는 무시 (백그라운드 작업)
  }
}
