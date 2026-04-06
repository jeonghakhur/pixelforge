# Design: Button Generator v2

_Untitled UI 디자인 시스템(Figma Variables + COMPONENT_SET) 기반 버튼 컴포넌트 생성기_

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | 현재 button.ts는 Primary.node.json(단일 variant, hex 색상, 3차원) 구조에 최적화됨. Untitled UI 기반 Button.node.json(5 hierarchy, Figma Variables, 4차원, Loading state) 구조를 처리할 수 없음 |
| Solution | 스타일 추출 레이어 추가, state 이름 정규화, 다차원 appearance 지원, css-var-mapper를 Untitled UI 토큰 체계에 맞게 확장 |
| Function UX Effect | Untitled UI Button COMPONENT_SET JSON 임포트 → hierarchy/size/state/icon 조합별 TSX+CSS 자동 생성 |
| Core Value | 기존 Primary.node.json 호환 유지하면서 Untitled UI 급 디자인 시스템 컴포넌트를 한번에 생성 |

---

## Overview

| 항목 | 내용 |
|------|------|
| Feature | button-generator-v2 |
| Goal | Untitled UI 토큰+컴포넌트 JSON → 완전한 React Button 컴포넌트 생성 |
| Core Value | 다차원 variant + Figma Variables + 토큰 파이프라인 일관 연동 |
| Updated | 2026-04-06 |

---

## 1. 입력 데이터 분석

### 1-1. Button.node.json (118KB, 새 구조)

```
nodeType: COMPONENT
name: Buttons/Button
detectedType: layout (주의: button이 아님)
```

**4개 차원, 200개 variants:**

| 차원 | 값 | 역할 |
|------|-----|------|
| size (5) | xs, sm, md, lg, xl | 레이아웃 (padding, gap) |
| hierarchy (5) | Primary, Secondary, Tertiary, Link color, Link gray | appearance (색상 스킴) |
| state (5) | Default, Hover, Focused, Disabled, Loading | 인터랙션 상태 |
| icon only (2) | False, True | 아이콘 전용 모드 |

누락 50개: Link color/gray × icon only=True (Figma에서 의도적 제외)

**스타일 위치:** `variant.styles`에 직접 존재 (기존 구조와 동일)

```typescript
// Primary, Default, md, icon=False
variant.styles = {
  'background-color': 'var(--colors-brand-600)',
  'border-radius': '8px',
  'display': 'flex',
  'gap': '4px',
  'padding': '10px 14px 10px 14px'
}
```

**hierarchy별 색상 패턴:**

| hierarchy | bg (Default) | border | hover bg | disabled |
|-----------|-------------|--------|----------|----------|
| Primary | `var(--colors-brand-600)` | 없음 | `var(--colors-brand-700)` | 동일 bg + opacity:0.5 |
| Secondary | `var(--colors-base-white)` | `1px solid var(--colors-neutral-300)` | `var(--colors-neutral-50)` | 동일 + opacity:0.5 |
| Tertiary | 없음 (투명) | 없음 | `var(--colors-neutral-50)` | opacity:0.5 |
| Link color | 없음 | 없음 | childStyles Text bg 변경 | opacity:0.5 |
| Link gray | 없음 | 없음 | childStyles Text bg 변경 | opacity:0.5 |

**childStyles 키:**

| 키 | 역할 | 주요 속성 |
|----|------|----------|
| `placeholder` | 아이콘 슬롯 | opacity (0.6~0.7) |
| `Text padding` | 텍스트 래퍼 | display, padding |
| `Text` | 텍스트 노드 (Link 계열만) | background-color (텍스트 색상) |
| `Buttons/Button loading icon` | 로딩 스피너 (Loading state만) | opacity |

**icon only=True 차이:**
- gap 제거, padding 정사각 (10px 10px)
- `Text padding` childStyles 사라짐

