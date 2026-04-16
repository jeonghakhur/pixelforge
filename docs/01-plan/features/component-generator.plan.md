## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | 컴포넌트 생성기가 Button만 지원하며, 파이프라인 진입점이 2개로 분리되어 있고, 생성된 CSS가 Figma 변수를 그대로 사용해 프로젝트 토큰 체계와 분리됨 |
| Solution | 단일 파이프라인 재설계 + Radix UI 패턴 기반 범용 제너레이터 + Figma→프로젝트 CSS 변수 매핑 전략 통합 |
| Function UX Effect | 어떤 Figma 컴포넌트든 `.node.json` 임포트 → data-attribute 기반 TSX + 프로젝트 토큰 연동 CSS Module 자동 생성 |
| Core Value | 1개 제너레이터로 모든 컴포넌트 타입 커버. 생성 코드가 프로젝트 디자인 시스템과 즉시 통합 가능 |

---

# Plan: Component Generator 통합 재설계

> 파이프라인 구조 정리 + 범용 폴백 + Radix UI 패턴 + CSS 변수 매핑 전략

**작성**: 2026-04-07
**상태**: 통합 플랜 (기존 component-generator.plan + generic-generator.plan 병합)

---

## 1. 현재 상태

### 1-1. 잘 동작하는 것 (유지)

- **TSX 생성 패턴**: `forwardRef` + `data-*` attribute 기반 variant 전달 (Radix UI 패턴)
- **차원 자동 분류**: `variantOptions`에서 state/size/block/iconOnly/appearance 자동 인식
- **CSS 생성 구조**: base → color scheme → size → block → icon only 순서
- **normalize-payload**: 이름 추출, radixProps 정규화, nodeName 파싱

### 1-2. 문제점

| # | 문제 | 영향 |
|---|------|------|
| 1 | **진입점 2개** — route.ts와 actions/components.ts가 각각 normalize 호출 | 한쪽 빠뜨리면 버그 (실제 발생) |
| 2 | **Button 전용** — engine.ts에 `GENERATORS = { button }` 하나만 존재 | Badge, Input 등 임포트 시 에러 |
| 3 | **legacy 필드 잔존** — types.ts에 `html`, `htmlClass`, `htmlCss`, `jsx` 남아 있음 | 타입이 실제 데이터 구조와 불일치 |
| 4 | **button.ts 644줄** — 추출/TSX생성/CSS생성 관심사 혼재 | 수정 시 사이드이펙트 위험 |
| 5 | **css-var-mapper 부분 활용** — `mapCssValue`는 사용하나 `mapCssBlock`은 미사용 | 변수 매핑 전략이 불완전 |
| 6 | **CSS가 Figma 변수 직접 사용** — `var(--colors-background-bg-brand-solid)` | 프로젝트 `tokens.css` 체계와 분리 |
| 7 | **a11y/button.ts 하드코딩 상수** — `BUTTON_VARIANTS`, `BUTTON_SIZES` | `variantOptions` 있는 지금 불필요 |

---

## 2. 목표

### 2-1. 파이프라인 단일화
- 모든 진입점 → `runPipeline()` 하나만 호출
- normalize → detect → generate 자동 흐름

### 2-2. 범용 제너레이터
- Button 외 모든 컴포넌트 타입을 범용 폴백으로 지원
- 전용 제너레이터(button) 있으면 우선, 없으면 폴백 자동 적용

### 2-3. Radix UI 패턴 통일
- 모든 생성 컴포넌트가 동일한 API 패턴 따름:
  - `forwardRef` + `data-*` attribute
  - `aria-disabled` + `data-disabled` (Radix 접근성 패턴)
  - HTML 요소 자동 결정 (button/span/article/div)

### 2-4. CSS 변수 매핑 전략
- Figma 시맨틱 변수 → 프로젝트 `tokens.css` 변수로 자동 변환
- `css-var-mapper.ts` 강화: 매핑 테이블 확장 + 미매핑 경고

---

## 3. 실제 플러그인 Payload 구조 (확정)

