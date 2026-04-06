/**
 * Component Generator — 타입 정의
 * 플러그인이 전송하는 실제 payload 구조 기반
 */

// ── 플러그인 payload ────────────────────────────────────────────────

export interface PluginComponentPayload {
  name: string
  meta: {
    nodeId: string
    nodeName: string
    nodeType: string
    masterId: string | null
    masterName: string | null
    figmaFileId: string
  }
  /** 루트 노드 CSS 속성 */
  styles: Record<string, string>
  /** 인라인 스타일 HTML */
  html: string
  /** 클래스 기반 HTML */
  htmlClass: string
  /** 클래스 기반 CSS (Figma CSS 변수 포함) */
  htmlCss: string
  /** 인라인 스타일 JSX */
  jsx: string
  /** 플러그인이 감지한 컴포넌트 타입 */
  detectedType: string
  texts: {
    title: string
    description: string
    actions: string[]
    all: string[]
  }
  /** 하위 요소별 스타일 { "Header row": {...}, "Body row": {...} } */
  childStyles: Record<string, Record<string, string>>
  /** Radix 기반 props 제안 */
  radixProps: Record<string, string>
  /**
   * COMPONENT_SET의 실제 variant 옵션
   * { size: ['xsmall','small','medium','large','xlarge'], variant: ['Primary','Default',...] }
   */
  variantOptions?: Record<string, string[]>
  /**
   * COMPONENT_SET 자식 각각의 스타일
   * [{ properties: { size:'xlarge', variant:'Primary', state:'rest' }, styles: {...}, childStyles: {...} }]
   */
  variants?: Array<{
    properties: Record<string, string>
    styles: Record<string, string>
    childStyles: Record<string, Record<string, string>>
  }>
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
  /** 생성 과정에서 발견된 경고 (토큰 미매핑, 누락 상태 등) */
  warnings: GeneratorWarning[]
}

export type WarningCode =
  | 'UNMAPPED_COLOR'        // hex 값이 디자인 토큰으로 매핑되지 않음
  | 'MISSING_STATE'         // 필수 state(hover/press/disabled)가 variants에 없음
  | 'MISSING_SIZE'          // variantOptions에 있는 size가 variants 데이터에 없음
  | 'NO_VARIANTS_DATA'      // variants 배열이 비어 있어 rootStyles로 폴백
  | 'MISSING_COLOR'         // rest 상태에 background-color 없음
  | 'BLOCK_STYLE_MISMATCH'  // block=true/false 변형 간 스타일 불일치

export interface GeneratorWarning {
  code: WarningCode
  message: string
  /** 관련 값 (예: 매핑 안 된 hex, 누락 state 이름) */
  value?: string
}

export interface EngineResult {
  success: boolean
  output: GeneratorOutput | null
  warnings: string[]
  error?: string
}
