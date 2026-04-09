## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | button.ts 644줄 단일 파일, 진입점 2개에서 수동 normalize, Button 외 미지원 |
| Solution | shared 유틸 추출 → button/generic 제너레이터 분리 → pipeline 단일 진입점 |
| Function UX Effect | `.node.json` 임포트 시 모든 컴포넌트 타입에서 TSX+CSS 자동 생성 |
| Core Value | 전용 제너레이터 점진 추가 구조. 기존 Button 출력 품질 100% 유지 |

---

# Design: Component Generator 파이프라인 재설계

**Plan 참조**: `docs/01-plan/features/component-generator.plan.md`
**작성**: 2026-04-07

---

## 1. 디렉토리 구조

```
src/lib/component-generator/
├── index.ts                  # public API: runPipeline, types re-export
├── types.ts                  # PluginPayload (legacy 제거), NormalizedPayload, GeneratorOutput
├── pipeline.ts               # 단일 진입점: normalize → detect → generate
├── normalize.ts              # normalize-payload.ts 이전 + NormalizedPayload 반환
├── detect.ts                 # resolveType, resolveElement
├── css-var-mapper.ts         # 유지 (mapCssValue, mapRadiusValue)
├── generators/
│   ├── registry.ts           # { button: generateButton } + fallback
│   ├── shared/
│   │   ├── dimensions.ts     # classifyDimensions
│   │   ├── state-css.ts      # STATE_CSS_MAP, buildStateCSS, buildMultiSchemeCSS
│   │   ├── size-css.ts       # buildSizeCSSRules, buildIconOnlyCSSRules
│   │   └── tsx-builder.ts    # buildTsx (공통 TSX 코드 생성)
│   ├── button/
│   │   ├── index.ts          # generateButton (~80줄, 조합만)
│   │   └── extract.ts        # extractChildTextColor, extractDisabledOpacity 등
│   └── generic.ts            # 범용 폴백 제너레이터
└── a11y/
    └── patterns.ts           # getButtonA11yAttributes (상수 제거)
```

---

## 2. types.ts 재설계

### 2-1. PluginPayload (legacy 필드 제거)

```typescript
export interface PluginPayload {
  name: string
  meta: {
    nodeId: string
    nodeName: string
    nodeType: string
    figmaFileId: string
    figmaFileKey?: string
    masterId: string | null
    masterName: string | null
  }
  styles: Record<string, string>
  childStyles: Record<string, Record<string, string>>
  detectedType: string
  texts: { title: string; description: string; actions: string[]; all: string[] }
  radixProps: Record<string, string>
  variantOptions?: Record<string, string[]>
  variants?: VariantEntry[]
}

export interface VariantEntry {
  properties: Record<string, string>
  styles: Record<string, string>
  childStyles: Record<string, Record<string, string>>
}
```

**제거**: `html`, `htmlClass`, `htmlCss`, `jsx`
**추가**: `VariantEntry`를 독립 타입으로 export

### 2-2. NormalizedPayload (normalize 출력)

```typescript
export interface NormalizedPayload extends Omit<PluginPayload, 'variantOptions' | 'variants'> {
  /** 확정된 PascalCase 컴포넌트명 */
  name: string
  /** optional 제거 — 없으면 빈 객체/배열 */
  variantOptions: Record<string, string[]>
  variants: VariantEntry[]
}
```

### 2-3. PipelineResult (engine의 EngineResult 교체)

```typescript
export interface PipelineResult {
  success: boolean
  output: GeneratorOutput | null
  warnings: string[]
  resolvedType: string
  error?: string
}
```

### 2-4. GeneratorOutput, WarningCode (유지 + 추가)

```typescript
export type WarningCode =
  | 'UNMAPPED_COLOR'
  | 'MISSING_STATE'
  | 'MISSING_SIZE'
  | 'NO_VARIANTS_DATA'
  | 'MISSING_COLOR'
  | 'BLOCK_STYLE_MISMATCH'
  | 'UNKNOWN_STATE'
  | 'GENERIC_FALLBACK'    // 신규: 전용 제너레이터 없음
```