```typescript
// Button.node.json의 data 필드 기반
interface PluginPayload {
  name: string              // "Buttons/Button"
  detectedType: string      // "layout" (플러그인 감지, 보정 필요)
  meta: {
    nodeId: string
    nodeName: string        // "Size=xl, Hierarchy=Primary, State=Default, Icon only=False"
    nodeType: string        // "COMPONENT" | "COMPONENT_SET"
    figmaFileId: string
    figmaFileKey?: string
    masterId: string | null
    masterName: string | null
  }
  styles: Record<string, string>
  childStyles: Record<string, Record<string, string>>
  texts: { title: string; description: string; actions: string[]; all: string[] }
  radixProps: Record<string, string>      // { color: "blue", size: "xl" }
  variantOptions?: Record<string, string[]>
  variants?: Array<{
    properties: Record<string, string>
    styles: Record<string, string>
    childStyles: Record<string, Record<string, string>>
  }>
}
```

**제거할 필드**: `html`, `htmlClass`, `htmlCss`, `jsx`

---

## 4. 생성 결과물 패턴 (Radix UI 참고)

### 4-1. TSX 패턴 — 현재 Button 출력 기준 (유지·확장)

```tsx
// forwardRef + data-* attribute 패턴
export const ComponentName = forwardRef<HTMLElement, ComponentNameProps>(
  ({ variant, size, disabled, className = '', children, ...props }, ref) => (
    <element
      ref={ref}
      data-size={size}
      data-variant={variant.toLowerCase().replace(/\s+/g, '-')}
      data-disabled={disabled ? '' : undefined}
      aria-disabled={disabled || undefined}
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      {...props}
    >
      {children}
    </element>
  ),
);
```

### 4-2. HTML 요소 자동 결정

| detectedType / name 패턴 | 요소 | 이유 |
|--------------------------|------|------|
| `button`, name에 "button" | `<button>` | 클릭 인터랙션 |
| `input`, `textarea`, `field` | `<input>` | 폼 입력 |
| `badge`, `chip`, `tag` | `<span>` | 인라인 표시 |
| `card`, `panel` | `<article>` | 콘텐츠 컨테이너 |
| `link`, `nav` | `<a>` | 탐색 |
| 그 외 | `<div>` | 범용 |

### 4-3. CSS Module 패턴

```css
/* data-attribute 셀렉터 기반 (클래스 충돌 없음) */
.root { /* base */ }
.root[data-variant='primary'] { /* variant */ }
.root[data-variant='primary']:hover:not([data-disabled]) { /* state */ }
.root[data-variant='primary'][data-disabled] { /* disabled */ }
.root[data-size='md'] { /* size */ }
.root[data-icon-only] { /* modifier */ }
```

---

## 5. CSS 변수 매핑 전략

### 5-1. 현재 매핑 흐름

```
Figma Variables → 플러그인 추출 → var(--colors-background-bg-brand-solid)
                                   ↓ css-var-mapper.ts::mapCssValue()
                                   var(--bg-brand-solid)  ← tokens.css에 정의된 변수
```

### 5-2. 매핑 계층

| 우선순위 | 매핑 유형 | 예시 |
|---------|----------|------|
| 1 | SEMANTIC_MAP (프로젝트 디자인 시스템) | `colors-gray-900` → `text-primary` |
| 2 | Figma 색상 변수 slug 변환 | `colors-background-bg-brand-solid` → `bg-brand-solid` |
| 3 | 그대로 통과 | `spacing-8`, `radius-md` |

### 5-3. 강화 방향

- **SEMANTIC_MAP 확장**: 현재 13개 → Figma Variables 전체 커버
- **radius 매핑 강화**: `mapRadiusValue`에 `tokens.css`의 `--radius-*` 전체 등록
- **미매핑 경고 강화**: `UNMAPPED_VAR` 경고 코드 추가 (hex뿐 아니라 미매핑 var도)
- **생성 CSS에 tokens.css 변수 사용**: `var(--radius-md)`, `var(--spacing-*)` 등

---

## 6. 새 디렉토리 구조

