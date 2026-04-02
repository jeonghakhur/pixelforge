# Design: 토큰 변경 히스토리 (snapshot 기반)

> Plan: `docs/01-plan/features/token-history.plan.md`

---

## 1. 아키텍처 레이어

```
┌─────────────────────────────────────────────────────────┐
│  Presentation (React)                                   │
│  src/app/(ide)/TokenDashboard.tsx  ← SnapshotHistory 섹션 추가    
│                                  SnapshotHistory 추가    │
│  src/app/(ide)/SnapshotHistory.tsx  ← 신규          │
└─────────────────┬───────────────────────────────────────┘
                  │ Server Actions (use server)
┌─────────────────▼───────────────────────────────────────┐
│  Application (Server Actions)                           │
│  src/lib/actions/tokens.ts                              │
│    getSnapshotListAction()   ← 기존 (수정 없음)           │
│    getSnapshotDetailAction() ← 신규                      │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│  Infrastructure (DB + snapshot-engine)                  │
│  tokenSnapshots 테이블  ← 스키마 변경 없음                │
│  src/lib/tokens/pipeline.ts ← diffSummary 구조 확장      │
│  src/lib/tokens/snapshot-engine.ts ← 기존 재사용         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 파일 목록

### 신규 파일

| 파일 | 역할 | 규모 |
|------|------|------|
| `src/app/(ide)/SnapshotHistory.tsx` | 히스토리 타임라인 + 상세 패널 | ~200줄 |
| `src/app/(ide)/snapshot-history.module.scss` | 스타일 | ~150줄 |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/tokens/pipeline.ts` | `diffSummary` — 숫자 → 토큰 목록으로 확장 |
| `src/lib/actions/tokens.ts` | `getSnapshotDetailAction()` 추가 |
| `src/app/(ide)/diff/page.tsx` | `TokenCommitHistory` 제거, `SnapshotHistory` 추가 |

### 제거 파일

| 파일 | 이유 |
|------|------|
| `src/app/(ide)/diff/TokenCommitHistory.tsx` | git 기반 — 대체됨 |
| `src/app/(ide)/diff/token-commit-history.module.scss` | 함께 제거 |
| `src/lib/git/token-commits.ts` | git auto-commit 불필요 |
| `src/lib/actions/token-history.ts` | git 기반 server actions — 대체됨 |

---

## 3. `pipeline.ts` 수정 — diffSummary 확장

### 변경 전

```typescript
diffSummary: JSON.stringify({
  added: diff.added.length,
  removed: diff.removed.length,
  changed: diff.changed.length,
}),
```

### 변경 후

```typescript
/** diffSummary에 저장할 토큰 항목 (용량 최소화: value 제외) */
interface DiffSummaryItem {
  name: string;
  type: string;
  oldRaw?: string | null;
  newRaw?: string | null;
}

interface DiffSummaryData {
  added: DiffSummaryItem[];
  removed: DiffSummaryItem[];
  changed: DiffSummaryItem[];
}

diffSummary: JSON.stringify({
  added:   diff.added.map((t)   => ({ name: t.name, type: t.type })),
  removed: diff.removed.map((t) => ({ name: t.name, type: t.type })),
  changed: diff.changed.map((t) => ({ name: t.name, type: t.type, oldRaw: t.oldRaw, newRaw: t.newRaw })),
} satisfies DiffSummaryData),
```

> 두 곳 수정 (메인 upsert + `upsertTokenTypeConfigs` 이전 INSERT)
> `value` JSON 원본은 제외 — `raw`(표시용 문자열)만 저장해 용량 최소화

---

## 4. `getSnapshotDetailAction()` 상세 설계

**`src/lib/actions/tokens.ts`** 에 추가:

```typescript
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
  // 1. 대상 스냅샷 조회
  const row = await db
    .select()
    .from(tokenSnapshots)
    .where(eq(tokenSnapshots.id, snapshotId))
    .get();

  if (!row) return { error: '스냅샷을 찾을 수 없습니다.', detail: null };

  // 2. diffSummary 파싱 — 신규 형식(목록) vs 구형식(숫자) 구분
  let diff: SnapshotDetail['diff'] = { added: [], removed: [], changed: [] };

  try {
    const parsed = JSON.parse(row.diffSummary ?? '{}') as Record<string, unknown>;

    if (Array.isArray(parsed.added)) {
      // 신규 형식 — 목록 그대로 사용
      diff = parsed as SnapshotDetail['diff'];
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

      const prevItems = prevRow?.tokensData
        ? (JSON.parse(prevRow.tokensData) as SnapshotTokenItem[])
        : [];
      const currItems = JSON.parse(row.tokensData) as SnapshotTokenItem[];
      const computed = computeSnapshotDiff(prevItems, currItems);

      diff = {
        added:   computed.added.map((t)   => ({ name: t.name, type: t.type })),
        removed: computed.removed.map((t) => ({ name: t.name, type: t.type })),
        changed: computed.changed.map((t) => ({
          name: t.name, type: t.type, oldRaw: t.oldRaw, newRaw: t.newRaw,
        })),
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
```

---

## 5. `SnapshotHistory` 컴포넌트 설계

### 5-1. Props

```typescript
// Props 없음 — 내부에서 server action 직접 호출
```

### 5-2. 상태

| state | type | 역할 |
|-------|------|------|
| `snapshots` | `SnapshotInfo[]` | 스냅샷 목록 (version, date, counts) |
| `loading` | `boolean` | 초기 로드 |
| `expandedId` | `string \| null` | 펼쳐진 스냅샷 ID |
| `detail` | `SnapshotDetail \| null` | 상세 데이터 (diff 목록) |
| `detailLoading` | `boolean` | 상세 로드 중 |

### 5-3. 렌더 구조

```
SnapshotHistory
├── 섹션 헤더 ("토큰 변경 이력")
├── [빈 상태] snapshots.length === 0
│   └── 빈 상태 메시지 + 아이콘
└── [목록] snapshots.map(snap)
    ├── SnapshotRow (항상 표시)
    │   ├── 버전 배지 (v8)
    │   ├── 날짜 (04/02 14:20)
    │   ├── 소스 배지 (plugin / api)
    │   ├── 타입별 토큰 수 요약 (색상 273 · 간격 15 · ...)
    │   ├── 변경 요약 칩 (+3 -1 ~2)
    │   └── [상세 보기] 토글 버튼
    └── [expanded] expandedId === snap.id
        └── DetailPanel
            ├── [로딩] detailLoading
            ├── [추가] added 목록
            │   └── TokenChangeRow (+ name, type badge)
            ├── [삭제] removed 목록
            │   └── TokenChangeRow (- name, type badge)
            └── [변경] changed 목록
                └── TokenChangeRow (~ name, type badge, oldRaw → newRaw)
```

### 5-4. 핵심 동작

```typescript
const handleToggle = async (snapshotId: string) => {
  if (expandedId === snapshotId) {
    setExpandedId(null);
    return;
  }
  setExpandedId(snapshotId);
  setDetailLoading(true);
  const result = await getSnapshotDetailAction(snapshotId);
  setDetail(result.detail);
  setDetailLoading(false);
};
```

### 5-5. 변경 수 요약 계산

`SnapshotInfo`에 `diffSummary` 숫자는 없으므로, `getSnapshotListAction()` 응답에
`diffCounts` 필드를 추가:

```typescript
// getSnapshotListAction 반환값 확장
export interface SnapshotInfo {
  id: string;
  version: number;
  source: string;
  tokenCounts: Record<string, number>;
  total: number;
  createdAt: Date;
  diffCounts: { added: number; removed: number; changed: number }; // 신규
}
```

`diffSummary` 파싱 로직:
```typescript
let diffCounts = { added: 0, removed: 0, changed: 0 };
try {
  const parsed = JSON.parse(r.diffSummary ?? '{}') as Record<string, unknown>;
  if (Array.isArray(parsed.added)) {
    // 신규 형식
    diffCounts = {
      added: (parsed.added as unknown[]).length,
      removed: (parsed.removed as unknown[]).length,
      changed: (parsed.changed as unknown[]).length,
    };
  } else {
    // 구형식 숫자
    diffCounts = {
      added: (parsed.added as number) ?? 0,
      removed: (parsed.removed as number) ?? 0,
      changed: (parsed.changed as number) ?? 0,
    };
  }
} catch {}
```

---