---

## 3. pipeline.ts 상세 설계

```typescript
import { normalize } from './normalize'
import { resolveType, resolveElement } from './detect'
import { getGenerator } from './generators/registry'
import { generateGeneric } from './generators/generic'
import type { PipelineResult } from './types'

export function runPipeline(raw: Record<string, unknown>): PipelineResult {
  // 1. 정규화
  const payload = normalize(raw)

  // 2. 타입 감지
  const resolvedType = resolveType(payload)

  // 3. 제너레이터 선택 (전용 > 폴백)
  const generator = getGenerator(resolvedType)
  const useGeneric = !generator
  const gen = generator ?? generateGeneric

  // 4. HTML 요소 결정
  const element = resolveElement(resolvedType, payload.name)

  // 5. 생성
  try {
    const output = gen(payload, { element })
    if (useGeneric) {
      output.warnings.push({
        code: 'GENERIC_FALLBACK',
        message: `'${payload.name}': 전용 제너레이터 없음, 범용 폴백 사용`,
      })
    }
    const warnings = output.warnings.map(
      w => `[${w.code}] ${w.message}${w.value ? ` (${w.value})` : ''}`
    )
    return { success: true, output, warnings, resolvedType }
  } catch (err) {
    return {
      success: false,
      output: null,
      warnings: [],
      resolvedType,
      error: `'${payload.name}' 생성 중 오류: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
```

---

## 4. normalize.ts 상세 설계

기존 `normalize-payload.ts` 로직 이전. 변경사항:

```typescript
import type { NormalizedPayload } from './types'

export function normalize(raw: Record<string, unknown>): NormalizedPayload {
  // 기존 normalizePluginPayload 로직 유지
  // 차이점:
  // 1. 반환 타입이 NormalizedPayload (optional 제거)
  // 2. variantOptions: raw.variantOptions ?? {}
  // 3. variants: raw.variants ?? []
  // 4. html/htmlClass/htmlCss/jsx 필드 무시 (spread하지 않음)
}
```

핵심 로직(이름 추출, radixProps 정규화, nodeName 파싱)은 **그대로 유지**.

---

## 5. detect.ts 상세 설계

```typescript
/** detectedType 보정 */
export function resolveType(payload: NormalizedPayload): string {
  const { detectedType, name } = payload
  const lowerName = name.toLowerCase()

  if (/button/i.test(name))               return 'button'
  if (/badge|chip|tag/i.test(name))        return 'badge'
  if (/input|field|textarea/i.test(name))  return 'input'
  if (/card|panel/i.test(name))            return 'card'
  if (/modal|dialog/i.test(name))          return 'modal'
  if (/tab/i.test(name))                   return 'tabs'

  return detectedType
}

type HtmlElement = 'button' | 'span' | 'input' | 'article' | 'a' | 'div'

/** 컴포넌트 타입 → HTML 요소 */
export function resolveElement(resolvedType: string, name: string): HtmlElement {
  switch (resolvedType) {
    case 'button':  return 'button'
    case 'badge':   return 'span'
    case 'input':   return 'input'
    case 'card':    return 'article'
    default:        return 'div'
  }
}
```

---

## 6. shared/ 유틸 분리 — button.ts에서 추출

### 6-1. shared/dimensions.ts

```typescript
// button.ts 1~35줄에서 추출
export interface DimensionKeys {
  stateKey:       string | undefined
  sizeKey:        string | undefined
  blockKey:       string | undefined
  iconOnlyKey:    string | undefined
  appearanceKeys: string[]
}

