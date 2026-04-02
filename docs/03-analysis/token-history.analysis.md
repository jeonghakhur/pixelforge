# token-history Gap Analysis

**Date**: 2026-04-02  
**Feature**: token-history  
**Design**: `docs/02-design/features/token-history.design.md`  
**Phase**: Check

---

## Executive Summary

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 90% | ✅ |
| Architecture Compliance | 95% | ✅ |
| Convention Compliance | 88% | ⚠️ |
| **Overall** | **91%** | ✅ |

**Verdict**: Match Rate >= 90%. Implementation faithfully delivers the design with several quality improvements. One convention violation (hardcoded hex colors) requires fixing.

---

## Matches (18/20)

All core features implemented correctly:

| Item | Location |
|------|----------|
| `diffSummary` stores token name lists | `pipeline.ts` |
| `SnapshotDiffEntry`, `SnapshotDetail`, `SnapshotInfo.diffCounts` types | `tokens.ts` |
| `getSnapshotDetailAction()` with new/old-format fallback | `tokens.ts` |
| `SnapshotHistory` UI: timeline, badges, chips, detail panel | `SnapshotHistory.tsx` |
| Empty state UI | `SnapshotHistory.tsx` |
| Legacy git-based files removed (5 files) | — |
| SCSS module at `(ide)/` root | `snapshot-history.module.scss` |
| Integration into `TokenDashboard.tsx` | `TokenDashboard.tsx:208` |

---

## Added (not in design, present in implementation)

| Item | Location | Assessment |
|------|----------|------------|
| `getActiveSnapshotListAction()` | `tokens.ts` | Useful wrapper, eliminates prop drilling |
| `DetailPanel` as separate sub-component | `SnapshotHistory.tsx:79-176` | Better separation of concerns |
| Race condition protection (`cancelled` flag) | `SnapshotHistory.tsx:85,95` | Quality improvement |
| `.detailLoading`, `.rawArrow`, `.emptyIcon` styles | SCSS | Required by enhanced UI |

---

## Changed (design vs implementation)

| Item | Design | Implementation | Impact |
|------|--------|----------------|--------|
| Integration point | `diff/page.tsx` | `TokenDashboard.tsx` | Medium — different page, better UX (user-confirmed) |
| State architecture | Flat in main component | `DetailPanel` child with own state | Low — improved |
| `.row` cursor style | `cursor: pointer` on row | Only on toggle button | Low |

---

## Missing

| Item | Impact |
|------|--------|
| `DiffSummaryItem` / `DiffSummaryData` interfaces with `satisfies` | Low — no runtime impact |

---

## Convention Violations 🚨

### Hardcoded hex colors in SCSS (CLAUDE.md: "CSS 변수만 사용, # 하드코딩 금지")

| Location | Hardcoded Value | Should Be |
|----------|----------------|-----------|
| `snapshot-history.module.scss:108` | `#4ade80` | CSS variable |
| `snapshot-history.module.scss:109` | `rgba(74, 222, 128, 0.12)` | CSS variable |
| `snapshot-history.module.scss:113` | `#f87171` | CSS variable |
| `snapshot-history.module.scss:114` | `rgba(248, 113, 113, 0.12)` | CSS variable |
| `snapshot-history.module.scss:118` | `#fb923c` | CSS variable |
| `snapshot-history.module.scss:119` | `rgba(251, 146, 60, 0.12)` | CSS variable |
| `snapshot-history.module.scss:190` | `#4ade80` | CSS variable |
| `snapshot-history.module.scss:191` | `#f87171` | CSS variable |
| `snapshot-history.module.scss:192` | `#fb923c` | CSS variable |

**Note**: Design document also specifies hardcoded hex values — both need updating.

---

## Recommended Actions

1. **[Required]** Replace hardcoded hex colors with CSS custom properties (`--diff-added`, `--diff-removed`, `--diff-changed`)
2. **[Optional]** Update design document to reflect: TokenDashboard integration, DetailPanel extraction, `getActiveSnapshotListAction` addition
3. **[Optional]** Add `DiffSummaryItem`/`DiffSummaryData` interfaces with `satisfies` to `pipeline.ts`
