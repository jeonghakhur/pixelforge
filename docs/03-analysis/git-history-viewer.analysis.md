# git-history-viewer Gap Analysis Report

> **Analysis Type**: Gap Analysis (PDCA Check Phase — Re-analysis after UX Pivot)
>
> **Project**: PixelForge
> **Analyst**: gap-detector
> **Date**: 2026-03-24 (v2 — post UX pivot)
> **Design Doc**: `docs/02-design/features/git-history-viewer.design.md`

---

## Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match | 88% | Pass |
| Architecture Compliance | 95% | Pass |
| Convention Compliance | 90% | Pass |
| **Overall** | **91%** | **Pass** |

---

## 1. 분석 배경

이 분석은 최초 분석(v1, 92%) 이후 사용자 요청으로 UX가 변경된 내용을 반영합니다.

**변경된 UX (의도적 피벗):**
- 체크박스 2개 선택 → "비교" 클릭 플로우 **제거**
- 커밋 단일 클릭 → 부모 대비 diff 모달 표시로 변경
- InlineCodePanel + 2컬럼 레이아웃 **제거**

---

## 2. 파일 구조 현황

```
src/
├── lib/
│   └── screens/
│       └── git-history.ts              ✅ (+ getCommitParentDiff 추가)
├── lib/actions/
│   └── screens.ts                      ✅ (+ getCommitParentDiffAction 추가)
└── app/(ide)/screens/
    ├── ScreenDrawer.tsx                 ✅ (체크박스 제거, modalHash 방식)
    ├── CodeViewModal.tsx                ✅ (mode: 'source'|'diff'|'commit')
    ├── CodeViewModal.module.scss        ✅ (GitHub Dark 테마)
    ├── InlineCodePanel.tsx              ⚠️  (미사용 — ScreenDrawer에서 제거됨)
    └── InlineCodePanel.module.scss      ⚠️  (미사용)
```

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 Data Layer (git-history.ts)

| Design Function | Implementation | Status | Notes |
|----------------|---------------|:------:|-------|
| `getCommitSource(filePath, hash)` | ✅ 일치 | Pass | |
| `getCommitDiff(filePath, hashA, hashB)` | ✅ 일치 | Pass | `parseInt(tsA, 10)` 명시적 radix |
| `GitCommit` type export | ✅ 일치 | Pass | |
| — (설계 외) | `getCommitParentDiff()` 추가 | Pass+ | GitHub 방식 단일 커밋 diff |

### 2.2 Server Actions (screens.ts)

| Design Action | Implementation | Status | Notes |
|--------------|---------------|:------:|-------|
| `getCommitSourceAction()` | ✅ 일치 | Pass | LANG_MAP 모듈 레벨 상수로 추출 |
| `getCommitDiffAction()` | ✅ 일치 | Pass | |
| — (설계 외) | `getCommitParentDiffAction()` 추가 | Pass+ | |

### 2.3 ScreenDrawer.tsx — UX 피벗 (의도적 변경)

| 설계 항목 | 구현 상태 | 판정 | 비고 |
|-----------|-----------|------|------|
| `selectedHashes` state | ❌ 제거 | 피벗 | |
| `codeViewMode` state | ❌ → `modalHash: string\|null` | 피벗 | 단순화 |
| `codeViewHash` state | ❌ 제거 | 피벗 | |
| `handleHashToggle` | ❌ 제거 | 피벗 | |
| `handleCompare` | ❌ 제거 | 피벗 | |
| `handleCommitClick` | ✅ `setModalHash(hash)` | Pass | 단순화 |
| 체크박스 UI | ❌ 제거 | 피벗 | |
| compareBar | ❌ 제거 | 피벗 | |
| isWide 넓이 토글 | ✅ 유지 | Pass | 서랍 너비만 조절 |
| 2컬럼 레이아웃 (drawerCols) | ❌ 제거 | 피벗 | |
| InlineCodePanel 연동 | ❌ 제거 | 피벗 | |
| CodeViewModal `mode="commit"` | ✅ 구현 | Pass+ | 설계 외 추가 |