export function classifyDimensions(
  variantOptions: Record<string, string[]>
): DimensionKeys
```

### 6-2. shared/state-css.ts

```typescript
// button.ts 37~348줄에서 추출
export interface StateCssMapping { selector: string; extra?: string }
export const STATE_CSS_MAP: Record<string, StateCssMapping>

export function isBaseState(state: string): boolean

export interface StateStyle {
  bg: string | null; color: string | null
  border: string | null; opacity: string | null
}

export function buildStateCSS(
  stateMap: Map<string, StateStyle>,
  selectorPrefix: string,
  warnings: GeneratorWarning[],
  name: string,
): string

export function buildMultiSchemeCSS(
  appearanceKey: string,
  schemes: AppearanceScheme[],
  warnings: GeneratorWarning[],
  name: string,
): string
```

### 6-3. shared/size-css.ts

```typescript
// button.ts 350~437줄에서 추출
export function buildSizeCSSRules(
  variants: VariantEntry[],
  sizeKey: string,
  allSizes: string[],
  stateKey?: string,
  blockKey?: string,
  iconOnlyKey?: string,
  warnings?: GeneratorWarning[],
): string

export function buildIconOnlyCSSRules(
  variants: VariantEntry[],
  iconOnlyKey: string,
  sizeKey?: string,
  stateKey?: string,
): string
```

### 6-4. shared/tsx-builder.ts

```typescript
import type { NormalizedPayload, DimensionKeys } from '../types'

export interface TsxBuildOptions {
  element: string                    // 'button' | 'div' | 'span' ...
  elementPropsType: string           // 'ButtonHTMLAttributes<HTMLButtonElement>'
}

/**
 * 범용 TSX 코드 생성
 * button.ts 558~603줄의 TSX 생성 로직을 일반화
 */
export function buildTsx(
  payload: NormalizedPayload,
  dims: DimensionKeys,
  options: TsxBuildOptions,
): string
```

현재 button.ts의 TSX 생성 로직과 동일한 패턴:
- `forwardRef` + `data-*` attribute
- appearance/size/block/iconOnly/loading prop 자동 생성
- `aria-disabled`, `aria-busy` 자동 삽입

---

## 7. generators/button/ 분리

### 7-1. button/extract.ts

```typescript
// button.ts 76~202줄에서 추출 (버튼 전용 추출 로직)
export function extractChildTextColor(
  childStyles: Record<string, Record<string, string>>
): string | null

export function extractDisabledOpacity(
  childStyles: Record<string, Record<string, string>>,
  rootStyles: Record<string, string>,
): string | null

export function toStateStyle(v: VariantEntry): StateStyle
export function toDisabledStateStyle(v: VariantEntry): StateStyle
export function deduplicateByBlock(...): void

export function extractStateStyles(
  variants: VariantEntry[],
  stateKey: string,
  warnings: GeneratorWarning[],
  blockKey?: string,
  iconOnlyKey?: string,
): Map<string, StateStyle>

export function extractAppearanceSchemes(
  variants: VariantEntry[],
  appearanceKey: string,
  stateKey: string,
  warnings: GeneratorWarning[],
  blockKey?: string,
  iconOnlyKey?: string,
): AppearanceScheme[]
```

### 7-2. button/index.ts (~80줄)

```typescript
import type { NormalizedPayload, GeneratorOutput } from '../../types'
import type { GeneratorContext } from '../registry'
import { classifyDimensions } from '../shared/dimensions'
import { buildMultiSchemeCSS, buildSingleSchemeCSS } from '../shared/state-css'
import { buildSizeCSSRules, buildIconOnlyCSSRules } from '../shared/size-css'
import { buildTsx } from '../shared/tsx-builder'
import { extractStateStyles, extractAppearanceSchemes, deduplicateByBlock } from './extract'

