## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | 새 Figma 컴포넌트(Badge, StatusIcon, BadgeClose 등)가 추가될 때마다 전용 생성기를 새로 작성해야 하며, 복잡한 variant 조합(최대 666개)과 다양한 노드 타입(VECTOR/TEXT/ELLIPSE/INSTANCE)을 매번 수동으로 처리해야 함 |
| Solution | `variantOptions`, `childStyles`, `nodeTree`를 자동 분석해 어떤 node.json이든 React 컴포넌트를 생성하는 Universal Generator 구축. 공통 추출 로직을 shared 유틸로 분리하고 컴포넌트별 override config로 예외 처리 |
| Function UX Effect | node.json 임포트 한 번으로 TypeScript props interface + CSS Modules + inline SVG가 자동 생성. 개발자가 생성기 코드를 작성할 필요 없음 |
| Core Value | 생성기 수 = 1개. Figma 디자인 시스템 확장 시 코드 수정 없이 컴포넌트 추가 가능 |

---

# Plan: Universal Component Generator

> node.json → React 컴포넌트 자동 생성 파이프라인 구축

**작성**: 2026-04-17
**상태**: 신규

---

## 1. 배경 및 현재 문제

### 1-1. 분석한 3가지 컴포넌트

| 컴포넌트 | variant 차원 | 총 조합 | 노드 타입 | 특이사항 |
|---------|-------------|--------|-----------|---------|
| **Badge** | size×type×icon×color (4개) | 666개 | TEXT, ELLIPSE, INSTANCE | icon 차원이 DOM 구조 변경 |
| **BadgeCloseX** | type×color×state (3개) | 48개 | VECTOR | state=Hover → :hover CSS |
| **StatusIcon** | type (1개) | 5개 | VECTOR, TEXT, ELLIPSE | 타입마다 구조가 완전히 다름 |

### 1-2. 기존 생성기 한계

- 각 컴포넌트마다 `extract.ts` + `index.ts` 신규 작성 필요
- 공통 로직(variantOptions 파싱, CSS 생성, SVG 변환) 중복
- 새 컴포넌트 추가 = 개발 공수 발생

---

## 2. 목표

### 2-1. 핵심 목표
어떤 `node.json`이든 → TypeScript 컴포넌트 자동 생성

### 2-2. 품질 목표
- 생성된 컴포넌트: 기존 Button/Avatar 생성기 출력과 동일한 패턴
- CSS 변수: 프로젝트 `tokens.css` 체계 연동
- 접근성: forwardRef + aria-disabled + data-* attribute

---

## 3. 핵심 설계: Dimension 자동 분류

`variantOptions`의 각 키를 5가지 타입으로 자동 분류:

| Dimension 타입 | 감지 조건 | 처리 방식 |
|--------------|----------|---------|
| **color** | 키 이름이 `color`이며 값이 Gray/Brand/Error 등 | CSS 변수 패밀리 스왑 (`--utility-{color}-*`) |
| **size** | 키 이름이 `size`이며 값이 sm/md/lg/xl 등 | `data-size` + CSS size 스케일 |
| **state** | 키 이름이 `state`이며 값에 Hover/Focus/Active | `:hover`, `:focus` pseudo-class |
| **slot** | 하나의 값마다 nodeTree 자식 구조가 다름 | ReactNode slot props |
| **type** | 나머지 — shape/appearance 변경 | `data-type` CSS selector |

### 3-1. color 차원 CSS 최적화

색상 12종 × 속성 3개 = 36줄 → CSS 변수 재정의로 9줄로 압축:

```css
/* 비효율 (기존) */
[data-color="brand"] { background: var(--utility-brand-50); border-color: var(--utility-brand-200); color: var(--utility-brand-700); }
[data-color="error"]  { background: var(--utility-error-50); border-color: var(--utility-error-200); color: var(--utility-error-700); }
/* ... 12개 반복 */

/* 효율 (신규) — CSS 변수 재정의 패턴 */
.root {
  --badge-bg:     var(--utility-neutral-50);
  --badge-border: var(--utility-neutral-200);
  --badge-text:   var(--utility-neutral-700);
  background: var(--badge-bg);
  border-color: var(--badge-border);
  color: var(--badge-text);
}
[data-color="brand"] { --badge-bg: var(--utility-brand-50); --badge-border: var(--utility-brand-200); --badge-text: var(--utility-brand-700); }
[data-color="error"]  { --badge-bg: var(--utility-error-50); --badge-border: var(--utility-error-200); --badge-text: var(--utility-error-700); }
```

### 3-2. state 차원 → pseudo-class 변환

```css
/* state=Hover → data-state 아닌 :hover */
.root:hover { --badge-border: var(--utility-neutral-300); }
```

### 3-3. slot 차원 → ReactNode props

Badge의 `icon` 차원처럼 구조가 바뀌는 경우:
```tsx
interface BadgeProps {
  leadingIcon?: ReactNode   // icon=leading
  trailingIcon?: ReactNode  // icon=trailing, icon=x-close
  dot?: boolean             // icon=dot
}
```

---

## 4. 노드 타입별 처리 전략

| 노드 타입 | 처리 방법 | 결과 |
|----------|---------|------|
| **TEXT** | `children`/`label` prop으로 추출 | `{children}` |
| **VECTOR** | `pathData` → `<svg><path d={...} /></svg>` inline | SVG JSX |
| **ELLIPSE** | `border-radius: 50%` CSS | CSS only |
| **INSTANCE** | ReactNode slot prop | `{leadingIcon}` |
| **FRAME** | CSS Module 클래스 | `.frame` |