**fullNode 자식 구조:**
```
COMPONENT
├── INSTANCE "placeholder" (leading icon 슬롯)
├── FRAME "Text padding"
│   └── TEXT "Button CTA" (fontSize=14, Inter Semi Bold, fill=#ffffff bound=VariableID)
└── INSTANCE "placeholder" (trailing icon 슬롯)
```

### 1-2. 토큰 파일 (Untitled UI Variables v8.0)

**7개 Collection, 691개 변수:**

| Collection | 변수 수 | 모드 | 역할 |
|------------|---------|------|------|
| _Primitives | 343 | Style | 원시 색상 팔레트 (Colors/Brand/600 등) |
| 1. Color modes | 273 | Light/Dark | 시맨틱 색상 (Background, Text, Foreground) |
| 2. Radius | 11 | Value | radius-none ~ radius-full |
| 3. Spacing | 17 | Value | Spacing/0 ~ Spacing/16 |
| 4. Widths | 12 | Mode 1 | 컨테이너 너비 |
| 5. Containers | 3 | Value | 컨테이너 max-width |
| 6. Typography | 32 | Value | 폰트 크기/행간 |

**CSS 변수 변환 규칙 (플러그인 → CSS):**
```
Figma: Colors/Brand/600
CSS:   var(--colors-brand-600)
규칙:  '/' → '-', 첫 글자 소문자화
```

**Button이 사용하는 토큰 매핑:**

| CSS 변수 | Figma Variable | Primitives 값 |
|----------|---------------|---------------|
| `--colors-brand-600` | Colors/Brand/600 | #7e56d8 |
| `--colors-brand-700` | Colors/Brand/700 | #6840c6 |
| `--colors-base-white` | Colors/Base/white | #ffffff |
| `--colors-neutral-300` | Colors/Neutral/300 | #d4d4d4 |
| `--colors-neutral-50` | Colors/Neutral/50 | #fafafa |
| `--colors-neutral-600` | Colors/Neutral/600 | #525252 |

**Radius 토큰:**

| 토큰 이름 | px 값 | Button 사용 |
|-----------|-------|------------|
| radius-md | 8px | 전 사이즈 공통 |

**Typography:**
- 폰트: Inter (Regular, Medium, Semi Bold, Bold)
- Text styles: Text sm ~ Text xl (14px ~ 20px)

---

## 2. 현재 코드와의 Gap 분석

### 2-1. button.ts 수정 필요 항목

| # | 현재 | 필요 | 영향 범위 |
|---|------|------|----------|
| G1 | `classifyDimensions()`가 `icon only` 미인식 | 공백 포함 키 처리 + icon 카테고리 추가 | classifyDimensions ~5줄 |
| G2 | state 이름 `rest/hover/press/disabled` 하드코딩 | JSON 구조의 state 값(Default/Hover/Focused/Disabled/Loading)을 그대로 사용. CSS 셀렉터도 데이터 기반 생성 | buildSingleSchemeCSS/buildMultiSchemeCSS state→CSS 매핑 테이블 |
| G3 | appearance 1개만 처리 | `hierarchy`를 appearance로, 나머지 그대로 | 기존 로직 호환 |
| G4 | `press` 상태 CSS 생성 | Untitled UI에는 press 없음 → 있을 때만 생성 | buildSingleSchemeCSS/buildMultiSchemeCSS null 체크 (이미 있음) |
| G5 | Loading state 미지원 | loading spinner CSS + data-loading 속성 | 신규 ~15줄 |
| G6 | icon only 차원 미지원 | `data-icon-only` 속성 + 정사각 padding CSS | 신규 ~10줄 |
| G7 | Focused state 미지원 | `:focus-visible` 이미 base에 있지만 bg 변경 필요 | 색상 추출 확장 ~5줄 |

### 2-2. css-var-mapper.ts 수정 필요 항목