export function generateButton(
  payload: NormalizedPayload,
  ctx: GeneratorContext,
): GeneratorOutput {
  const { variantOptions, variants } = payload
  const dims = classifyDimensions(variantOptions)
  const warnings = []

  // 1. block 일관성 검증
  if (dims.blockKey) deduplicateByBlock(variants, dims.blockKey, warnings)

  // 2. 색상 스킴 CSS
  const colorSchemeCSS = /* dims 기반 분기 — 기존 로직 */

  // 3. size/block/iconOnly CSS
  const sizeCSS = /* buildSizeCSSRules */
  const blockCSS = /* 조건부 */
  const iconOnlyCSS = /* buildIconOnlyCSSRules */

  // 4. TSX
  const tsx = buildTsx(payload, dims, {
    element: 'button',
    elementPropsType: 'ButtonHTMLAttributes<HTMLButtonElement>',
  })

  // 5. CSS 조합
  const css = /* base + colorScheme + size + block + iconOnly */

  return { name: payload.name, category: 'action', tsx, css, warnings }
}
```

---

## 8. generators/generic.ts — 범용 폴백

```typescript
import type { NormalizedPayload, GeneratorOutput } from '../types'
import type { GeneratorContext } from './registry'
import { classifyDimensions } from './shared/dimensions'
import { buildMultiSchemeCSS } from './shared/state-css'
import { buildSizeCSSRules } from './shared/size-css'
import { buildTsx } from './shared/tsx-builder'

/** 버튼 전용 추출 로직 없이 shared 유틸만으로 생성 */
export function generateGeneric(
  payload: NormalizedPayload,
  ctx: GeneratorContext,
): GeneratorOutput {
  const dims = classifyDimensions(payload.variantOptions)
  const warnings = []

  // CSS: shared 유틸로 state/size/appearance 자동 생성
  // TSX: buildTsx로 data-* attribute 자동 생성
  // base CSS: element에 따라 최소 기본값만 (cursor:pointer 등 제외)
}
```

**generic과 button의 차이:**

| 항목 | button | generic |
|------|--------|---------|
| base CSS | `cursor:pointer`, `font-weight:500` | `display:inline-flex`, `align-items:center`만 |
| childTextColor | `extractChildTextColor` 호출 | 미사용 (root styles만) |
| block 검증 | `deduplicateByBlock` | 미수행 |
| category | `'action'` 고정 | name 기반 추론 |

---

## 9. generators/registry.ts

```typescript
import type { NormalizedPayload, GeneratorOutput } from '../types'

export interface GeneratorContext {
  element: string
}

type GeneratorFn = (
  payload: NormalizedPayload,
  ctx: GeneratorContext,
) => GeneratorOutput

const GENERATORS: Record<string, GeneratorFn> = {
  button: (await import('./button')).generateButton,
}

