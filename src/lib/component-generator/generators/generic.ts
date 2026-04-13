/**
 * 범용 폴백 제너레이터
 *
 * 전용 제너레이터가 없는 컴포넌트 타입에 대해
 * shared 유틸만으로 TSX + CSS를 생성한다.
 */

import type { NormalizedPayload, GeneratorOutput, GeneratorWarning, ComponentCategory } from '../types'
import type { GeneratorContext } from './registry'
import { classifyDimensions } from './shared/dimensions'
import { buildSingleSchemeCSS, buildMultiSchemeCSS, mapValue, warnUnmappedHex, isDisabledState } from './shared/state-css'
import type { StateStyle } from './shared/state-css'
import { buildSizeCSSRules, buildIconOnlyCSSRules } from './shared/size-css'
import { buildTsx } from './shared/tsx-builder'

/** 이름 기반으로 카테고리 추론 */
function inferCategory(name: string): ComponentCategory {
  const lower = name.toLowerCase()
  if (/button|toggle|switch/.test(lower)) return 'action'
  if (/input|field|form|select|textarea|checkbox|radio/.test(lower)) return 'form'
  if (/nav|tab|menu|breadcrumb|pagination/.test(lower)) return 'navigation'
  if (/alert|toast|badge|spinner|modal|dialog/.test(lower)) return 'feedback'
  return 'action'
}

/** 범용 state 추출 (button 전용 extractChildTextColor 미사용) */
function extractGenericStateStyles(
  variants: NormalizedPayload['variants'],
  stateKey: string,
  blockKey?: string,
  iconOnlyKey?: string,
): Map<string, StateStyle> {
  const map = new Map<string, StateStyle>()
  let base = blockKey
    ? variants.filter(v => v.properties[blockKey]?.toLowerCase() !== 'true')
    : variants
  if (iconOnlyKey) {
    base = base.filter(v => v.properties[iconOnlyKey]?.toLowerCase() !== 'true')
  }

  for (const v of base) {
    const state = v.properties[stateKey]?.toLowerCase()
    if (!state || map.has(state)) continue
    const s = v.styles
    map.set(state, {
      bg:          s['background-color'] ? mapValue(s['background-color']) : null,
      color:       s.color ? mapValue(s.color) : null,
      iconColor:   null,
      border:      s['border'] ?? s['border-color'] ?? null,
      borderWidth: s['border-width'] ?? null,
      opacity:     isDisabledState(state) ? (s.opacity ?? null) : null,
      borderImage: s['border-image'] ?? null,
      boxShadow:   s['box-shadow'] ?? null,
    })
  }
  return map
}

function extractGenericAppearanceSchemes(
  variants: NormalizedPayload['variants'],
  appearanceKey: string,
  stateKey: string,
  blockKey?: string,
  iconOnlyKey?: string,
) {
  let base = blockKey
    ? variants.filter(v => v.properties[blockKey]?.toLowerCase() !== 'true')
    : variants
  if (iconOnlyKey) {
    base = base.filter(v => v.properties[iconOnlyKey]?.toLowerCase() !== 'true')
  }

  const values = [...new Set(base.map(v => v.properties[appearanceKey]).filter(Boolean))]

  return values.map(appearanceValue => {
    const states = new Map<string, StateStyle>()
    for (const v of base) {
      if (v.properties[appearanceKey] !== appearanceValue) continue
      const state = v.properties[stateKey]?.toLowerCase()
      if (!state || states.has(state)) continue
      const s = v.styles
      states.set(state, {
        bg:          s['background-color'] ? mapValue(s['background-color']) : null,
        color:       s.color ? mapValue(s.color) : null,
        iconColor:   null,
        border:      s['border'] ?? s['border-color'] ?? null,
        borderWidth: s['border-width'] ?? null,
        opacity:     isDisabledState(state) ? (s.opacity ?? null) : null,
        borderImage: s['border-image'] ?? null,
        boxShadow:   s['box-shadow'] ?? null,
      })
    }
    return { appearanceValue, states }
  })
}

