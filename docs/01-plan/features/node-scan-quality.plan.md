# node-scan-quality Plan

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 노드 순회가 fills/TEXT/FRAME 무차별 수집 → 색상 143개 중 의미있는 토큰 30% 미만, 타이포/간격/반경 0개. 생성 컴포넌트에 토큰 값이 하드코딩되어 재사용 불가 |
| **Solution** | Figma Named Styles 우선 추출 → 섹션 스코핑 → 패턴 필터 3-Layer + Bootstrap 5 방식 CSS 변수 Export |
| **Function UX Effect** | Community 파일에서 4종 토큰 정확 추출, `tokens.css` 한 파일로 모든 컴포넌트에 토큰 자동 반영 |
| **Core Value** | Professional/Starter 99% 사용자에게 실질적 토큰 품질 제공. 다크/라이트 모드 자동 지원 |

---

## 1. Bootstrap CSS 변수 아키텍처 분석

> 우리 프로젝트에 이미 Bootstrap 5 클론이 있음. 이 패턴을 그대로 채택한다.

### 1.1 Bootstrap 5 2-Tier 시스템

```
SCSS 변수 (컴파일 타임, 정적)          CSS 변수 (런타임, 동적)
────────────────────────────────────  ──────────────────────────────────
$primary: #3b82f6                  →  --bs-primary: #3b82f6
$theme-colors-rgb: map-loop(...)   →  --bs-primary-rgb: 59, 130, 246
$primary-bg-subtle: tint(10%)      →  --bs-primary-bg-subtle: #eff6ff
$primary-text-emphasis: shade(60%) →  --bs-primary-text-emphasis: #1d4ed8
```

**핵심 함수 (`_functions.scss`):**
```scss
// 1. HEX → "r, g, b" 변환
@function to-rgb($value) {
  @return red($value), green($value), blue($value);
}

// 2. CSS변수 + opacity 조합
@function rgba-css-var($identifier, $target) {
  @return rgba(var(--bs-#{$identifier}-rgb), var(--bs-#{$target}-opacity));
}
```

### 1.2 테마 색상당 5개 변수 (Bootstrap 패턴)

```css
:root {
  /* 1. 원본 HEX */
  --bs-primary: #3b82f6;

  /* 2. RGB 채널 (투명도 조합용) */
  --bs-primary-rgb: 59, 130, 246;

  /* 3. 텍스트 강조 (WCAG AA 보장, 어두운 shade) */
  --bs-primary-text-emphasis: #1d4ed8;

  /* 4. 배경 미묘 (8% opacity tint) */
  --bs-primary-bg-subtle: rgba(59, 130, 246, 0.08);

  /* 5. 테두리 미묘 (20% opacity) */
  --bs-primary-border-subtle: rgba(59, 130, 246, 0.2);
}
```

**사용 예:**
```scss
// 직접 색상
color: var(--bs-primary);

// 투명도 조합 (rgba-css-var 패턴)
background: rgba(var(--bs-primary-rgb), 0.1);
box-shadow: 0 0 0 3px rgba(var(--bs-primary-rgb), 0.25);

// 미묘 배경 (예: hover 상태)
background: var(--bs-primary-bg-subtle);
border: 1px solid var(--bs-primary-border-subtle);
```

### 1.3 다크 모드 패턴

```scss
// Bootstrap: [data-bs-theme="dark"]
// 우리 프로젝트: [data-theme="dark"] (globals.scss)

:root[data-theme="dark"] {
  --accent: #3b82f6;
  /* 현재: --accent-rgb 없음 ← 문제점 */
}
```

**현재 우리 프로젝트 문제:**
```scss
// token-views.module.scss 에서 workaround 발견:
background: rgba(var(--accent-rgb, 99, 102, 241), 0.1);
//                               ↑ 폴백값으로 버팀 (정의된 변수가 없으므로)
```
→ `globals.scss`에 `--accent-rgb`, `--danger-rgb` 등이 정의되지 않았음

### 1.4 컴포넌트 레벨 변수 (Bootstrap 패턴)

Bootstrap은 컴포넌트별 CSS 변수를 별도 선언:
```css
/* 버튼 컴포넌트 */
.btn {
  --bs-btn-padding-x: 0.75rem;
  --bs-btn-color: var(--bs-body-color);
  --bs-btn-bg: transparent;
  --bs-btn-border-color: transparent;
}
/* 변형(variant)에서 재정의 */
.btn-primary {
  --bs-btn-color: #fff;
  --bs-btn-bg: var(--bs-primary);
}
```
→ **런타임에 `element.style.setProperty('--bs-btn-bg', '#ff0000')` 가능**

---

## 2. 현재 PixelForge 문제점

### 2.1 노드 스캔 노이즈

| 토큰 타입 | 현재 동작 | 문제 |
|----------|----------|------|
| 색상 | 모든 SOLID fill 수집 | UI 컴포넌트 내부색 포함 (노이즈 70%+) |
| 타이포 | 모든 TEXT 노드 수집 | 버튼 레이블, 설명 텍스트 포함 |
| 간격 | padding/gap 있는 모든 FRAME | 레이아웃 컨테이너 포함 |
| 반경 | cornerRadius > 0 모든 노드 | 완전한 원, 임의 컴포넌트 포함 |

