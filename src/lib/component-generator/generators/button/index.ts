/**
 * Button 제너레이터
 *
 * shared 유틸 + button/extract.ts를 조합하여
 * Figma Button COMPONENT_SET → TSX + CSS Module 코드를 생성한다.
 */

import type { GeneratorWarning } from '../../types'
import type { GeneratorContext } from '../registry'
import { classifyDimensions } from '../shared/dimensions'
import { buildSingleSchemeCSS, buildMultiSchemeCSS, isDisabledState, isLoadingState } from '../shared/state-css'
import { mapValue, warnUnmappedHex } from '../shared/state-css'
import { mapFontWeightValue } from '../../css-var-mapper'
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
  let noPaddingSelectors: string[] = []

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

    // padding이 없는 hierarchy(Link 계열) — size CSS 뒤에 오버라이드
    noPaddingSelectors = schemes
      .filter(s => s.noPadding)
      .map(s => {
        const attrVal = s.appearanceValue.toLowerCase().replace(/\s+/g, '-')
        return `.root[data-${appearanceKey.toLowerCase().replace(/\s+/g, '-')}='${attrVal}']`
      })
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

  // childStyles에서 font-weight 추출 → 토큰 역매핑
  const baseFontWeight = (() => {
    for (const [key, cs] of Object.entries(payload.childStyles)) {
      if (key.toLowerCase().includes('text') && cs['font-weight']) return mapFontWeightValue(cs['font-weight'])
    }
    return 'var(--font-weight-medium, 500)'
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

  // noPadding hierarchy 오버라이드 (size 뒤에 배치하여 specificity 우선)
  const noPaddingCSS = noPaddingSelectors.length > 0
    ? `/* ── No-padding overrides (Link 계열) ── */\n${noPaddingSelectors.join(',\n')} {\n  padding: 0;\n  border-radius: 0;\n}`
    : ''

  // disabled/loading 공통 state 규칙 (state 이름을 variantOptions에서 동적 감지)
  const stateRules: string[] = []
  if (dims.stateKey) {
    const stateValues = variantOptions[dims.stateKey] ?? []
    for (const s of stateValues) {
      const lower = s.toLowerCase()
      if (isDisabledState(lower)) {
        stateRules.push(`.root[data-state='${lower}'] {\n  cursor: not-allowed;\n  pointer-events: none;\n}`)
      } else if (isLoadingState(lower)) {
        stateRules.push(`.root[data-state='${lower}'] {\n  pointer-events: none;\n}`)
      }
    }
  }
  const stateCSS = stateRules.length > 0
    ? `/* ── State ── */\n${stateRules.join('\n\n')}`
    : ''

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
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-weight: ${baseFontWeight};
  white-space: nowrap;
  font-family: inherit;
  transition: opacity 150ms ease, transform 150ms ease, background 150ms ease;
}

/* ── Color scheme ── */
${colorSchemeCSS}
${sizeCSS ? `\n/* ── Size variants ── */\n${sizeCSS}` : ''}
${noPaddingCSS ? `\n${noPaddingCSS}` : ''}
${blockCSS ? `\n/* ── Block ── */\n${blockCSS}` : ''}
${iconOnlyCSS ? `\n/* ── Icon Only ── */\n${iconOnlyCSS}` : ''}
${stateCSS ? `\n${stateCSS}` : ''}
`

  return { name, category: 'action', tsx, css, warnings }
}