**판정: 의도적 UX 피벗 완료. 핵심 목표(커밋 코드 확인) 달성.**

### 2.4 CodeViewModal.tsx

| 설계 항목 | 구현 상태 | 판정 | 비고 |
|-----------|-----------|------|------|
| `mode: 'source' \| 'diff'` | `'source' \| 'diff' \| 'commit'` 추가 | Pass+ | |
| Props 인터페이스 | ✅ 일치 (+ mode 확장) | Pass | |
| Portal to `document.body` | ✅ 일치 | Pass | |
| ESC 닫기 + 포커스 관리 | ✅ 일치 | Pass | |
| body 스크롤 차단 | ✅ 일치 | Pass | |
| 복사 버튼 | ✅ Raw/Copied! | Pass | 라벨 영문 변경 |
| 소스: `hljs.highlightAuto` + `<pre>` | `hljs.highlight(lang)` + 라인번호 테이블 | Pass+ | 개선 |
| diff: `Diff2Html.html()` + innerHTML | `Diff2HtmlUI.draw()` + `useRef` | Pass+ | 개선 |
| diff 기본값: `side-by-side` | `line-by-line` | Changed | 의도적 변경 |
| 단일 헤더 바 | commitBar + toolbar 2단 | Pass+ | GitHub 스타일 |
| WCAG AA ARIA | ✅ 일치 | Pass | |
| hljs 언어 3종 | 6종 등록 | Pass+ | 추가 |

### 2.5 CodeViewModal.module.scss

| 설계 항목 | 구현 상태 | 판정 | 비고 |
|-----------|-----------|------|------|
| CSS 변수 (`var(--bg-elevated)` 등) | GitHub Dark 하드코딩 (`$gh-*`) | ⚠️ | 테마 이탈 |
| 모달 크기: `82vw/1280px` × `82vh` | `88vw/1400px` × `88vh` | Pass | 더 넓게 |
| 오버레이: `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.72)` + `blur(4px)` | Pass | 강화 |
| diff2html 오버라이드 | ✅ 구현 (GitHub Dark 팔레트) | Pass | |
| `.codeBlock` (`<pre>`) | `.codeTable` + `.lineNum` + `.codeLine` | Pass+ | 개선 |

### 2.6 DoD 체크리스트

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| 1 | 커밋 클릭 → 모달 열림 | ✅ | commit 모드 diff |
| 2 | highlight.js 신택스 하이라이팅 | ✅ | source + Diff2HtmlUI |
| 3 | 소스 복사 버튼 | ✅ | |
| 4 | 체크박스 2개 → compareBar | ❌ | **의도적 제거** |
| 5 | "비교" 버튼 → diff 모달 | ❌ | **의도적 제거** |
| 6 | diff2html Side-by-side 기본 | ⚠️ | line-by-line으로 변경 |
| 7 | Line-by-line 토글 | ✅ | |
| 8 | diff Raw 복사 버튼 | ✅ | |
| 9 | ESC / 오버레이 닫기 | ✅ | |
| 10 | body 스크롤 차단 | ✅ | |
| 11 | 로딩 / 에러 상태 | ✅ | |
| 12 | WCAG AA dialog ARIA | ✅ | |

**9/12 Pass** — 3개 항목 의도적 피벗 (버그 아님)

---

## 3. 설계 초과 구현

| 항목 | 파일 | 내용 |
|------|------|------|
| `getCommitParentDiff()` | git-history.ts | GitHub 방식 단일 커밋 diff |
| `getCommitParentDiffAction()` | screens.ts | 위의 Server Action |
| `mode="commit"` | CodeViewModal.tsx | 커밋 클릭 시 부모 diff 모달 |
| 라인 번호 테이블 | CodeViewModal.tsx/.module.scss | hover 하이라이트 포함 |
| Diff2HtmlUI 렌더러 | CodeViewModal.tsx | `highlight: true` TypeScript/SCSS 지원 |
| 단어 레벨 diff 강조 | CodeViewModal.module.scss | `<ins>`/`<del>` rgba 배경 |
| commitBar + toolbar 2단 헤더 | CodeViewModal.tsx | GitHub 스타일 커밋 메타 표시 |

