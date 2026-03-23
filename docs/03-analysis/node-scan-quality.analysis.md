# node-scan-quality Gap Analysis

**Date:** 2026-03-23
**Feature:** node-scan-quality
**Phase:** Act-1 (Iteration Complete)

---

## Match Rate: 100% (31/31)

---

## 체크포인트 결과

### Section 2: 타입 확장 (4/4) ✅

| # | 항목 | 결과 |
|---|------|------|
| 1 | FigmaNode: fillStyleId, textStyleId, layoutMode, absoluteBoundingBox | ✅ |
| 2 | StyleInfo / StyleMap 타입 export | ✅ |
| 3 | ExtractResult 인터페이스 (tokens + source) | ✅ |
| 4 | TokenRow / ExtSource source 4종 확장 | ✅ |

### Section 3: 3-Layer 추출 (12/12) ✅

| # | 항목 | 결과 |
|---|------|------|
| 5 | extractTokens(rootNode, styleMap?) 시그니처 | ✅ |
| 6 | 3-Layer 우선순위 로직 (styles→section→pattern) | ✅ |
| 7 | Layer 1: hasNamedStyles() | ✅ |
| 8 | Layer 1: extractByNamedStyles() (colors + typography) | ✅ |
| 9 | Layer 1: normalizeStyleName() prefix 제거 | ✅ |
| 10 | Layer 2: SECTION_PATTERNS 4종 | ✅ |
| 11 | Layer 2: typography/spacing/radius 섹션 추출 | ✅ **Fixed** |
| 12 | Layer 3: NOISE_NAMES 색상 필터 | ✅ |
| 13 | Layer 3: NOISE_TEXT + VALID_FONT_SIZE 타이포 필터 | ✅ |
| 14 | Layer 3: hasLayoutMode spacing 필터 | ✅ |
| 15 | Layer 3: isUniformPadding 조건 | ✅ **Fixed** |
| 16 | Layer 3: isCircle radius 필터 | ✅ |

### Section 4: CSS Exporter (8/8) ✅

| # | 항목 | 결과 |
|---|------|------|
| 17 | toCssVarName() + TYPE_PREFIX 매핑 | ✅ |
| 18 | generateColorVars() Bootstrap 5 5-variable 패턴 | ✅ |
| 19 | generateTypoVars() (family/size/weight/lh/ls) | ✅ |
| 20 | generateSpacingVars() | ✅ |
| 21 | generateRadiusVars() | ✅ |
| 22 | splitByMode() light/dark/single | ✅ |
| 23 | :root + [data-theme="dark"] 블록 생성 | ✅ |
| 24 | 헤더 주석 (Source, Method, Total) | ✅ |

### Section 5: globals.scss -rgb (2/2) ✅

| # | 항목 | 결과 |
|---|------|------|
| 25 | --accent-rgb / --danger-rgb 등 6종 추가 | ✅ |
| 26 | SCSS 모듈 hardcoded fallback 제거 | ✅ |

### Section 6-7: project.ts + exportAction (3/3) ✅

| # | 항목 | 결과 |
|---|------|------|
| 27 | buildStyleMap() + styleMap 전달 | ✅ |
| 28 | source 4단계 propagation | ✅ |
| 29 | exportTokensCssAction() | ✅ |

### Section 8: TokenPageActions UI (3/3) ✅

| # | 항목 | 결과 |
|---|------|------|
| 30 | CSS 복사 / 다운로드 버튼 (2개) | ✅ |
| 31 | 오류 시 에러 토스트 | ✅ **Fixed** |

---

## Gap 수정 내역 (Act-1)

### GAP-1: Layer 2 섹션 스코핑 — typography/spacing/radius 추출 추가 ✅

**파일:** `extractor.ts` `extractBySectionScope()`

`extractSingleNodeTypo()`, `extractSingleNodeSpacing()`, `extractSingleNodeRadius()` 함수 구현 후
`extractBySectionScope()` 내 분기 로직에 연결.

### GAP-2: Layer 3 — isUniformPadding 조건 추가 ✅

**파일:** `extractor.ts` `traverseSpacing()`

균일 패딩(top===bottom AND left===right) 또는 균일 gap만 추출하도록 조건 추가:
```ts
const isUniformPadding = (pt === pb && pl === pr) || (pt === pr && pr === pb && pb === pl);
if ((hasPadding && isUniformPadding) || hasGap) { ... }
```

### GAP-3: CSS Export 오류 토스트 구현 ✅

**파일:** `TokenPageActions.tsx`

`ToastContainer` 및 `addToast()` 로컬 상태 추가.
`handleExportCopy()` / `handleExportDownload()` 오류 시 `danger` 토스트 표시.

---

## 판정

| 지표 | 수치 |
|------|------|
| 총 체크포인트 | 31 |
| 구현 완료 | 31 |
| Gap | 0 |
| **Match Rate** | **100%** |

Act-1 이터레이션으로 3개 Gap 모두 해결. Match Rate 90.3% → 100%.
