/**
 * Component Generator — 타입 정의
 *
 * PluginPayload: 플러그인 raw 데이터 (legacy 필드 제거)
 * NormalizedPayload: normalize 출력 (optional 제거)
 * PipelineResult: runPipeline 반환값
 */

// ── 플러그인 payload ────────────────────────────────────────────────

export interface PluginPayload {
  name: string
  meta: {
    nodeId: string
    nodeName: string
    nodeType: string
    figmaFileKey?: string
    masterId: string | null
    masterName: string | null
  }
  /** 루트 노드 CSS 속성 */
  styles: Record<string, string>
  /** 플러그인이 감지한 컴포넌트 타입 */
  detectedType: string
  texts: {
    title: string
    description: string
    actions: string[]
    all: string[]
  }
  /** 하위 요소별 스타일 */
  childStyles: Record<string, Record<string, string>>
  /** Radix 기반 props 제안 */
  radixProps: Record<string, string>
  /** COMPONENT_SET 루트의 nodeTree (propRefs 포함) */
  nodeTree?: NodeTreeEntry
  /** COMPONENT_SET의 실제 variant 옵션 */
  variantOptions?: Record<string, string[]>
  /** COMPONENT_SET 자식 각각의 스타일 */
  variants?: VariantEntry[]
  /** Component Properties (Boolean, Instance Swap, Text) */
  componentProperties?: Record<string, ComponentPropertyDef>
}

/**
 * componentPropertyReferences 매핑.
 * key: CSS 속성명(예: "visible"), value: Figma property ID(예: "Source#3287:4621")
 * 플러그인이 각 레이어에서 캡처한 데이터이며, 어떤 boolean prop이 이 레이어를 제어하는지를 나타낸다.
 */
export type ComponentPropRefs = Record<string, string>

/** nodeTree 의 각 노드 — 플러그인 buildNodeTree() 출력 구조 */
export interface NodeTreeEntry {
  id: string
  type: string
  name: string
  styles?: Record<string, string>
  /** 이 레이어의 visibility 등을 제어하는 component property 매핑 */
  propRefs?: ComponentPropRefs
  children?: NodeTreeEntry[]
  /** TEXT 레이어 텍스트 */
  characters?: string
  textRole?: string
  shape?: string
}

export interface VariantEntry {
  properties: Record<string, string>
  /** property 값을 '_'로 join한 식별자 (예: 'md_primary_default') */
  variantSlug?: string
  /** 렌더링 크기 (px) */
  width?: number
  height?: number
  styles: Record<string, string>
  childStyles: Record<string, Record<string, string>>
  /** 플러그인 buildNodeTree() 출력 — propRefs 포함 */
  nodeTree?: NodeTreeEntry
}

/** Component Property 정의 (Boolean, Instance Swap, Text) */
export interface ComponentPropertyDef {
  type: 'BOOLEAN' | 'INSTANCE_SWAP' | 'TEXT'
  defaultValue: string | boolean
  /** INSTANCE_SWAP일 때 허용되는 컴포넌트 목록 */
  preferredValues?: Array<{ type: string; key: string }>
}

// ── 정규화된 payload ────────────────────────────────────────────────

export interface NormalizedPayload extends Omit<PluginPayload, 'variantOptions' | 'variants'> {
  /** 확정된 PascalCase 컴포넌트명 */
  name: string
  /** optional 제거 — 없으면 빈 객체/배열 */
  variantOptions: Record<string, string[]>
  variants: VariantEntry[]
}

// ── 생성 결과 ────────────────────────────────────────────────────────

export type ComponentCategory = 'action' | 'form' | 'navigation' | 'feedback'

export interface GeneratorOutput {
  /** 컴포넌트명 (PascalCase) */
  name: string
  category: ComponentCategory
  /** 생성된 TSX 코드 */
  tsx: string
  /** 생성된 CSS Module 코드 (tokens.css 변수 활용) */
  css: string
  /** 생성 과정에서 발견된 경고 */
  warnings: GeneratorWarning[]
}

export type WarningCode =
  | 'UNMAPPED_COLOR'
  | 'MISSING_STATE'
  | 'MISSING_SIZE'
  | 'NO_VARIANTS_DATA'
  | 'MISSING_COLOR'
  | 'BLOCK_STYLE_MISMATCH'
  | 'UNKNOWN_STATE'
  | 'GENERIC_FALLBACK'
  | 'TEXT_TOKEN_MISSING'
  | 'TEXT_SIZE_BELOW_MIN'

// ── Text 컴포넌트 전용 ────────────────────────────────────────────────

export interface TypographySizeToken {
  /** rem (e.g. '0.75rem') */
  fontSize: string
  /** rem (e.g. '1.125rem') */
  lineHeight: string
  /** display-* 스케일은 font-family-display, text-* 스케일은 font-family-body */
  fontFamily: 'display' | 'body'
}

export interface TypographyPayload {
  name: string
  /** DB 조회 순서대로 정렬된 size 목록 (예: ['display-2xl', ..., 'text-xs']) */
  sizes: string[]
  /** ['regular', 'medium', 'semibold', 'bold'] */
  weights: string[]
  /** semantic text color slug 목록 (예: ['primary', 'secondary', ...]) */
  colorTokens: string[]
  sizeTokenMap: Record<string, TypographySizeToken>
}

export interface GeneratorWarning {
  code: WarningCode
  message: string
  value?: string
}

// ── 파이프라인 결과 ──────────────────────────────────────────────────

export interface PipelineResult {
  success: boolean
  output: GeneratorOutput | null
  warnings: string[]
  resolvedType: string
  error?: string
}

// ── Legacy 호환 (마이그레이션 완료 전) ──────────────────────────────

/** @deprecated runPipeline의 PipelineResult 사용 */
export type EngineResult = PipelineResult

/** @deprecated PluginPayload 사용 */
export type PluginComponentPayload = PluginPayload
