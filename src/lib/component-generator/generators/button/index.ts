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
import { buildTsx, parseInnerStructure } from '../shared/tsx-builder'
import { mapSpacingValue } from '../../css-var-mapper'
import { parseComponentProperties } from '../../component-props-parser'
import {
  extractStateStyles,
  extractAppearanceSchemes,
  deduplicateByBlock,
  extractSpinnerColor,
} from './extract'

import type { NormalizedPayload, GeneratorOutput } from '../../types'
import type { InnerStructure } from '../shared/tsx-builder'

// ── 내부 요소 CSS 생성 ──────────────────────────────────────────────────

const ICON_SLOT_PATTERNS = /^(placeholder|icon-?slot|icon-?leading|icon-?trailing)/i
const TEXT_WRAPPER_PATTERNS = /^(text\s*padding|text\s*wrapper|label\s*padding)/i

function buildInnerElementsCSS(
  childStyles: Record<string, Record<string, string>>,
  inner: InnerStructure,
): string {
  const rules: string[] = []

  if (inner.hasIconSlot) {
    // placeholder/icon-slot 최상위의 스타일 추출
    for (const [key, cs] of Object.entries(childStyles)) {
      if (!key.includes('>') && ICON_SLOT_PATTERNS.test(key)) {
        const lines: string[] = ['  display: flex;', '  align-items: center;']
        if (cs.opacity) lines.push(`  opacity: ${cs.opacity};`)
        rules.push(`.iconSlot {\n${lines.join('\n')}\n}`)
        break
      }
    }
  }

  if (inner.hasTextWrapper) {
    for (const [key, cs] of Object.entries(childStyles)) {
      if (!key.includes('>') && TEXT_WRAPPER_PATTERNS.test(key)) {
        const lines: string[] = []
        if (cs.display) lines.push(`  display: ${cs.display};`)
        if (cs.padding) {
          // 먼저 px 축약 후 토큰 매핑
          const raw = cs.padding.split(/\s+/)
          // 0px 2px 0px 2px → 0 2px
          let compact: string
          if (raw.length === 4 && raw[0] === raw[2] && raw[1] === raw[3]) {
            compact = raw[0] === raw[1]
              ? mapSpacingValue(raw[0])
              : `${raw[0] === '0px' ? '0' : mapSpacingValue(raw[0])} ${mapSpacingValue(raw[1])}`
          } else {
            compact = raw.map(v => v === '0px' ? '0' : mapSpacingValue(v)).join(' ')
          }
          lines.push(`  padding: ${compact};`)
        }
        if (cs['align-items']) lines.push(`  align-items: ${cs['align-items']};`)
        if (cs['justify-content']) lines.push(`  justify-content: ${cs['justify-content']};`)
        if (lines.length) rules.push(`.textWrapper {\n${lines.join('\n')}\n}`)
        break
      }
    }
  }

  return rules.length > 0 ? `/* ── Inner elements ── */\n${rules.join('\n\n')}` : ''
}

/** childStyles placeholder.width에서 size별 아이콘 크기 CSS 생성 */
function buildIconSizeCSS(
  variants: NormalizedPayload['variants'],
  sizeKey: string,
  stateKey?: string,
): string {
  const sizeMap = new Map<string, string>()

  for (const v of variants) {
    const size = v.properties[sizeKey]
    if (!size || sizeMap.has(size)) continue
    if (stateKey) {
      const state = v.properties[stateKey]?.toLowerCase()
      if (state && !/^(rest|default|normal|idle|none)$/i.test(state)) continue
    }

    const ph = v.childStyles?.['placeholder']
    if (!ph?.width) continue

    sizeMap.set(size, `.root[data-size='${size}'] .iconSlot {\n  width: ${ph.width};\n  height: ${ph.width};\n}`)
  }

  return sizeMap.size > 0
    ? `/* ── Icon size per variant ── */\n${Array.from(sizeMap.values()).join('\n\n')}`
    : ''
}

/**
 * hierarchy별 Loading 스피너 색상 CSS 생성
 *
 * 플러그인이 제공하는 "Buttons/Button loading icon > Line" 색상을 기반으로
 * .loadingLine / .loadingTrack 클래스의 색상을 생성한다.
 * - Line:  스피너 선 (동일 색상, 불투명)
 * - Track: 스피너 트랙 (동일 색상, opacity 0.3)
 */
function buildLoadingSpinnerCSS(
  variants: NormalizedPayload['variants'],
  appearanceKey: string,
  stateKey: string,
): string {
  const rules: string[] = []
  const seen = new Set<string>()

  for (const v of variants) {
    const state = v.properties[stateKey]?.toLowerCase()
    if (state !== 'loading') continue

    const appearance = v.properties[appearanceKey]
    if (!appearance || seen.has(appearance)) continue
    seen.add(appearance)

    const spinnerColor = extractSpinnerColor(v.childStyles)
    if (!spinnerColor) continue

    const attrVal = appearance.toLowerCase().replace(/\s+/g, '-')
    const sel = `.root[data-${appearanceKey.toLowerCase().replace(/\s+/g, '-')}='${attrVal}'][data-state='loading']`

    rules.push(
      `${sel} .loadingLine {\n  color: ${spinnerColor};\n}`,
      `${sel} .loadingTrack {\n  color: ${spinnerColor};\n  opacity: 0.3;\n}`,
    )
  }

  return rules.length > 0
    ? `/* ── Loading spinner colors ── */\n${rules.join('\n\n')}`
    : ''
}

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

  // ── 내부 구조 파싱 (icon slot + text wrapper) ────────────────────────
  const innerStructure = parseInnerStructure(payload.childStyles)

  // componentProperties → 추가 props
  const variantDims = Object.keys(variantOptions)
  const componentProps = parseComponentProperties(payload.componentProperties, variantDims)

  // 내부 요소 CSS 생성
  const innerCSS = buildInnerElementsCSS(payload.childStyles, innerStructure)

  // icon size CSS (childStyles placeholder.width에서 size별 추출)
  const iconSizeCSS = dims.sizeKey ? buildIconSizeCSS(variants, dims.sizeKey, dims.stateKey) : ''

  // Loading 스피너 색상 CSS (hierarchy별)
  const spinnerCSS = appearanceKey && dims.stateKey
    ? buildLoadingSpinnerCSS(variants, appearanceKey, dims.stateKey)
    : ''

  // ── TSX ────────────────────────────────────────────────────────────────
  const tsx = buildTsx(payload, dims, {
    element: ctx.element,
    elementPropsType: 'ButtonHTMLAttributes',
    elementPropsGeneric: '<HTMLButtonElement>',
    innerStructure,
    componentProps,
    overrides: ctx.overrides,
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
${innerCSS ? `\n${innerCSS}` : ''}
${iconSizeCSS ? `\n${iconSizeCSS}` : ''}
${spinnerCSS ? `\n${spinnerCSS}` : ''}
`

  return { name, category: 'action', tsx, css, warnings }
}
