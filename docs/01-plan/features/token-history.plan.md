## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | Figma sync가 이루어질 때 어떤 토큰이 추가·삭제·변경됐는지 추적할 수 없어, 디자인 변경 이력이 불투명하다 |
| Solution | 이미 수집 중인 `tokenSnapshots` 데이터를 활용해 sync 타임라인과 토큰별 변경 상세를 보여주는 히스토리 UI를 제공한다 |
| Function UX Effect | `/diff` 페이지에서 sync 이력 타임라인 확인 → 클릭 시 추가/삭제/변경된 토큰 이름과 값을 상세 패널로 확인 |
| Core Value | 별도 DB 변경 없이 기존 `tokenSnapshots` 테이블을 재활용 — 데이터는 이미 쌓여 있고 UI만 만들면 됨 |

---

# Plan: 토큰 변경 히스토리 — snapshot 기반

## 1. 배경 및 접근 방향

### 기존 문제

- `tokenSnapshots` 테이블에 sync마다 전체 토큰 데이터(`tokensData`)와 변경 수(`diffSummary`)가 저장되고 있음
- 그러나 `diffSummary`는 `{ added: 3, removed: 1, changed: 2 }` 형태로 **숫자만 저장** — 어떤 토큰인지 알 수 없음
- 보여주는 UI가 없어 히스토리를 확인할 방법이 없음

### 접근 방향

```
[데이터 개선]
pipeline.ts diffSummary 구조 확장
  { added: 3 } → { added: [{name, type}], removed: [...], changed: [{name, type, oldRaw, newRaw}] }

[기존 스냅샷 호환]
이전 스냅샷(숫자만 있는 것)은 tokensData 비교로 on-demand 계산

[UI]
/diff 페이지 상단에 SnapshotHistory 섹션 추가
기존 TokenCommitHistory (git 기반) 제거
```

**장점:**
- DB 스키마 변경 없음 (`diffSummary` 컬럼은 TEXT — 구조만 확장)
- 기존 스냅샷 데이터 마이그레이션 불필요
- `tokenSnapshots`는 앱 자체 데이터 — git 환경에 무관하게 동작

---

## 2. diffSummary 구조 확장

### 현재 (숫자만)

```json
{ "added": 3, "removed": 1, "changed": 2 }
```

### 변경 후 (토큰 목록 포함)

```json
{
  "added": [
    { "name": "color/primary/500", "type": "color" }
  ],
  "removed": [
    { "name": "color/gray/old", "type": "color" }
  ],
  "changed": [
    { "name": "color/primary/400", "type": "color", "oldRaw": "#6366f1", "newRaw": "#4f46e5" }
  ]
}
```

> 기존 스냅샷 호환: `diffSummary`가 숫자 형태면 `tokensData` 비교로 계산

---

## 3. 데이터 흐름

```
[신규 sync 시]
pipeline.ts
  ↓ diff 계산 (added/removed/changed 토큰 이름 목록)
  ↓ diffSummary JSON에 목록 저장
  ↓ tokenSnapshots INSERT

[히스토리 페이지 접근 시]
getSnapshotListAction()
  → version, createdAt, source, tokenCounts, diffSummary(숫자 요약) 목록 반환

[특정 버전 클릭 시]
getSnapshotDetailAction(snapshotId)
  → diffSummary에 목록 있으면 반환
  → 없으면 (구 스냅샷) 이전 tokensData와 비교해서 계산
```

---

## 4. UI 구조

```
/diff 페이지

┌─────────────────────────────────────────────────────────┐
│  토큰 변경 이력                                          │
│                                              [최신순 ▼] │
├────────────────────────────────────────────────────────-┤
│  v8  2026-04-02 14:20  plugin  색상 273 · 간격 15       │
│       +3  -1  ~2                          [상세 보기 ▼] │
├─────────────────────────────────────────────────────────┤
│  v7  2026-03-28 10:15  plugin  색상 270 · 간격 15       │
│       +0  -0  ~5                          [상세 보기 ▼] │
└─────────────────────────────────────────────────────────┘

[상세 패널 — 펼쳤을 때]
  ┌── 추가 (3) ───────────────────────────────────────┐
  │  + color/brand/new-500          color   #4f46e5  │
  │  + spacing/section/lg           spacing  48px    │
  └──────────────────────────────────────────────────┘
  ┌── 삭제 (1) ───────────────────────────────────────┐
  │  - color/gray/deprecated        color   #9ca3af  │
  └──────────────────────────────────────────────────┘
  ┌── 변경 (2) ───────────────────────────────────────┐
  │  ~ color/primary/400  #6366f1 → #4f46e5          │
  │  ~ radius/card        8px → 12px                  │
  └──────────────────────────────────────────────────┘
```

---

## 5. 구현 범위

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/tokens/pipeline.ts` | diffSummary에 토큰 이름 목록 저장 |
| `src/lib/actions/tokens.ts` | `getSnapshotDetailAction()` 추가 |
| `src/app/(ide)/diff/page.tsx` | `TokenCommitHistory` 제거, `SnapshotHistory` 추가 |

### 신규 파일

| 파일 | 역할 |
|------|------|
| `src/app/(ide)/diff/SnapshotHistory.tsx` | 히스토리 타임라인 + 상세 패널 컴포넌트 |
| `src/app/(ide)/diff/snapshot-history.module.scss` | 스타일 |

### 제거 파일

| 파일 | 이유 |
|------|------|
| `src/app/(ide)/diff/TokenCommitHistory.tsx` | git 기반 — 대체됨 |
| `src/app/(ide)/diff/token-commit-history.module.scss` | 함께 제거 |
| `src/lib/git/token-commits.ts` | git auto-commit 불필요 |
| `src/lib/actions/token-history.ts` | git 기반 actions — 대체됨 |

---

## 6. 구현 순서

1. `pipeline.ts` — diffSummary 구조 확장 (토큰 이름 목록 저장)
2. `tokens.ts` — `getSnapshotDetailAction()` 추가
3. `SnapshotHistory.tsx` + `snapshot-history.module.scss` — UI 구현
4. `diff/page.tsx` — `TokenCommitHistory` → `SnapshotHistory` 교체
5. git 기반 파일 4개 제거

---

## 7. 엣지 케이스

| 상황 | 처리 |
|------|------|
| 첫 번째 스냅샷 (이전 없음) | 모든 토큰을 added로 표시 |
| 구 스냅샷 (diffSummary 숫자만) | `tokensData` 비교로 on-demand 계산 |
| `tokensData`가 없는 스냅샷 | 숫자 요약만 표시, 상세 불가 안내 |
| 스냅샷 없음 | 빈 상태 메시지 ("아직 sync 이력이 없습니다") |

---

## 8. 비범위

- 특정 버전으로 롤백 (기존 `rollbackSnapshotAction` 활용 — 별도 기능)
- 스냅샷 보존 정책 (개수 제한, 자동 삭제) — 추후
- 타입별 필터링 — 추후
- 검색 (토큰 이름으로 이력 검색) — 추후