```
src/lib/component-generator/
  index.ts              # public API — runPipeline(), types re-export
  types.ts              # PluginPayload (legacy 제거), NormalizedPayload, GeneratorOutput
  pipeline.ts           # 단일 진입점: normalize → detect → generate
  normalize.ts          # 페이로드 정규화 (기존 normalize-payload.ts 이전)
  detect.ts             # detectedType 결정 + HTML 요소 결정
  css-var-mapper.ts     # 유지 + SEMANTIC_MAP 확장
  generators/
    registry.ts         # { button: generateButton, _fallback: generateGeneric }
    shared/
      dimensions.ts     # classifyDimensions (button.ts에서 추출)
      state-css.ts      # STATE_CSS_MAP, buildStateCSS, buildMultiSchemeCSS
      size-css.ts       # buildSizeCSSRules, buildIconOnlyCSSRules
      tsx-builder.ts    # TSX 코드 생성 공통 로직
    button/
      index.ts          # generateButton — 조합만 담당 (~80줄)
      extract.ts        # Figma 데이터 추출 (state/size/appearance styles)
    generic.ts          # 범용 폴백 — shared/ 유틸 조합
  a11y/
    patterns.ts         # 접근성 패턴 (button.ts에서 하드코딩 상수 제거)
```

### 삭제 대상

| 파일 | 이유 |
|------|------|
| `engine.ts` | `pipeline.ts`로 교체 |
| `normalize-payload.ts` | `normalize.ts`로 이전 |
| `generators/button.ts` (현재 644줄) | `button/` 디렉토리로 분리 |
| `a11y/button.ts` | `a11y/patterns.ts`로 교체 (하드코딩 상수 제거) |

---

## 7. Pipeline 단일 진입점

```typescript
// pipeline.ts
export function runPipeline(raw: Record<string, unknown>): PipelineResult {
  // 1. 정규화 (이름 추출, radixProps 변환, legacy 필드 무시)
  const payload = normalize(raw)

  // 2. 타입 감지 + HTML 요소 결정
  const resolvedType = resolveType(payload)
  const element = resolveElement(resolvedType, payload.name)

  // 3. 전용 제너레이터 탐색 → 없으면 폴백
  const generator = getGenerator(resolvedType) ?? generateGeneric
  const output = generator(payload, { element })

  return { success: true, output, warnings: output.warnings, resolvedType }
}
```

**모든 진입점은 `runPipeline` 하나만 호출:**
- `POST /api/sync/components` → `runPipeline(body.data)`
- `importComponentFromJson` → `runPipeline(d)`

---

## 8. 범용 폴백 제너레이터

### 8-1. 차원 자동 분류 (shared/dimensions.ts에서 재사용)

```typescript
// variantOptions에서 자동 분류
state 차원: 값에 Default/Hover/Focused/Disabled 포함 시
size 차원: 값에 xs/sm/md/lg/xl 패턴 포함 시
appearance 차원: 나머지 (hierarchy, variant, type, color 등)
```

### 8-2. CSS 생성 전략

Button 제너레이터의 `shared/` 유틸을 그대로 재사용:
- `buildStateCSS` → state별 셀렉터 생성
- `buildSizeCSSRules` → size별 padding/radius/gap
- `buildMultiSchemeCSS` → appearance별 색상 스킴

차이점:
- base CSS에서 버튼 전용 기본값(`cursor: pointer`, `font-weight: 500`) 제외
- HTML 요소에 따라 최소 기본값만 적용

### 8-3. 경고

기존 경고 코드 + 추가:
- `GENERIC_FALLBACK` — 전용 제너레이터 없어서 폴백 사용 중
- `UNMAPPED_VAR` — CSS 변수가 매핑 테이블에 없음

---

