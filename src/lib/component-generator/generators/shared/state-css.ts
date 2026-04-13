/**
 * State CSS 빌드 유틸
 *
 * Figma variant의 state 값을 그대로 data-state attribute로 사용한다.
 * pseudo-class 매핑 없이 범용적으로 동작한다.
 *
 * 생성 예:
 *   .root { ... }                              ← base state (variants 중 첫 번째)
 *   .root[data-state='hover'] { ... }          ← hover state
 *   .root[data-state='disabled'] { ... }       ← disabled state
 */

import type { GeneratorWarning } from '../../types'
import { mapCssValue } from '../../css-var-mapper'

// ── 타입 ──────────────────────────────────────────────────────────────────

export interface StateStyle {
  bg:          string | null
  color:       string | null
  /** 아이콘 슬롯 색상 (placeholder > Icon.iconColor) */
  iconColor:   string | null
  border:      string | null
  borderWidth: string | null
  opacity:     string | null
  borderImage: string | null
  boxShadow:   string | null
}

export interface AppearanceScheme {
  appearanceValue: string
  states: Map<string, StateStyle>
  /** base variant에 padding이 없으면 true (Link 계열 등) */
  noPadding?: boolean
}

// ── Base state 판별 ──────────────────────────────────────────────────────

const BASE_STATE_PATTERNS = /^(rest|default|normal|idle|none)$/i
const DISABLED_STATE_PATTERNS = /^(disabled|inactive|off)$/i

export function isBaseState(state: string): boolean {
  return BASE_STATE_PATTERNS.test(state)
}

export function isDisabledState(state: string): boolean {
  return DISABLED_STATE_PATTERNS.test(state)
}

const LOADING_STATE_PATTERNS = /^(loading|progress|pending|busy)$/i

export function isLoadingState(state: string): boolean {
  return LOADING_STATE_PATTERNS.test(state)
}

// ── CSS 값 변환 헬퍼 ──────────────────────────────────────────────────────

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function mapValue(value: string): string {
  return value.includes('var(--') ? mapCssValue(value) : value
}

export function isRawHex(value: string): boolean {
  return HEX_RE.test(value.trim())
}

export function warnUnmappedHex(
  warnings: GeneratorWarning[],
  value: string | null,
  context: string,
): void {
  if (value && isRawHex(value)) {
    warnings.push({
      code: 'UNMAPPED_COLOR',
      message: `${context}: Figma Variables 미바인딩 hex 값 → 토큰 매핑 필요`,
      value,
    })
  }
}

// ── CSS 빌드: state별 규칙 생성 ───────────────────────────────────────────

export function buildStateCSS(
  stateMap: Map<string, StateStyle>,
  selectorPrefix: string,
  warnings: GeneratorWarning[],
  name: string,
  /** base state에 추가할 CSS 선언 (예: padding 리셋) */
  baseExtras?: string[],
): string {
  const rules: string[] = []
  const iconColorRules: string[] = []

  // base state 스타일 찾기 (중복 제거용)
  let baseStyle: StateStyle | null = null
  for (const [state, style] of stateMap) {
    if (isBaseState(state)) { baseStyle = style; break }
  }

  for (const [state, style] of stateMap) {
    const isBase = isBaseState(state)

    // base → 접두사 그대로, non-base → data-state attribute
    const sel = isBase
      ? selectorPrefix
      : `${selectorPrefix}[data-state='${state}']`

    const lines: string[] = []

    // base state에 추가 CSS (padding 리셋 등)
    if (isBase && baseExtras) {
      for (const extra of baseExtras) lines.push(`  ${extra}`)
    }

    // non-base state: base와 동일한 속성은 생략 (CSS 상속으로 충분)
    const shouldEmit = (prop: keyof StateStyle, value: string | null): boolean => {
      if (!value) return false
      if (isBase || !baseStyle) return true
      return baseStyle[prop] !== value
    }

    if (shouldEmit('bg', style.bg)) {
      lines.push(`  background: ${style.bg};`)
      warnUnmappedHex(warnings, style.bg, `${name} ${state}.bg`)
    }
    if (shouldEmit('color', style.color)) {
      lines.push(`  color: ${style.color};`)
      warnUnmappedHex(warnings, style.color, `${name} ${state}.color`)
    }
    if (shouldEmit('border', style.border)) {
      lines.push(`  border: ${style.border!.startsWith('1px') ? style.border! : `1px solid ${style.border}`};`)
    }
    if (shouldEmit('borderWidth', style.borderWidth)) {
      lines.push(`  border-width: ${style.borderWidth};`)
    }
    if (shouldEmit('borderImage', style.borderImage)) {
      lines.push(`  border-style: solid;`)
      lines.push(`  border-image: ${style.borderImage};`)
    }
    if (shouldEmit('boxShadow', style.boxShadow)) {
      lines.push(`  box-shadow: ${style.boxShadow};`)
    }
    if (style.opacity) lines.push(`  opacity: ${style.opacity};`)

    if (lines.length) rules.push(`${sel} {\n${lines.join('\n')}\n}`)

    // 아이콘 색상 — base는 항상, non-base는 변경된 경우만
    if (shouldEmit('iconColor', style.iconColor)) {
      iconColorRules.push(`${sel} .iconSlot {\n  color: ${style.iconColor};\n}`)
    }
  }

  return [...rules, ...iconColorRules].join('\n\n')
}

export function buildSingleSchemeCSS(
  stateMap: Map<string, StateStyle>,
  warnings: GeneratorWarning[],
  name: string,
): string {
  return buildStateCSS(stateMap, '.root', warnings, name)
}

// ── CSS 빌드: appearance 차원 ─────────────────────────────────────────────

export function buildMultiSchemeCSS(
  appearanceKey: string,
  schemes: AppearanceScheme[],
  warnings: GeneratorWarning[],
  name: string,
): string {
  const rules: string[] = []

  for (const { appearanceValue, states, noPadding } of schemes) {
    const attrVal = appearanceValue.toLowerCase().replace(/\s+/g, '-')
    const sel = `.root[data-${appearanceKey.toLowerCase().replace(/\s+/g, '-')}='${attrVal}']`
    const ctx = `${name}[${appearanceValue}]`

    const css = buildStateCSS(states, sel, warnings, ctx)
    if (css) rules.push(css)
  }

  return rules.join('\n\n')
}