---

## 4. 아키텍처 준수

| 레이어 | 파일 | 상태 |
|--------|------|------|
| Infrastructure | `src/lib/screens/git-history.ts` | ✅ |
| Application | `src/lib/actions/screens.ts` | ✅ |
| Presentation | `ScreenDrawer.tsx`, `CodeViewModal.tsx` | ✅ |

**아키텍처 스코어: 95%**

Minor: Presentation 컴포넌트가 `GitCommit` 타입을 인프라 레이어에서 직접 import.
Actions 레이어에서 re-export 고려.

---

## 5. 컨벤션 준수

| 항목 | 결과 |
|------|------|
| `console.log` | 없음 ✅ |
| `any` 타입 | 없음 ✅ |
| `div onClick` | 없음, `<button>` 정확히 사용 ✅ |
| 컴포넌트 300줄 이내 | ScreenDrawer.tsx: 370줄 ⚠️ (이전 507줄에서 감소) |
| ARIA 속성 | ✅ |
| Solar 아이콘 | ✅ |
| SCSS 모듈 | ✅ |

**컨벤션 스코어: 90%**
감점: ScreenDrawer.tsx 300줄 초과 (370줄), InlineCodePanel 미사용 잔존

---

## 6. 잔여 Gap 및 권고

### Priority 1 — InlineCodePanel 정리 (권고)
```
src/app/(ide)/screens/InlineCodePanel.tsx        — ScreenDrawer에서 제거됨, 미사용
src/app/(ide)/screens/InlineCodePanel.module.scss — 동일
```
두 파일이 ScreenDrawer에서 import 제거되었으나 파일 자체는 잔존.
삭제하거나 향후 재사용 계획이 있다면 별도 보관.

### Priority 2 — SCSS 테마 일관성 (권고)
- `CodeViewModal.module.scss`의 `$gh-*` 변수가 하드코딩됨
- 프로젝트 다크 테마와 별개로 항상 GitHub Dark 고정
- `InlineCodePanel.module.scss`에도 동일한 `$gh-*` 변수 중복 정의
- 공통 `_code-theme.scss` partial로 추출 권고

### Priority 3 — ScreenDrawer 컴포넌트 분리 (권고)
- `ScreenDrawer.tsx`: 370줄 (300줄 기준 초과)
- `GitTimelineSection.tsx` 추출 시 ~100줄 감소 예상

### Priority 4 — hljs 등록 중복 (개선)
- `CodeViewModal.tsx`, `InlineCodePanel.tsx` 양쪽에서 동일 언어 등록
- `registerHighlightLanguages()` 공통 유틸로 추출

---

## 7. 최종 판정

```
[Plan] ✅ → [Design] ✅ → [Do] ✅ → [Check] ✅ (91%)
```

| 분류 | 수 | 내용 |
|------|----|----|
| 완전 일치 | 18 | 인프라, 액션, 모달 핵심 기능 |
| 의도적 피벗 | 3 | 체크박스 UX, InlineCodePanel 제거, Side-by-side→Line-by-line |
| 설계 초과 구현 | 7 | getCommitParentDiff, commit 모드, 라인번호, Diff2HtmlUI 등 |
| 잔여 Gap | 3 | SCSS 테마 하드코딩, InlineCodePanel 미사용 잔존, 370줄 초과 |

**Match Rate: 91%** — 리포트 작성 조건 충족 (≥90%)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-24 | Initial gap analysis (92%) | gap-detector |
| 2.0 | 2026-03-24 | Re-analysis after UX pivot (checkbox 제거, commit mode 반영) | gap-detector |
