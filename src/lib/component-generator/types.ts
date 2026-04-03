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
}

export interface EngineResult {
  success: boolean
  output: GeneratorOutput | null
  warnings: string[]
  error?: string
}