| # | 현재 | 필요 |
|---|------|------|
| M1 | `colors-gray-*` → 시맨틱 매핑만 존재 | `colors-brand-*`, `colors-neutral-*`, `colors-base-*`, `colors-error-*` 패턴 추가 |
| M2 | px→토큰: `4px→var(--radius-4)`, `8px→var(--radius-8)` | Untitled UI: `8px→var(--radius-md)`, `4px→var(--radius-xs)` 등 시맨틱 이름 |
| M3 | prefix `color-` 추가 규칙 | Untitled UI는 `var(--colors-brand-600)` 그대로 사용, prefix 불필요 |

### 2-3. engine.ts 수정 필요

| # | 현재 | 필요 |
|---|------|------|
| E1 | `detectedType === 'button'`만 라우팅 | `detectedType === 'layout'`이면서 name에 `Button` 포함 시에도 라우팅 |

### 2-4. normalize-payload.ts 수정 필요

| # | 현재 | 필요 |
|---|------|------|
| N1 | `Buttons/Button` → PascalCase 변환 시 슬래시 처리 없음 | 슬래시 있으면 마지막 세그먼트 추출 (`Buttons/Button`→`Button`), 없으면 그대로 PascalCase (`Primary`→`Primary`) |

### 2-5. types.ts 수정 필요

| # | 현재 | 필요 |
|---|------|------|
| T1 | `WarningCode`에 미지원 state 관련 없음 | `UNKNOWN_STATE` 추가 (STATE_CSS_MAP에 없는 state 경고) |

### 2-6. a11y/button.ts 수정 필요

| # | 현재 | 필요 |
|---|------|------|
| A1 | `BUTTON_VARIANTS` = Primary/Secondary/Default/Outline/Invisible | Untitled UI: Primary/Secondary/Tertiary/Link color/Link gray |
| A2 | `BUTTON_SIZES` = xsmall/small/medium/large/xlarge | Untitled UI: xs/sm/md/lg/xl |

---

## 3. 설계

### 3-1. State를 데이터 기반으로 처리

**원칙: JSON 구조의 state 값을 정규화하지 않고 그대로 사용한다.**

현재 button.ts는 `rest/hover/press/disabled` 4개를 하드코딩하고 있다. 이를 variants 데이터에 실제로 존재하는 state 값을 기반으로 CSS를 동적 생성하도록 변경한다.

```typescript
// state 값 → CSS 셀렉터 매핑 테이블
// 데이터에 있는 state만 CSS가 생성됨. 없는 state는 건너뜀.
const STATE_CSS_MAP: Record<string, { selector: string; extra?: string }> = {
  // 기존 구조 호환 (Primary.node.json)
  'rest':     { selector: '' },                                          // base rule
  'hover':    { selector: ':hover:not([data-disabled])' },
  'press':    { selector: ':active:not([data-disabled])', extra: 'transform: scale(0.98);' },
  'disabled': { selector: '[data-disabled]', extra: 'cursor: not-allowed;\n  pointer-events: none;' },
  // Untitled UI 구조 (Button.node.json)
  'default':  { selector: '' },                                          // base rule
  'hover':    { selector: ':hover:not([data-disabled])' },
  'focused':  { selector: ':focus-visible:not([data-disabled])' },
  'disabled': { selector: '[data-disabled]', extra: 'cursor: not-allowed;\n  pointer-events: none;' },
  'loading':  { selector: '[data-loading]', extra: 'pointer-events: none;' },
};
```

**동작 방식:**
1. `extractStateColorsByState()`가 variants에서 고유한 state 값 목록을 수집
2. 각 state에 대해 `STATE_CSS_MAP`에서 셀렉터를 조회
3. 매핑이 없는 state는 `[data-state='값']` 폴백 셀렉터 + `UNKNOWN_STATE` 경고
4. base rule(셀렉터 `''`)이 되는 state는 `rest` 또는 `default` (둘 다 지원)

**핵심: `rest`와 `default` 모두 base rule로 동작.** 어떤 구조가 오든 첫 번째로 발견되는 base state가 `.root {}` 규칙이 된다.

### 3-2. DimensionKeys 확장

