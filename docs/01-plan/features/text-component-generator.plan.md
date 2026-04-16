# Plan — text-component-generator

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Untitled UI는 Text를 COMPONENT_SET이 아닌 Text Style로만 정의하므로, 플러그인 COMPONENT_SET 추출 방식으로는 Text 컴포넌트를 생성할 수 없다. 현재 Typography 토큰은 DB에 있지만 컴포넌트로 조합되지 않는다. |
| **Solution** | DB의 `--font-size-*`, `--line-height-*`, `--font-weight-*`, `--letter-spacing-*` 토큰을 읽어 `size`/`weight`/`color`/`as` props를 자동 도출하는 별도 Typography 전용 generator를 신설한다. |
| **Function/UX Effect** | 개발자가 `<Text size="display-xl" weight="semibold" color="primary" as="h1">` 형태로 디자인 토큰과 1:1 대응되는 타입 컴포넌트를 사용할 수 있다. 11개 size × 4 weight = 44개 조합이 CSS variables로 완전히 커버된다. |
| **Core Value** | 플러그인 재추출 없이 이미 수집된 Typography 토큰에서 컴포넌트를 생성. `tsx-builder.ts` 분기 금지 원칙을 지키면서 Button generator 패턴을 재사용한다. |

---

## 1. 배경 및 목표

### 문제
- Figma Untitled UI Typography 페이지(node `1023:36826`)는 COMPONENT_SET이 아닌 Text Style 쇼케이스 페이지
- 플러그인이 단일 TEXT 노드(`TypeSpecimenRegular`)만 추출하는 것은 구조상 정상
- Button처럼 variants JSON → state-css 생성 방식은 Text에 적용 불가
- Typography 토큰(`--font-size-display-2xl`, `--line-height-text-sm` 등)은 DB에 이미 존재

### 목표
1. DB Typography 토큰 → `size` prop 목록 자동 도출
2. `weight` prop 목록 (`regular | medium | semibold | bold`)
3. `color` prop → semantic text color 토큰 목록
4. `as` prop → polymorphic (asChild 패턴 허용)
5. 생성된 `Text` 컴포넌트가 sandbox에서 즉시 렌더링 가능

---

## 2. 스코프

### In Scope
- `generators/text/index.ts` — Text 전용 generator 신설
- `generators/text/token-resolver.ts` — DB 토큰에서 size/weight 목록 추출
- `registry.ts` — `text` resolvedType 등록
- `Text.tsx` + `Text.module.css` 생성 출력
- `types.ts` — `TypographyPayload` 타입 추가 (NormalizedPayload 확장 or 별도)
- `WarningCode` — `TEXT_TOKEN_MISSING`, `TEXT_SIZE_BELOW_MIN` 추가

### Out of Scope
- 플러그인 수정 (COMPONENT_SET 없으므로 추출 방식 변경 불필요)
- Figma Text Style 직접 연동 (토큰 DB로 충분)
- 텍스트 truncation, multi-line 제어 prop (Phase 2로)
- Markdown/rich text rendering

---

## 3. 기술 설계

### 3.1 입력 소스 변경

```
Button: PluginPayload (COMPONENT_SET variants) → NormalizedPayload → generator
Text:   DB TokenRecord[] (font-size-* 필터) → TypographyPayload → text generator
```

Text generator는 `NormalizedPayload`를 받지 않고 **별도 `TypographyPayload`** 를 입력으로 받는다.
단, `GeneratorOutput` 반환 타입은 동일.

### 3.2 TypographyPayload

```ts
interface TypographyPayload {
  name: string                  // 'Text'
  sizes: string[]               // ['display-2xl', 'display-xl', ..., 'text-xs']
  weights: string[]             // ['regular', 'medium', 'semibold', 'bold']
  colorTokens: string[]         // ['--text-primary', '--text-secondary', ...]
  sizeTokenMap: Record<string, {
    fontSize: string            // rem (e.g. '4.5rem')
    lineHeight: string          // rem
    letterSpacing?: string      // em or px
    fontFamily: 'display' | 'body'  // display 스케일: --font-family-display, 나머지: --font-family-body
  }>
}
```

#### Dual font-family 규칙
- `display-2xl` ~ `display-xs` → `var(--font-family-display, Inter)`
- `text-xl` ~ `text-xs` → `var(--font-family-body, Inter)`

### 3.3 token-resolver.ts

DB `tokens` 테이블에서:
- `name LIKE '--font-size-%'` → size 목록 추출 (`display-2xl`, `text-md` 등)
- `name LIKE '--line-height-%'` → lineHeight 매핑
- `name LIKE '--letter-spacing-%'` → letterSpacing 매핑
- `name LIKE '--text-%'` (color 타입) → colorTokens 목록

서버 액션에서 호출하거나, 기존 `getTokensByType` action 활용.

### 3.4 CSS 구조

variants 기반이 아닌 **size × weight 데이터 어트리뷰트**:

```css
/* Base */
.root {
  font-family: var(--font-family-body, Inter);
  color: var(--text-primary);
}

/* Size — display 스케일: font-family-display */
.root[data-size='display-2xl'] {
  font-family: var(--font-family-display, Inter);
  font-size: var(--font-size-display-2xl, 4.5rem);
  line-height: var(--line-height-display-2xl, 5.625rem);
  letter-spacing: -0.02em;
}
/* Size — text 스케일: font-family-body (base에서 상속) */
.root[data-size='text-md'] {
  font-size: var(--font-size-text-md, 1rem);
  line-height: var(--line-height-text-md, 1.5rem);
}

/* Weight */
.root[data-weight='semibold'] {
  font-weight: var(--font-weight-semibold, 600);
}

/* Color */
.root[data-color='secondary'] {
  color: var(--text-secondary);
}

/* Align */
.root[data-align='center'] { text-align: center; }
.root[data-align='right']  { text-align: right; }
.root[data-align='left']   { text-align: left; }

/* Wrap */
.root[data-wrap='balance'] { text-wrap: balance; }
.root[data-wrap='pretty']  { text-wrap: pretty; }
.root[data-wrap='nowrap']  { white-space: nowrap; }

/* Truncate */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* sr-only (VisuallyHidden 패턴) */
.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### 3.5 TSX 구조

Button과 달리 `tsx-builder.ts` 사용 안 함. text/index.ts에서 직접 생성.
`as` polymorphic prop (MEMORY 방침: `Text 같은 시맨틱 없는 스타일 컨테이너는 asChild 허용`).
@radix-ui/react-slot 미설치 → `as` prop으로 충분.

#### 추가 Props (Radix UI Text 접근성 패턴 참조)
| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `truncate` | `boolean` | `false` | 오버플로 말줄임 (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`) |
| `align` | `'left' \| 'center' \| 'right'` | `undefined` | 텍스트 정렬 (지정 시만 data-align 추가) |
| `wrap` | `'balance' \| 'pretty' \| 'nowrap'` | `undefined` | text-wrap 제어 |
| `srOnly` | `boolean` | `false` | 시각적 숨김 + 스크린리더 노출 (VisuallyHidden 패턴) |

```tsx
interface TextProps extends HTMLAttributes<HTMLElement> {
  size?: TextSize
  weight?: TextWeight
  color?: TextColor
  as?: React.ElementType        // 'p' | 'span' | 'h1'~'h6' | 'label' 등
  truncate?: boolean
  align?: 'left' | 'center' | 'right'
  wrap?: 'balance' | 'pretty' | 'nowrap'
  srOnly?: boolean
}

export function Text({
  size = 'text-md',
  weight = 'regular',
  color = 'primary',
  as: Tag = 'p',
  truncate,
  align,
  wrap,
  srOnly,
  className,
  ...props
}: TextProps) {
  const cls = [
    styles.root,
    truncate && styles.truncate,
    srOnly && styles.srOnly,
    className,
  ].filter(Boolean).join(' ')

  return (
    <Tag
      className={cls}
      data-size={size}
      data-weight={weight}
      data-color={color}
      {...(align && { 'data-align': align })}
      {...(wrap && { 'data-wrap': wrap })}
      {...props}
    />
  )
}
```

### 3.6 registry 등록

```ts
// registry.ts
import { generateText } from './text'

const GENERATORS: Record<string, GeneratorFn> = {
  button: generateButton,
  text: generateText,       // ← 추가
}
```

단, Text generator는 `NormalizedPayload` 대신 `TypographyPayload`를 받으므로
`GeneratorFn` 시그니처 오버로드 or 어댑터 래퍼 필요.

---

## 4. 구현 순서

1. `types.ts` — `TypographyPayload` 타입 + `TEXT_TOKEN_MISSING` WarningCode 추가
2. `generators/text/token-resolver.ts` — DB 토큰 → TypographyPayload 변환
3. `generators/text/index.ts` — CSS + TSX 생성 로직
4. `generators/registry.ts` — `text` 타입 등록 + GeneratorFn 어댑터
5. 컴포넌트 생성 UI에서 "Text" 선택 시 token-resolver 경로로 분기
6. Sandbox 렌더링 확인

---

## 5. 성공 기준

- [ ] `Text` 컴포넌트 생성 시 11개 size × 4 weight CSS 규칙 모두 출력
- [ ] display 스케일(display-*) → `--font-family-display`, text 스케일(text-*) → `--font-family-body`
- [ ] `as="h1"` 등 polymorphic 렌더링 정상 동작
- [ ] `srOnly` prop → `.srOnly` CSS 클래스 적용, 스크린리더 노출
- [ ] `truncate`, `align`, `wrap` prop 정상 동작
- [ ] font-size / line-height fallback 값이 rem 단위
- [ ] DB 토큰 없을 때 `TEXT_TOKEN_MISSING` 경고 반환
- [ ] `tsx-builder.ts`에 Text 분기 추가 없음
- [ ] `npm run build` 통과

---

## 6. 의존성

- 기존 DB `tokens` 테이블 (font-size/line-height 토큰 sync 완료 상태 전제)
- `getTokensByType` 서버 액션 또는 신규 `getTypographyTokens` 액션
- `generators/button/index.ts` 패턴 참조 (독립 모듈 구조)