export function getGenerator(resolvedType: string): GeneratorFn | null {
  return GENERATORS[resolvedType] ?? null
}
```

새 전용 제너레이터 추가 시 여기에 한 줄만 추가.

---

## 10. 진입점 업데이트

### 10-1. index.ts (public API)

```typescript
export { runPipeline } from './pipeline'
export type { PluginPayload, NormalizedPayload, GeneratorOutput, PipelineResult } from './types'
```

### 10-2. actions/components.ts — importComponentFromJson

```diff
- const { normalizePluginPayload } = await import('@/lib/component-generator/normalize-payload');
- const normalized = normalizePluginPayload(d);
- const { runComponentEngine } = await import('@/lib/component-generator');
- const result = runComponentEngine(normalized);
+ const { runPipeline } = await import('@/lib/component-generator');
+ const result = runPipeline(d);
```

### 10-3. route.ts — POST /api/sync/components

```diff
- import { runComponentEngine } from '@/lib/component-generator';
- import { normalizePluginPayload } from '@/lib/component-generator/normalize-payload';
- const data = normalizePluginPayload(body.data as unknown as Record<string, unknown>);
- const result = runComponentEngine(data);
+ import { runPipeline } from '@/lib/component-generator';
+ const result = runPipeline(body.data as Record<string, unknown>);
```

### 10-4. scripts/test-import.ts

```diff
- import { normalizePluginPayload } from '@/lib/component-generator/normalize-payload';
- import { runComponentEngine } from '@/lib/component-generator';
- const normalized = normalizePluginPayload(payload);
- const result = runComponentEngine(normalized);
+ import { runPipeline } from '@/lib/component-generator';
+ const result = runPipeline(payload);
```

---

## 11. CSS 변수 매핑 — 현행 유지

플러그인 데이터 분석 결과, **이미 clean semantic 변수명** 사용 중:

```
var(--bg-brand-solid)          ✅ clean
var(--bg-primary)              ✅ clean
var(--border-primary)          ✅ clean
var(--text-brand-secondary)    ✅ clean
var(--colors-base-white)       ⚠️ 유일한 long-form (1개)
border-radius: 8px             → mapRadiusValue → var(--radius-md)
```

**변경 불필요:**
- `css-var-mapper.ts`의 `mapCssValue`, `mapRadiusValue` 현행 유지
- `SEMANTIC_MAP` 확장은 향후 플러그인 데이터 변화 시 대응

---

## 12. 삭제 대상

| 파일 | 시점 | 이유 |
|------|------|------|
| `engine.ts` | pipeline.ts 완성 후 | 교체됨 |
| `normalize-payload.ts` | normalize.ts 완성 후 | 이전됨 |
| `generators/button.ts` | button/ 분리 완성 후 | 분리됨 |
| `a11y/button.ts` | a11y/patterns.ts 완성 후 | 상수 제거됨 |

**삭제 순서**: 모든 진입점이 `runPipeline` 사용 확인 → 구 파일 삭제 → build 검증

---

## 13. 구현 순서 (Phase별)

### Phase 1: shared 유틸 추출 (기존 코드 분리만, 동작 변경 없음)
1. `generators/shared/dimensions.ts` — classifyDimensions 추출
2. `generators/shared/state-css.ts` — STATE_CSS_MAP, buildStateCSS, buildMultiSchemeCSS 추출
3. `generators/shared/size-css.ts` — buildSizeCSSRules, buildIconOnlyCSSRules 추출
4. `generators/button.ts`에서 shared import로 교체 → build 검증

### Phase 2: button 분리 + TSX 빌더
5. `generators/button/extract.ts` — 버튼 전용 추출 로직
6. `generators/shared/tsx-builder.ts` — TSX 생성 일반화
7. `generators/button/index.ts` — 조합
8. `generators/button.ts` 교체 → build 검증

### Phase 3: 파이프라인 + 범용 폴백
9. `types.ts` 재작성 (legacy 제거)
10. `normalize.ts` 작성
11. `detect.ts` 작성
12. `generators/registry.ts` 작성
13. `generators/generic.ts` 작성
14. `pipeline.ts` 작성
15. `index.ts` 교체
16. 진입점 업데이트 (route.ts, actions, scripts)
17. build 검증

### Phase 4: 정리
18. 구 파일 삭제 (engine.ts, normalize-payload.ts, generators/button.ts)
19. `a11y/patterns.ts` 정리 (하드코딩 상수 제거)
20. 최종 build + lint 검증

---

## 14. 검증 기준

- [ ] Phase 1 완료 후: `Button.node.json` → 기존과 동일한 TSX+CSS 출력
- [ ] Phase 2 완료 후: button/index.ts가 shared 유틸 사용, 동일 출력
- [ ] Phase 3 완료 후: `runPipeline(buttonData)` → 기존과 동일 출력
- [ ] Phase 3 완료 후: `runPipeline(unknownData)` → 폴백으로 TSX+CSS 생성 (에러 없음)
- [ ] Phase 4 완료 후: `npm run build` 성공, `npm run lint` 통과
- [ ] 모든 진입점에서 `normalizePluginPayload` 직접 호출 없음