```typescript
interface DimensionKeys {
  stateKey:       string | undefined;
  sizeKey:        string | undefined;
  blockKey:       string | undefined;
  iconOnlyKey:    string | undefined;   // 신규
  appearanceKeys: string[];
}

function classifyDimensions(variantOptions: Record<string, string[]>): DimensionKeys {
  const keys = Object.keys(variantOptions);
  const lower = (k: string) => k.toLowerCase().replace(/\s+/g, '');
  return {
    stateKey:       keys.find(k => lower(k) === 'state'),
    sizeKey:        keys.find(k => lower(k) === 'size'),
    blockKey:       keys.find(k => lower(k) === 'block'),
    iconOnlyKey:    keys.find(k => lower(k) === 'icononly'),  // "icon only" → "icononly"
    appearanceKeys: keys.filter(k =>
      !['state', 'size', 'block', 'icononly'].includes(lower(k)),
    ),
  };
}
```

### 3-3. State CSS 동적 생성

`buildSingleSchemeCSS()`와 `buildMultiSchemeCSS()`를 **state 루프 기반**으로 리팩토링:

```typescript
// 기존: rest, hover, press, disabled 각각 하드코딩
// 변경: stateMap의 모든 state를 STATE_CSS_MAP 기반으로 순회

for (const [state, style] of stateMap) {
  const mapping = STATE_CSS_MAP[state];
  if (!mapping) {
    // 알 수 없는 state → 폴백 셀렉터 + 경고
    warnings.push({ code: 'UNKNOWN_STATE', message: `'${state}' state의 CSS 셀렉터가 정의되지 않음`, value: state });
    continue;
  }
  // mapping.selector가 '' → base rule (.root)
  // mapping.selector가 있음 → .root + selector
  // mapping.extra → 추가 CSS 속성
}
```

**생성 예시 (Untitled UI Primary):**

```css
/* Default → base */
.root { background: var(--colors-brand-600); }

/* Hover */
.root:hover:not([data-disabled]) { background: var(--colors-brand-700); }

/* Focused */
.root:focus-visible:not([data-disabled]) { background: var(--colors-brand-600); }

/* Disabled */
.root[data-disabled] { opacity: 0.5; cursor: not-allowed; pointer-events: none; }

/* Loading */
.root[data-loading] { background: var(--colors-brand-700); pointer-events: none; }
```

### 3-4. icon only CSS 생성

```css
.root[data-icon-only] {
  padding: 10px;  /* 정사각 */
  gap: 0;
}
```

size별 icon only padding도 variants에서 추출:

| size | icon only padding |
|------|-------------------|
| xs | 6px |
| sm | 8px |
| md | 10px |
| lg | 10px |
| xl | 12px |

### 3-5. css-var-mapper.ts 확장

**변경 전략:** Untitled UI 토큰은 `var(--colors-brand-600)` 형태로 이미 시맨틱 경로를 포함하므로, **prefix 추가 없이 그대로 통과**시키는 것이 올바름.

```typescript
export function mapCssValue(value: string): string {
  return value.replace(/var\(--([^)]+)\)/g, (_, varName: string) => {
    // 1. 시맨틱 매핑 (기존 PixelForge 토큰 호환)
    if (SEMANTIC_MAP[varName]) {
      return `var(--${SEMANTIC_MAP[varName]})`;
    }
    // 2. Untitled UI 패턴: colors-brand-*, colors-neutral-*, colors-base-*, colors-error-*
    //    이미 시맨틱 경로 포함 → prefix 없이 그대로 통과
    if (varName.startsWith('colors-')) {
      return `var(--${varName})`;
    }
    // 3. 기존 Figma 토큰 prefix 추가 (PixelForge 호환)
    if (varName.startsWith('spacing-') || varName.startsWith('radius-')) {
      return `var(--color-${varName})`;
    }
    return `var(--${varName})`;
  });
}
```

**Radius 매핑 확장:**

