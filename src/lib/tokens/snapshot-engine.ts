import type { TokenRow } from '@/lib/actions/tokens';

// ===========================
// 스냅샷 토큰 데이터 타입
// ===========================
export interface SnapshotTokenItem {
  type: string;
  name: string;
  value: string;
  raw: string | null;
  mode: string | null;
  collectionName: string | null;
  alias: string | null;
}

// ===========================
// Diff 결과 타입
// ===========================
export interface TokenDiffItem {
  type: string;
  name: string;
  /** added: 신규, removed: 삭제, changed: 값 변경 */
  change: 'added' | 'removed' | 'changed';
  oldValue?: string;
  newValue?: string;
  oldRaw?: string | null;
  newRaw?: string | null;
}

export interface SnapshotDiffSummary {
  added: TokenDiffItem[];
  removed: TokenDiffItem[];
  changed: TokenDiffItem[];
  /** 타입별 변경 수 */
  countsByType: Record<string, { added: number; removed: number; changed: number }>;
}

// ===========================
// 토큰 직렬화/역직렬화
// ===========================

/** 현재 DB tokens 행들을 스냅샷 저장용 데이터로 변환 */
export function tokensToSnapshotData(rows: TokenRow[]): SnapshotTokenItem[] {
  return rows.map((r) => ({
    type: r.type,
    name: r.name,
    value: r.value,
    raw: r.raw,
    mode: r.mode,
    collectionName: r.collectionName,
    alias: r.alias,
  }));
}

/** 타입별 토큰 수 계산 */
export function computeTokenCounts(items: SnapshotTokenItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.type] = (counts[item.type] ?? 0) + 1;
  }
  return counts;
}

// ===========================
// Diff 계산 엔진
// ===========================

/** 토큰의 고유 키 생성 (type + name + mode로 유일 식별) */
function tokenKey(item: SnapshotTokenItem): string {
  return `${item.type}::${item.name}::${item.mode ?? ''}`;
}

/** 두 스냅샷 간 diff 계산 */
export function computeSnapshotDiff(
  oldItems: SnapshotTokenItem[],
  newItems: SnapshotTokenItem[],
): SnapshotDiffSummary {
  const oldMap = new Map<string, SnapshotTokenItem>();
  for (const item of oldItems) {
    oldMap.set(tokenKey(item), item);
  }

  const newMap = new Map<string, SnapshotTokenItem>();
  for (const item of newItems) {
    newMap.set(tokenKey(item), item);
  }

  const added: TokenDiffItem[] = [];
  const removed: TokenDiffItem[] = [];
  const changed: TokenDiffItem[] = [];

  // 새 스냅샷에 있는 항목 검사
  for (const [key, newItem] of newMap) {
    const oldItem = oldMap.get(key);
    if (!oldItem) {
      added.push({
        type: newItem.type,
        name: newItem.name,
        change: 'added',
        newValue: newItem.value,
        newRaw: newItem.raw,
      });
    } else if (oldItem.value !== newItem.value) {
      changed.push({
        type: newItem.type,
        name: newItem.name,
        change: 'changed',
        oldValue: oldItem.value,
        newValue: newItem.value,
        oldRaw: oldItem.raw,
        newRaw: newItem.raw,
      });
    }
  }

  // 이전 스냅샷에만 있는 항목 = 삭제됨
  for (const [key, oldItem] of oldMap) {
    if (!newMap.has(key)) {
      removed.push({
        type: oldItem.type,
        name: oldItem.name,
        change: 'removed',
        oldValue: oldItem.value,
        oldRaw: oldItem.raw,
      });
    }
  }

  // 타입별 변경 수 집계
  const countsByType: Record<string, { added: number; removed: number; changed: number }> = {};
  const ensureType = (type: string) => {
    if (!countsByType[type]) countsByType[type] = { added: 0, removed: 0, changed: 0 };
  };
  for (const item of added) { ensureType(item.type); countsByType[item.type].added++; }
  for (const item of removed) { ensureType(item.type); countsByType[item.type].removed++; }
  for (const item of changed) { ensureType(item.type); countsByType[item.type].changed++; }

  return { added, removed, changed, countsByType };
}