## 9. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | types.ts 재작성 | legacy 필드 제거, NormalizedPayload 추가 |
| 2 | normalize.ts | normalize-payload.ts 이전 + NormalizedPayload 반환 |
| 3 | detect.ts | resolveType + resolveElement |
| 4 | shared/ 유틸 추출 | dimensions.ts, state-css.ts, size-css.ts, tsx-builder.ts |
| 5 | generators/button/ 분리 | extract.ts + index.ts (~80줄) |
| 6 | generators/generic.ts | 범용 폴백 |
| 7 | generators/registry.ts | 레지스트리 |
| 8 | pipeline.ts | 단일 진입점 |
| 9 | index.ts | public API 재정의 |
| 10 | css-var-mapper.ts 강화 | SEMANTIC_MAP 확장 |
| 11 | 진입점 업데이트 | route.ts, actions/components.ts |
| 12 | a11y/patterns.ts | 하드코딩 상수 제거 |
| 13 | 삭제 | engine.ts, normalize-payload.ts, generators/button.ts(구), a11y/button.ts |

---

## 10. `src/lib/generators/react/` 처리

**결정 완료 (2026-04-07)**: 삭제됨.
- 토큰 기반 템플릿 생성기 전체 삭제
- `generateComponentsAction` 함수 제거 (미사용)
- `component-generator/`가 유일한 컴포넌트 생성 경로

---

## 11. 검증 기준

- [ ] `Button.node.json` → `runPipeline()` → 현재와 동일한 TSX+CSS 출력
- [ ] 미지원 detectedType → 폴백 제너레이터로 TSX+CSS 생성 (에러 없음)
- [ ] 생성된 CSS의 Figma 변수가 `tokens.css` 변수로 매핑됨
- [ ] `GENERIC_FALLBACK` 경고가 UI에 표시됨
- [ ] Button은 전용 제너레이터 사용 (폴백 미적용)
- [ ] `npm run build` 성공
- [ ] `npm run lint` 통과

---

## 12. 예상 결과

| 지표 | 현재 | 재설계 후 |
|------|------|-----------|
| 지원 컴포넌트 | Button 1개 | 전체 (폴백) |
| 코드 경로 수 | 2개 | 1개 (pipeline) |
| button.ts 줄수 | 644줄 | ~80줄 (index) + shared |
| CSS 변수 매핑 | 부분적 | 완전 (tokens.css 연동) |
| legacy 필드 | 4개 잔존 | 제거 |
| generator 추가 방법 | engine.ts 수정 필요 | registry.ts + 새 파일만 |

---

## 13. 미해결 과제 (Backlog)

> 작업 중 발견된 구조적 제약. 다음 컴포넌트 생성기 작업 시 반드시 검토.

### 13-1. PropsEditor — union props 편집 불가

**현상**: PropsEditor에서 union 타입 prop(size, variant, color 등)은 이름 변경·기본값 편집만 가능하고, 값 목록(union 멤버) 자체는 수정할 수 없음. Button도 동일.

**원인**: union 값 목록이 생성된 TSX의 `export type` 선언에서 파싱되며, 편집 후 재생성 파이프라인이 union 멤버 오버라이드를 지원하지 않음.

**방향**: `ComponentOverrides`에 `unionValues?: string[]` 필드 추가 → 재생성 시 TSX의 union type 선언을 오버라이드로 교체.

---

### 13-2. Sandbox — props without default value 미표시

**현상**: 생성된 컴포넌트 TSX에서 destructuring 기본값이 없는 prop(`truncate`, `align`, `wrap`, `srOnly` 등)은 Sandbox 컨트롤에 나타나지 않음.

**원인**: `parseSandboxProps`가 destructuring `name = value` 패턴에서만 prop을 추출함. 기본값 없는 prop은 interface에서 별도로 추출해야 함.

**방향**: `parseSandboxProps`에서 interface 파싱 단계를 보강 — boolean·인라인 union prop을 destructured와 독립적으로 추출.

---

### 13-3. Sandbox — 일반 함수 컴포넌트 props 미표시 (부분 해결)

**현상**: `forwardRef` 없이 생성된 컴포넌트(Text 등)는 Sandbox props 파서가 `}, ref` 패턴을 찾지 못해 props를 추출하지 못함.

**상태**: `}, ref` + `}: TypeProps` 두 패턴 모두 지원하도록 수정 완료 (2026-04-16). 단, 기본값 없는 props는 13-2 이슈로 여전히 미표시.