### 2.2 컴포넌트 생성 하드코딩 문제

```ts
// 현재: buildTokenContext() → 7개 변수 → SCSS에 값 직접 박힘
const scss = `
  .primary {
    background: ${ctx.primaryColor};  // ← #3b82f6 하드코딩
  }
`;
```

**결과:**
- 토큰 변경 시 컴포넌트 재생성 필요
- 다크/라이트 모드 대응 불가 (값 고정)
- 143개 색상 중 1개(primary)만 실제 활용

---

## 3. 해결 전략

### Part A: 3-Layer 추출 품질 개선

```
Layer 1: Figma Named Styles     ← 최우선 (Professional 플랜 동작)
  ↓ Named Style 없는 파일
Layer 2: 섹션 기반 스코핑        ← 중간 정확도
  ↓ 섹션 구조 없는 파일
Layer 3: 개선된 패턴 필터        ← 기존 방식 업그레이드
```

**Layer 1: Figma Named Styles 연동**

`FigmaFileResponse.styles`는 이미 api.ts에 정의됨. `FigmaNode`에 `fillStyleId`, `textStyleId` 추가하면 즉시 활용 가능:

```
file.styles = {
  "S:abc123": { name: "Primary/500", styleType: "FILL" },
  "S:def456": { name: "Heading/XL",  styleType: "TEXT" }
}

node.fillStyleId === "S:abc123" → 색상 토큰, 이름 = "Primary/500"
node.textStyleId === "S:def456" → 타이포 토큰, 이름 = "Heading/XL"
```

**Layer 2: 섹션 기반 스코핑**
```ts
const SECTION_PATTERNS = {
  color:      /^(color|colours?|palette|색상|팔레트)/i,
  typography: /^(typ(e|o|ography)?|font|text.?style|텍스트|타이포)/i,
  spacing:    /^(spacing|space|gap|간격|여백)/i,
  radius:     /^(radius|corner|rounded|반경|모서리)/i,
};
// 해당 섹션 직계 자식만 depth=2 스캔
```

**Layer 3: 패턴 필터**
```ts
// 색상: RECTANGLE/ELLIPSE만, "Rectangle 1" 같은 자동생성 이름 제거
// 타이포: fontSize 10~96px, 명명된 스타일 패턴
// 간격: layoutMode 있는 FRAME, 균일 padding 또는 gap만
// 반경: cornerRadius < min(w,h)/2 (원 제외), 0 < value <= 100
```

---

### Part B: Bootstrap 5 방식 CSS 변수 Export

**목표:** Figma에서 추출한 토큰을 `tokens.css`로 Export → 컴포넌트가 CSS 변수로 참조

#### B.1 생성 파일 구조

```css
/* === PixelForge Design Tokens ===
 * Source: [파일명]
 * Extracted: [날짜]
 * Method: styles-api | section-scan | node-scan
 */

:root {
  /* ── Colors ── */
  --pf-color-primary:                #3b82f6;
  --pf-color-primary-rgb:            59, 130, 246;
  --pf-color-primary-text:           #1d4ed8;        /* AA contrast */
  --pf-color-primary-bg-subtle:      rgba(59, 130, 246, 0.08);
  --pf-color-primary-border-subtle:  rgba(59, 130, 246, 0.2);

  --pf-color-gray-900:               #18181b;
  --pf-color-gray-900-rgb:           24, 24, 27;

  /* ── Typography ── */
  --pf-font-family-base:             'Pretendard', system-ui, sans-serif;
  --pf-font-size-heading-xl:         3rem;
  --pf-font-weight-heading-xl:       700;
  --pf-line-height-heading-xl:       1.2;

  --pf-font-size-body-md:            1rem;
  --pf-font-weight-body-md:          400;
  --pf-line-height-body-md:          1.5;

  /* ── Spacing ── */
  --pf-spacing-1:   4px;
  --pf-spacing-2:   8px;
  --pf-spacing-3:   16px;
  --pf-spacing-4:   24px;

  /* ── Border Radius ── */
  --pf-radius-none: 0;
  --pf-radius-sm:   4px;
  --pf-radius-md:   8px;
  --pf-radius-lg:   16px;
  --pf-radius-full: 9999px;
}

/* Dark mode overrides (Figma Dark 모드 토큰 존재 시 자동 생성) */
[data-theme="dark"] {
  --pf-color-primary:     #60a5fa;
  --pf-color-primary-rgb: 96, 165, 250;
}
```

#### B.2 네이밍 변환 규칙

