/**
 * Button 제너레이터
 *
 * shared 유틸 + button/extract.ts를 조합하여
 * Figma Button COMPONENT_SET → TSX + CSS Module 코드를 생성한다.
 */

import type { GeneratorWarning } from '../../types'
import type { GeneratorContext } from '../registry'
import { classifyDimensions } from '../shared/dimensions'
import { buildSingleSchemeCSS, buildMultiSchemeCSS } from '../shared/state-css'
import { mapValue, warnUnmappedHex } from '../shared/state-css'
import { buildSizeCSSRules, buildIconOnlyCSSRules } from '../shared/size-css'
import { buildTsx } from '../shared/tsx-builder'
import {
  extractStateStyles,
  extractAppearanceSchemes,
  deduplicateByBlock,
} from './extract'

import type { NormalizedPayload, GeneratorOutput } from '../../types'

export function generateButton(
  payload: NormalizedPayload,
  ctx: GeneratorContext,
): GeneratorOutput {
  const { name, variantOptions, variants, styles: rootStyles } = payload
  const warnings: GeneratorWarning[] = []
  const dims    = classifyDimensions(variantOptions)
  const hasData = variants.length > 0

  if (!hasData) {
    warnings.push({
      code: 'NO_VARIANTS_DATA',
      message: `variants 배열이 비어 있습니다. rootStyles 기반으로 최소 CSS만 생성합니다.`,
    })
  }

  // block=true/false 스타일 일관성 검증
  if (dims.blockKey) {
    deduplicateByBlock(variants, dims.blockKey, warnings)
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
    } else {
      colorSchemeCSS = '/* color data not available */'
      warnings.push({ code: 'MISSING_COLOR', message: `${name}: rootStyles에 background-color가 없습니다` })
    }
  } else if (dims.stateKey && appearanceValues.length === 0) {
    const stateMap = extractStateStyles(variants, dims.stateKey, warnings, dims.blockKey, dims.iconOnlyKey)
    colorSchemeCSS = buildSingleSchemeCSS(stateMap, warnings, name)
  } else if (dims.stateKey && appearanceKey) {
    const schemes = extractAppearanceSchemes(variants, appearanceKey, dims.stateKey, warnings, dims.blockKey, dims.iconOnlyKey)
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

  const baseGap = rootStyles.gap ? mapValue(rootStyles.gap) : null

  // childStyles에서 font-weight 추출 (base CSS용)
  const baseFontWeight = (() => {
    for (const [key, cs] of Object.entries(payload.childStyles)) {
      if (key.toLowerCase().includes('text') && cs['font-weight']) return cs['font-weight']
    }
    return '500'
  })()

  // ── TSX ────────────────────────────────────────────────────────────────
  const tsx = buildTsx(payload, dims, {
    element: ctx.element,
    elementPropsType: 'ButtonHTMLAttributes',
    elementPropsGeneric: '<HTMLButtonElement>',
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
  justify-content: center;${baseGap ? `\n  gap: ${baseGap};` : ''}
  border: none;
  cursor: pointer;
  font-weight: ${baseFontWeight};
  white-space: nowrap;
  font-family: inherit;
  transition: opacity 150ms ease, transform 150ms ease, background 150ms ease;
}

.root:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

/* ── Color scheme ── */
${colorSchemeCSS}
${sizeCSS ? `\n/* ── Size variants ── */\n${sizeCSS}` : ''}
${blockCSS ? `\n/* ── Block ── */\n${blockCSS}` : ''}
${iconOnlyCSS ? `\n/* ── Icon Only ── */\n${iconOnlyCSS}` : ''}
`

  return { name, category: 'action', tsx, css, warnings }
}