### VECTOR → SVG 변환

```typescript
// pathData: "M 6 0 L 0 6 M 0 0 L 6 6"
function vectorToSvg(node: VectorNode): string {
  const { width, height } = node.styles
  const stroke = node.styles['stroke'] ?? 'currentColor'
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${w} ${h}" fill="none">
  <path d="${node.pathData}" stroke="${stroke}" strokeWidth="1.5" strokeLinecap="round"/>
</svg>`
}
```

---

## 5. 파일 구조

```
src/lib/component-generator/
  universal/
    classify-dimensions.ts   ← variantOptions → DimensionType 분류
    extract-nodes.ts         ← nodeTree → 노드 타입별 추출
    build-props.ts           ← Dimension 분석 → TypeScript props interface 생성
    build-css.ts             ← childStyles + Dimension → CSS Module 생성
    build-tsx.ts             ← 노드 구조 → JSX 생성
    build-svg.ts             ← VECTOR pathData → SVG JSX
    index.ts                 ← generateUniversal(payload) 진입점

  generators/
    button/     ← 기존 (유지)
    avatar/     ← 기존 (유지)
    text/       ← 기존 (유지)

  engine.ts     ← GENERATORS 조회 후 없으면 universal로 폴백
```

### 폴백 로직

```typescript
// engine.ts
export function runGenerator(payload: PluginPayload): GeneratorResult {
  const specific = GENERATORS[payload.detectedType]
  if (specific) return specific(payload)
  return generateUniversal(payload)  // 폴백
}
```

---

## 6. Override Config (예외 처리)

자동 감지가 어긋날 때 컴포넌트별 config로 보정:

```json
// Badge.generator.config.json
{
  "semanticElement": "span",
  "dimensions": {
    "icon": "slot",      // 자동 감지 override — slot으로 강제
    "state": "state"     // hover pseudo-class 처리
  },
  "slots": {
    "leadingIcon":  ["Icon leading", "Dot", "Avatar", "Country"],
    "trailingIcon": ["Icon trailing", "X close"],
    "iconOnly":     ["Only"]
  }
}
```

---

## 7. 생성 결과물 예시

### Badge (자동 생성 예시)

```tsx
export type BadgeSize  = 'sm' | 'md' | 'lg'
export type BadgeType  = 'Pill color' | 'Badge color' | 'Badge modern'
export type BadgeColor = 'Gray' | 'Brand' | 'Error' | 'Warning' | 'Success' | ...

export interface BadgeProps {
  size?: BadgeSize
  type?: BadgeType
  color?: BadgeColor
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  dot?: boolean
  children?: ReactNode
  className?: string
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ size = 'sm', type = 'Pill color', color = 'Gray', leadingIcon, trailingIcon, dot, children, className = '', ...props }, ref) => (
    <span
      ref={ref}
      data-size={size}
      data-type={type.toLowerCase().replace(/\s+/g, '-')}
      data-color={color.toLowerCase()}
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {dot && <span className={styles.dot} />}
      {leadingIcon && <span className={styles.leadingIcon}>{leadingIcon}</span>}
      {children}
      {trailingIcon && <span className={styles.trailingIcon}>{trailingIcon}</span>}
    </span>
  ),
)
```

### StatusIcon (자동 생성 예시)

```tsx
export type StatusIconType = 'Offline' | 'Online' | 'Count' | 'Avatar' | 'Verified tick'

export interface StatusIconProps {
  type?: StatusIconType
  count?: number
  src?: string
  alt?: string
  className?: string
}

export const StatusIcon = ({ type = 'Offline', count, src, alt, className = '' }: StatusIconProps) => (
  <span data-type={type.toLowerCase().replace(/\s+/g, '-')} className={`${styles.root}${className ? ` ${className}` : ''}`}>
    {type === 'Count'  && <span className={styles.count}>{count}</span>}
    {type === 'Avatar' && <img src={src} alt={alt ?? ''} className={styles.avatar} />}
    {type === 'Online' && <svg ...>{/* Reflection path */}</svg>}
    {type === 'Verified tick' && <svg ...>{/* Shield + Check paths */}</svg>}
  </span>
)
```

---

## 8. 구현 순서

| 단계 | 작업 | 산출물 |
|-----|------|-------|
| 1 | `classify-dimensions.ts` 구현 | DimensionType 분류 로직 |
| 2 | `extract-nodes.ts` 구현 | nodeTree → 노드 타입 추출 |
| 3 | `build-svg.ts` 구현 | VECTOR pathData → SVG JSX |
| 4 | `build-props.ts` 구현 | TypeScript interface 생성 |
| 5 | `build-css.ts` 구현 | CSS Module 생성 (color 최적화 포함) |
| 6 | `build-tsx.ts` 구현 | JSX 생성 |
| 7 | `index.ts` 조립 | generateUniversal() 진입점 |
| 8 | `engine.ts` 폴백 연결 | 기존 생성기와 통합 |
| 9 | Badge / StatusIcon / BadgeClose 검증 | 3개 node.json으로 E2E 테스트 |

---

## 9. 범위 외 (이번 구현 제외)

- Badge의 Country 아이콘 (국기 이미지 — 별도 처리 필요)
- 애니메이션 / 트랜지션 자동 감지
- PropsEditor 연동 (기존 로직 재사용)