## 6. 스타일 설계 (`snapshot-history.module.scss`)

```scss
@use '../../../styles/variables' as *;
@use '../../../styles/mixins' as *;

.section { margin-bottom: 32px; }

.sectionTitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: $font-weight-semibold;
  color: var(--text-primary);
  margin-bottom: 16px;
}

// 목록 컨테이너
.list {
  border: 1px solid var(--glass-border);
  border-radius: $border-radius-lg;
  overflow: hidden;
}

// 스냅샷 행
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--glass-border);
  cursor: pointer;
  transition: $transition-fast;
  &:last-child { border-bottom: none; }
  &:hover { background: var(--bg-elevated); }
  &.expanded { background: var(--bg-elevated); }
}

// 버전 배지
.versionBadge {
  font-family: $font-family-mono;
  font-size: 11px;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
  min-width: 32px;
  text-align: center;
}

// 날짜
.date {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
  min-width: 88px;
}

// 소스 배지
.sourceBadge {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--glass-bg);
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}

// 토큰 수 요약
.countSummary {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// 변경 수 칩 묶음
.diffChips {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.chip {
  font-size: 11px;
  font-family: $font-family-mono;
  padding: 2px 6px;
  border-radius: 4px;
}
.chipAdded   { color: #4ade80; background: rgba(74, 222, 128, 0.12); }
.chipRemoved { color: #f87171; background: rgba(248, 113, 113, 0.12); }
.chipChanged { color: #fb923c; background: rgba(251, 146, 60, 0.12); }

// 토글 버튼
.toggleBtn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  &:hover { color: var(--text-primary); }
}

// 상세 패널
.detailPanel {
  border-top: 1px solid var(--glass-border);
  padding: 16px;
  background: var(--bg-base);
}

.detailSection {
  margin-bottom: 12px;
  &:last-child { margin-bottom: 0; }
}

.detailSectionTitle {
  font-size: 11px;
  font-weight: $font-weight-semibold;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

// 토큰 변경 행
.tokenRow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}

.tokenPrefix {
  font-family: $font-family-mono;
  font-size: 12px;
  width: 12px;
  flex-shrink: 0;
}
.prefixAdded   { color: #4ade80; }
.prefixRemoved { color: #f87171; }
.prefixChanged { color: #fb923c; }

.tokenName {
  font-family: $font-family-mono;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.typeBadge {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--glass-bg);
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}

.rawChange {
  font-family: $font-family-mono;
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

// 빈 상태
.empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 13px;
}
```

---

## 7. `diff/page.tsx` 수정

```tsx
// 제거
- import TokenCommitHistory from './TokenCommitHistory';

// 추가
+ import SnapshotHistory from './SnapshotHistory';

// JSX 교체
- <TokenCommitHistory />
+ <SnapshotHistory />
```

---

## 8. 구현 순서

| # | 파일 | 작업 |
|---|------|------|
| 1 | `pipeline.ts` | `diffSummary` — 토큰 목록 저장으로 확장 |
| 2 | `actions/tokens.ts` | `SnapshotInfo.diffCounts` 필드 추가, `getSnapshotDetailAction()` 신규 |
| 3 | `snapshot-history.module.scss` | 스타일 작성 |
| 4 | `SnapshotHistory.tsx` | UI 컴포넌트 구현 |
| 5 | `diff/page.tsx` | `TokenCommitHistory` → `SnapshotHistory` 교체 |
| 6 | 파일 4개 제거 | `TokenCommitHistory.tsx`, `token-commit-history.module.scss`, `token-commits.ts`, `token-history.ts` |

---

## 9. 성공 기준

- [ ] sync 후 `diffSummary`에 토큰 이름 목록이 저장됨
- [ ] `/diff` 페이지에 sync 이력 타임라인이 표시됨 (버전, 날짜, 소스, 토큰 수 요약, +/-/~ 칩)
- [ ] 행 클릭 시 추가/삭제/변경된 토큰 이름 목록이 상세 패널로 표시됨
- [ ] 구형식 스냅샷(숫자만)도 `tokensData` 비교로 상세 표시됨
- [ ] 스냅샷 없을 때 빈 상태 메시지 표시
- [ ] `TokenCommitHistory` 관련 파일 4개 제거 완료
- [ ] `npm run build` 통과