```typescript
const PX_TO_RADIUS: Record<string, string> = {
  // Untitled UI 토큰 (시맨틱 이름)
  '0px':    'var(--radius-none)',
  '2px':    'var(--radius-xxs)',
  '4px':    'var(--radius-xs)',
  '6px':    'var(--radius-sm)',
  '8px':    'var(--radius-md)',
  '10px':   'var(--radius-lg)',
  '12px':   'var(--radius-xl)',
  '16px':   'var(--radius-2xl)',
  '20px':   'var(--radius-3xl)',
  '24px':   'var(--radius-4xl)',
  '9999px': 'var(--radius-full)',
};
```

### 3-6. engine.ts detectedType 보정

```typescript
function resolveDetectedType(payload: PluginComponentPayload): string {
  const { detectedType, name } = payload;
  // detectedType이 layout이지만 이름에 Button 포함 → button으로 보정
  if (detectedType === 'layout' && /button/i.test(name)) {
    return 'button';
  }
  return detectedType;
}

export function runComponentEngine(payload: PluginComponentPayload): EngineResult {
  const resolvedType = resolveDetectedType(payload);
  const generator = GENERATORS[resolvedType];
  // ...
}
```

### 3-7. normalize-payload.ts 이름 추출 보정

슬래시가 있으면 마지막 세그먼트를 추출하고, 없으면 그대로 PascalCase 변환한다. 어떤 입력이든 안전하게 처리:

```typescript
function extractComponentName(str: string): string {
  // 1. 슬래시가 있으면 마지막 세그먼트 추출
  //    "Buttons/Button" → "Button"
  //    "Components/Form/Input" → "Input"
  // 2. 슬래시가 없으면 원본 그대로
  //    "Primary" → "Primary"
  //    "Button" → "Button"
  const segment = str.includes('/') ? str.split('/').pop()! : str;
  return toPascalCase(segment);
}

function toPascalCase(str: string): string {
  return str
    .replace(/[_\-\s]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toUpperCase());
}
```

**입력 → 출력 예시:**

| 입력 | 출력 | 시나리오 |
|------|------|----------|
| `Buttons/Button` | `Button` | Untitled UI 구조 |
| `Primary` | `Primary` | 기존 Primary.node.json |
| `Button` | `Button` | 단순 이름 |
| `form-input` | `FormInput` | 케밥 케이스 |
| `Components/UI/Toggle Button` | `ToggleButton` | 깊은 경로 + 공백 |

### 3-8. TSX 템플릿 변경

```tsx
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  hierarchy?: ButtonHierarchy;  // 신규 (기존 appearance 대체)
  size?: ButtonSize;
  iconOnly?: boolean;           // 신규
  loading?: boolean;            // 신규
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      hierarchy = 'Primary',
      size = 'md',
      iconOnly = false,
      loading = false,
      disabled,
      children,
      className = '',
      type = 'button',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      data-size={size}
      data-hierarchy={hierarchy.toLowerCase().replace(/\s+/g, '-')}
      data-icon-only={iconOnly ? '' : undefined}
      data-loading={loading ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      aria-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {loading && <span className={styles.spinner} />}
      {children}
    </button>
  ),
);
```

### 3-9. 토큰 파일 → tokens.css 생성 연동

현재 `design-tokens/tokens.css`가 비어있음 (`/* 토큰이 없습니다. */`).

토큰 JSON에서 CSS 변수 파일을 생성하는 흐름:

```
토큰 JSON (Untitled UI)
  └→ _Primitives → :root { --colors-brand-600: #7e56d8; ... }
  └→ Color modes → [data-theme="light"] / [data-theme="dark"] 분기
  └→ Radius      → :root { --radius-md: 8px; ... }
  └→ Spacing     → :root { --spacing-1: 4px; ... }
  └→ Typography  → :root { --font-size-sm: 14px; ... }
```

**Button에서 사용하는 최소 토큰 세트:**