/** element → React props type (name + generic 분리) */
function getElementPropsType(element: string): { type: string; generic: string } {
  switch (element) {
    case 'button':  return { type: 'ButtonHTMLAttributes', generic: '<HTMLButtonElement>' }
    case 'input':   return { type: 'InputHTMLAttributes', generic: '<HTMLInputElement>' }
    case 'a':       return { type: 'AnchorHTMLAttributes', generic: '<HTMLAnchorElement>' }
    case 'span':    return { type: 'HTMLAttributes', generic: '<HTMLSpanElement>' }
    case 'article': return { type: 'HTMLAttributes', generic: '<HTMLElement>' }
    default:        return { type: 'HTMLAttributes', generic: '<HTMLDivElement>' }
  }
}

export function generateGeneric(
  payload: NormalizedPayload,
  ctx: GeneratorContext,
): GeneratorOutput {
  const { name, variantOptions, variants, styles: rootStyles } = payload
  const warnings: GeneratorWarning[] = []
  const dims = classifyDimensions(variantOptions)
  const hasData = variants.length > 0

  if (!hasData) {
    warnings.push({
      code: 'NO_VARIANTS_DATA',
      message: `variants 배열이 비어 있습니다. rootStyles 기반으로 최소 CSS만 생성합니다.`,
    })
  }

  // ── 색상 스킴 CSS ─────────────────────────────────────────────────────
  const appearanceKey    = dims.appearanceKeys[0]
  const appearanceValues = appearanceKey ? variantOptions[appearanceKey] : []
  let colorSchemeCSS = ''

  if (!hasData) {
    const bg = rootStyles['background-color']
    if (bg) {
      colorSchemeCSS = `.root {\n  background: ${mapValue(bg)};\n}`
      warnUnmappedHex(warnings, mapValue(bg), `${name} rootStyles`)
    }
  } else if (dims.stateKey && appearanceValues.length === 0) {
    const stateMap = extractGenericStateStyles(variants, dims.stateKey, dims.blockKey, dims.iconOnlyKey)
    colorSchemeCSS = buildSingleSchemeCSS(stateMap, warnings, name)
  } else if (dims.stateKey && appearanceKey) {
    const schemes = extractGenericAppearanceSchemes(variants, appearanceKey, dims.stateKey, dims.blockKey, dims.iconOnlyKey)
    colorSchemeCSS = buildMultiSchemeCSS(appearanceKey, schemes, warnings, name)
  }

  // ── Size / Block / Icon Only CSS ─────────────────────────────────────
  const sizeValues = dims.sizeKey ? variantOptions[dims.sizeKey] : []

  const sizeCSS = hasData && dims.sizeKey
    ? buildSizeCSSRules(variants, dims.sizeKey, sizeValues, dims.stateKey, dims.blockKey, dims.iconOnlyKey, warnings)
    : ''

  const blockCSS = dims.blockKey
    ? `.root[data-block] {\n  display: flex;\n  width: 100%;\n}`
    : ''

  const iconOnlyCSS = dims.iconOnlyKey
    ? buildIconOnlyCSSRules(variants, dims.iconOnlyKey, dims.sizeKey, dims.stateKey)
    : ''

  // ── TSX ────────────────────────────────────────────────────────────────
  const propsType = getElementPropsType(ctx.element)
  const tsx = buildTsx(payload, dims, {
    element: ctx.element,
    elementPropsType: propsType.type,
    elementPropsGeneric: propsType.generic,
    overrides: ctx.overrides,
  })

  // ── CSS 조합 ──────────────────────────────────────────────────────────
  const variantSummary = Object.entries(variantOptions)
    .map(([k, v]) => `${k}(${v.join('|')})`)
    .join(', ')

  const css = `/**
 * ${name}.module.css
 * source: ${hasData ? 'Figma COMPONENT_SET variants data' : 'payload.styles (variants 없음)'}
 * ${variantSummary}
 */

/* ── Base ── */
.root {
  display: inline-flex;
  align-items: center;
}

${colorSchemeCSS ? `/* ── Color scheme ── */\n${colorSchemeCSS}` : ''}
${sizeCSS ? `\n/* ── Size variants ── */\n${sizeCSS}` : ''}
${blockCSS ? `\n/* ── Block ── */\n${blockCSS}` : ''}
${iconOnlyCSS ? `\n/* ── Icon Only ── */\n${iconOnlyCSS}` : ''}
`

  return { name, category: inferCategory(name), tsx, css, warnings }
}
