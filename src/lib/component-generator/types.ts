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
  /** COMPONENT_SET의 실제 variant 옵션 */
  variantOptions?: Record<string, string[]>
  /** COMPONENT_SET 자식 각각의 스타일 */
  variants?: VariantEntry[]
}

export interface VariantEntry {
  properties: Record<string, string>
  /** 렌더링 크기 (px) */
  width?: number
  height?: number
  styles: Record<string, string>
  childStyles: Record<string, Record<string, string>>
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