```css
:root {
  /* Brand */
  --colors-brand-600: #7e56d8;
  --colors-brand-700: #6840c6;
  --colors-brand-200: #e9d7fe;
  /* Neutral */
  --colors-neutral-50: #fafafa;
  --colors-neutral-300: #d4d4d4;
  --colors-neutral-600: #525252;
  /* Base */
  --colors-base-white: #ffffff;
  /* Error */
  --colors-error-600: /* Red/600 값 */;
  /* Radius */
  --radius-md: 8px;
}
```

이 부분은 **기존 토큰 추출 파이프라인**(token-extraction-by-type, variables-api 등)이 담당하며, button-generator-v2는 **생성된 CSS 변수를 참조**만 합니다. 연동 조건: `css-var-mapper.ts`의 매핑 규칙이 토큰 CSS의 변수 이름과 일치해야 함.

---

## 4. 파일별 변경 요약

| 파일 | 변경량 | 내용 |
|------|--------|------|
| `generators/button.ts` | ~50줄 수정/추가 | STATE_CSS_MAP 데이터 기반 CSS 생성, iconOnly, classifyDimensions 확장 |
| `css-var-mapper.ts` | ~20줄 수정 | colors- 패턴 통과, PX_TO_RADIUS Untitled UI 체계 |
| `engine.ts` | ~10줄 추가 | resolveDetectedType 함수 |
| `normalize-payload.ts` | ~5줄 수정 | extractComponentName 추가 (슬래시 유무 모두 처리) |
| `types.ts` | ~2줄 추가 | UNKNOWN_STATE warning code |
| `a11y/button.ts` | ~6줄 수정 | VARIANTS/SIZES 상수 업데이트 |
| **합계** | **~91줄** | 구조적 리팩토링 없이 확장 |

---

## 5. 하위 호환성

| 기존 입력 | 호환 | 이유 |
|-----------|------|------|
| Primary.node.json (hex, 3차원) | 유지 | STATE_CSS_MAP에 rest/hover/press/disabled 모두 정의됨. colors- prefix 없는 hex는 기존 경로. 이름에 `/` 없으면 extractComponentName이 그대로 통과 |
| SEMANTIC_MAP (colors-gray-*) | 유지 | 시맨틱 매핑 우선순위 변경 없음 |
| detectedType=button | 유지 | resolveDetectedType은 layout일 때만 보정 |

---

## 6. 구현 순서

| 순서 | 작업 | 의존 |
|------|------|------|
| 1 | `css-var-mapper.ts` 확장 (colors- 통과, radius 매핑) | 없음 |
| 2 | `button.ts` STATE_CSS_MAP + classifyDimensions 확장 | 없음 |
| 3 | `button.ts` hierarchy appearance CSS 생성 | #2 |
| 4 | `button.ts` state 루프 기반 CSS 동적 생성 + iconOnly + TSX | #2 |
| 5 | `engine.ts` resolveDetectedType | 없음 |
| 6 | `normalize-payload.ts` 슬래시 처리 | 없음 |
| 7 | `a11y/button.ts` 상수 업데이트 | 없음 |
| 8 | Button.node.json으로 통합 검증 | #1~#7 전부 |

---

## 7. 검증 기준

| # | 검증 항목 | 기대 결과 |
|---|----------|----------|
| V1 | Button.node.json 입력 → TSX 생성 | hierarchy/size/iconOnly/loading prop 포함, `<button>` 태그 |
| V2 | Button.node.json 입력 → CSS 생성 | 5 hierarchy × 5 state × 5 size 조합 스타일 포함 |
| V3 | Primary.node.json 입력 → 기존과 동일 출력 | 하위 호환 |
| V4 | CSS 내 색상 값 | `var(--colors-brand-600)` 형태 (hex 아님) |
| V5 | CSS 내 radius 값 | `var(--radius-md)` 형태 |
| V6 | UNMAPPED_COLOR 경고 | Figma Variables 바인딩된 값에는 경고 없음 |
| V7 | detectedType=layout + name=Buttons/Button | button 제너레이터로 라우팅됨 |
| V8 | Loading state CSS | `[data-loading]` 셀렉터 + pointer-events:none + aria-busy |