| Figma 토큰 이름 | CSS 변수 |
|----------------|---------|
| `Primary/500`  | `--pf-color-primary-500` + `--pf-color-primary-500-rgb` |
| `Gray/900`     | `--pf-color-gray-900` + `--pf-color-gray-900-rgb` |
| `Heading/XL`   | `--pf-font-size-heading-xl`, `--pf-font-weight-heading-xl` |
| `spacing/4`    | `--pf-spacing-4` |
| `radius/sm`    | `--pf-radius-sm` |

변환 규칙: `슬래시(/) → 하이픈(-)`, 대문자 → 소문자, 공백 → 하이픈

#### B.3 컴포넌트 생성 방식 전환

```scss
/* 기존 (하드코딩) */
.primary {
  background: #3b82f6;     /* ← 값 직접 박힘 */
}

/* 신규 (CSS 변수 참조) */
.primary {
  background: var(--pf-color-primary);
  color: var(--pf-color-primary-text, #fff);
  /* hover: opacity 조합 */
  &:hover {
    background: rgba(var(--pf-color-primary-rgb), 0.9);
  }
}
```

#### B.4 globals.scss `-rgb` 변수 보완

추출과 무관하게 현재 `globals.scss`에 `-rgb` 변수가 누락된 문제도 함께 수정:

```scss
/* 추가 필요 */
:root[data-theme="dark"] {
  --accent-rgb:   59, 130, 246;   /* #3b82f6 */
  --danger-rgb:   248, 113, 113;  /* #f87171 */
  --warning-rgb:  251, 191, 36;   /* #fbbf24 */
  --success-rgb:  52, 211, 153;   /* #34d399 */
}
:root[data-theme="light"] {
  --accent-rgb:   37, 99, 235;    /* #2563eb */
  --danger-rgb:   220, 38, 38;    /* #dc2626 */
  --warning-rgb:  217, 119, 6;    /* #d97706 */
  --success-rgb:  5, 150, 105;    /* #059669 */
}
```

---

## 4. 전체 흐름

```
extractTokensAction()
  │
  ├─ Variables API (Enterprise) → 성공 시 기존 로직
  │
  └─ Node Scan v2
       ├─ Layer 1: file.styles 기반 Named Style 추출
       ├─ Layer 2: 섹션 탐지 → 스코핑 추출
       └─ Layer 3: 패턴 필터 전체 순회
            │
            └─ SQLite 저장 (기존 스키마 유지)
                 source: 'styles-api' | 'section-scan' | 'node-scan'
                 │
                 └─ CSS Export (신규)
                      generateTokensCss(tokens) → tokens.css
                      [data-theme="dark"] 블록 자동 생성 (mode 필드 활용)
```

---

## 5. 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/figma/api.ts` | `FigmaNode`에 `fillStyleId`, `textStyleId`, `layoutMode`, `absoluteBoundingBox` 추가 |
| `src/lib/tokens/extractor.ts` | 3-Layer 추출 로직 전면 개선, `StyleMap` 파라미터 추가 |
| `src/lib/actions/project.ts` | `file.styles` → extractor 전달, `source` 타입 확장 |
| `src/lib/tokens/css-exporter.ts` | **신규** — tokens → CSS 변수 문자열 생성기 |
| `src/lib/actions/tokens.ts` | CSS Export 액션 추가 (`exportTokensCssAction`) |
| `src/app/(ide)/tokens/[type]/TokenPageActions.tsx` | "CSS Export" 버튼 추가 |
| `src/styles/globals.scss` | `--accent-rgb`, `--danger-rgb` 등 `-rgb` 변수 추가 |

---

## 6. 비기능 요건

- DB 스키마 변경 없음 (`source` 필드 값 추가만)
- `tokens.css` Export는 클립보드 복사 또는 파일 다운로드 방식
- 성능: 전체 스캔 5초 이내 유지
- WCAG: `--pf-color-*-text` 는 AA 기준 자동 계산 (4.5:1+)

---

## 7. 성공 기준

| 기준 | 목표 |
|------|------|
| 색상 추출 정확도 | Named Style 파일에서 노이즈 < 20% |
| 타이포 추출 | Text Style 정의 파일에서 0개 → N개 |
| CSS Export | `tokens.css` 복사/다운로드 가능 |
| Dark mode | Figma Light/Dark 모드 → `[data-theme="dark"]` 블록 자동 생성 |
| globals.scss | `-rgb` 변수 누락 해결 → 기존 workaround 코드 제거 |

---

## 8. 구현 순서

1. `globals.scss` — `-rgb` 변수 누락 수정 (15분, 즉시 효과)
2. `api.ts` — FigmaNode 타입 확장 (30분)
3. `extractor.ts` — Layer 1 Named Styles 기반 추출 (2시간)
4. `extractor.ts` — Layer 2 섹션 스코핑 (1시간)
5. `extractor.ts` — Layer 3 패턴 필터 개선 (1시간)
6. `project.ts` — styles 전달, source 타입 확장 (30분)
7. `css-exporter.ts` — Bootstrap 5 패턴 CSS 변수 생성기 (2시간)
8. `tokens.ts` — exportTokensCssAction 추가 (30분)
9. `TokenPageActions.tsx` — CSS Export 버튼 (30분)
