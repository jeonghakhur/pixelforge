/**
 * Size / IconOnly CSS 빌드 유틸
 *
 * button.ts 350~437줄에서 추출한 공통 로직.
 */

import type { GeneratorWarning } from '../../types'
import { mapCssValue, mapRadiusValue, mapSpacingValue, mapFontSizeValue, mapLineHeightValue } from '../../css-var-mapper'
import { isBaseState, mapValue } from './state-css'

type VariantEntry = {
  properties: Record<string, string>
  styles: Record<string, string>
  childStyles: Record<string, Record<string, string>>
}

/**
 * CSS padding/margin shorthand 축약
 * "10px 14px 10px 14px" → "10px 14px"
 * "8px 8px 8px 8px" → "8px"
 * "10px 16px 10px 16px" → "10px 16px"
 */
function compactShorthand(value: string): string {
  const parts = value.split(/\s+/)
  if (parts.length !== 4) return value
  const [top, right, bottom, left] = parts
  if (top === bottom && right === left) {
    return top === right ? top : `${top} ${right}`
  }
  if (top === bottom) return `${top} ${right} ${top} ${left}`
  if (right === left) return `${top} ${right} ${bottom}`
  return value
}


/** padding/gap 등 spacing 값의 각 토큰을 spacing 변수로 매핑 */
function mapSpacingShorthand(value: string): string {
  return value.split(/\s+/).map(v => mapSpacingValue(v)).join(' ')
}

const ICON_CHILD_NAMES = new Set(['search', 'icon', 'arrow', 'chevron', 'arrow-right', 'placeholder'])

/** childStyles에서 Text 노드의 스타일을 찾는다 (아이콘/placeholder 제외) */
function findTextChildStyle(
  childStyles: Record<string, Record<string, string>>,
): Record<string, string> | null {
  for (const [key, cs] of Object.entries(childStyles)) {
    const lower = key.toLowerCase()
    if (ICON_CHILD_NAMES.has(lower)) continue
    if (lower.includes('loading')) continue
    if (cs['font-size'] || cs['font-weight']) return cs
  }
  return null
}

// ── Size CSS ──────────────────────────────────────────────────────────────

export function buildSizeCSSRules(
  variants: VariantEntry[],
  sizeKey: string,
  allSizes: string[],
  stateKey?: string,
  blockKey?: string,
  iconOnlyKey?: string,
  warnings?: GeneratorWarning[],
): string {
  const sizeMap = new Map<string, string>()

  for (const v of variants) {
    const size = v.properties[sizeKey]
    if (!size || sizeMap.has(size)) continue
    // base state 기준 (색상 제외한 레이아웃 값만 추출)
    if (stateKey) {
      const state = v.properties[stateKey]?.toLowerCase()
      if (state && !isBaseState(state)) continue
    }
    if (blockKey && v.properties[blockKey]?.toLowerCase() === 'true') continue
    if (iconOnlyKey && v.properties[iconOnlyKey]?.toLowerCase() === 'true') continue

    const s = v.styles
    const lines: string[] = []
    if (s.padding) lines.push(`  padding: ${mapSpacingShorthand(compactShorthand(mapValue(s.padding)))};`)
    if (s['border-radius']) lines.push(`  border-radius: ${mapRadiusValue(s['border-radius'])};`)
    if (s.gap) lines.push(`  gap: ${mapSpacingValue(mapValue(s.gap))};`)

    // childStyles에서 font-size/line-height 추출 (Text 노드)
    const textStyle = findTextChildStyle(v.childStyles)
    if (textStyle) {
      if (textStyle['font-size']) lines.push(`  font-size: ${mapFontSizeValue(textStyle['font-size'])};`)
      if (textStyle['line-height']) lines.push(`  line-height: ${mapLineHeightValue(textStyle['line-height'])};`)
    }

    if (lines.length) sizeMap.set(size, `.root[data-size='${size}'] {\n${lines.join('\n')}\n}`)
  }

  if (warnings) {
    for (const size of allSizes) {
      if (!sizeMap.has(size)) {
        warnings.push({
          code: 'MISSING_SIZE',
          message: `size '${size}'가 variantOptions에 있지만 variants 데이터에서 찾을 수 없습니다`,
          value: size,
        })
      }
    }
  }

  return Array.from(sizeMap.values()).join('\n\n')
}

// ── Icon Only CSS ────────────────────────────────────────────────────────

export function buildIconOnlyCSSRules(
  variants: VariantEntry[],
  iconOnlyKey: string,
  sizeKey?: string,
  stateKey?: string,
): string {
  const rules: string[] = []
  const sizeMap = new Map<string, string>()

  const iconOnlyVariants = variants.filter(v =>
    v.properties[iconOnlyKey]?.toLowerCase() === 'true',
  )

  for (const v of iconOnlyVariants) {
    const size = sizeKey ? v.properties[sizeKey] : null
    if (size && sizeMap.has(size)) continue
    // base state만
    if (stateKey) {
      const state = v.properties[stateKey]?.toLowerCase()
      if (state && !isBaseState(state)) continue
    }

    const s = v.styles
    const padding = s.padding
    if (!padding) continue

    if (size) {
      sizeMap.set(size, `.root[data-icon-only][data-size='${size}'] {\n  padding: ${mapSpacingShorthand(compactShorthand(mapValue(padding)))};\n}`)
    }
  }

  if (sizeMap.size > 0) {
    rules.push(`.root[data-icon-only] {\n  gap: 0;\n}`)
    rules.push(...Array.from(sizeMap.values()))
  }

  return rules.join('\n\n')
}
