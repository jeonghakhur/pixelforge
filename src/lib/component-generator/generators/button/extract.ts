/**
 * Button 전용 추출 로직
 *
 * variants 데이터에서 버튼 특화 스타일(텍스트 색상, disabled opacity,
 * state/appearance 스킴)을 추출한다.
 */

import type { GeneratorWarning } from '../../types'
import type { StateStyle, AppearanceScheme } from '../shared/state-css'
import { isBaseState, isDisabledState, mapValue } from '../shared/state-css'

type VariantEntry = {
  properties: Record<string, string>
  styles: Record<string, string>
  childStyles: Record<string, Record<string, string>>
}

// ── 자식 텍스트/아이콘 색상 추출 ────────────────────────────────────────

const ICON_CHILD_NAMES = new Set(['search', 'icon', 'arrow', 'chevron', 'arrow-right', 'placeholder'])

/**
 * childStyles에서 아이콘 색상을 추출한다.
 *
 * 플러그인이 "placeholder > Icon" 키에 iconColor 필드를 제공한다.
 * (VECTOR의 border 값에서 추출한 실제 fill 색상)
 */
export function extractIconColor(
  childStyles: Record<string, Record<string, string>>,
): string | null {
  for (const [key, cs] of Object.entries(childStyles)) {
    if (key.toLowerCase().includes('> icon')) {
      const ic = (cs as Record<string, string>).iconColor
      return ic ? mapValue(ic) : null
    }
  }
  return null
}

/**
 * Loading 상태의 스피너 색상을 추출한다.
 *
 * 플러그인이 "Buttons/Button loading icon > Line" / "> Background" 키에
 * iconColor 필드를 제공한다. Line의 iconColor = 스피너 선 색상.
 * (track은 동일 색상 + opacity 0.3으로 CSS에서 처리)
 */
export function extractSpinnerColor(
  childStyles: Record<string, Record<string, string>>,
): string | null {
  for (const [key, cs] of Object.entries(childStyles)) {
    if (key.toLowerCase().includes('loading icon > line')) {
      const ic = (cs as Record<string, string>).iconColor
      return ic ? mapValue(ic) : null
    }
  }
  return null
}

/**
 * 자식 텍스트 노드의 색상을 추출한다.
 *
 * [플러그인 quirk] Figma 플러그인이 TEXT 노드의 fill(글자색)을
 * CSS `color` 대신 `background-color` 키로 전달하는 경우가 있다.
 * 따라서 `color`를 먼저 시도하고, 없으면 `background-color`를 텍스트 색으로 사용한다.
 * 아이콘/placeholder 자식은 제외한다.
 */
export function extractChildTextColor(
  childStyles: Record<string, Record<string, string>>,
): string | null {
  for (const [key, cs] of Object.entries(childStyles)) {
    if (ICON_CHILD_NAMES.has(key.toLowerCase())) continue
    if (key.toLowerCase().includes('loading')) continue
    if (cs.color) return mapValue(cs.color)
    if (cs['background-color']) return mapValue(cs['background-color'])
  }
  return null
}

// ── state별 스타일 집합 ───────────────────────────────────────────────────

/**
 * disabled 상태의 opacity를 결정론적으로 추출한다.
 */
export function extractDisabledOpacity(
  childStyles: Record<string, Record<string, string>>,
  rootStyles: Record<string, string>,
): string | null {
  if (rootStyles.opacity) return rootStyles.opacity
  for (const [key, cs] of Object.entries(childStyles)) {
    if (!ICON_CHILD_NAMES.has(key.toLowerCase()) && !key.toLowerCase().includes('loading') && cs.opacity) return cs.opacity
  }
  for (const [key, cs] of Object.entries(childStyles)) {
    if (ICON_CHILD_NAMES.has(key.toLowerCase()) && cs.opacity) return cs.opacity
  }
  return null
}

export function toStateStyle(v: VariantEntry): StateStyle {
  const s = v.styles
  return {
    bg:          s['background-color'] ? mapValue(s['background-color']) : null,
    color:       extractChildTextColor(v.childStyles),
    iconColor:   extractIconColor(v.childStyles),
    border:      s['border'] ?? s['border-color'] ?? null,
    borderWidth: s['border-width'] ?? null,
    opacity:     null,
    borderImage: s['border-image'] ?? null,
    boxShadow:   s['box-shadow'] ?? null,
  }
}

export function toDisabledStateStyle(v: VariantEntry): StateStyle {
  const s = v.styles
  return {
    bg:          s['background-color'] ? mapValue(s['background-color']) : null,
    color:       extractChildTextColor(v.childStyles),
    iconColor:   extractIconColor(v.childStyles),
    border:      s['border'] ?? s['border-color'] ?? null,
    borderWidth: s['border-width'] ?? null,
    opacity:     extractDisabledOpacity(v.childStyles, s),
    borderImage: s['border-image'] ?? null,
    boxShadow:   s['box-shadow'] ?? null,
  }
}

export function deduplicateByBlock(
  variants: VariantEntry[],
  blockKey: string,
  warnings: GeneratorWarning[],
): void {
  const withBlock    = variants.filter(v => v.properties[blockKey]?.toLowerCase() === 'true')
  const withoutBlock = variants.filter(v => v.properties[blockKey]?.toLowerCase() !== 'true')

  for (const blockV of withBlock) {
    const otherProps = { ...blockV.properties }
    delete otherProps[blockKey]

    const match = withoutBlock.find(v => {
      const props = { ...v.properties }
      delete props[blockKey]
      return JSON.stringify(props) === JSON.stringify(otherProps)
    })

    if (match && JSON.stringify(blockV.styles) !== JSON.stringify(match.styles)) {
      warnings.push({
        code: 'BLOCK_STYLE_MISMATCH',
        message: `block=true/false 변형 간 스타일 불일치: ${JSON.stringify(otherProps)}`,
        value: blockKey,
      })
    }
  }
}

// ── State 스타일 추출 ────────────────────────────────────────────────────

export function extractStateStyles(
  variants: VariantEntry[],
  stateKey: string,
  warnings: GeneratorWarning[],
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
    map.set(state, isDisabledState(state) ? toDisabledStateStyle(v) : toStateStyle(v))
  }
  return map
}

export function extractAppearanceSchemes(
  variants: VariantEntry[],
  appearanceKey: string,
  stateKey: string,
  warnings: GeneratorWarning[],
  blockKey?: string,
  iconOnlyKey?: string,
): AppearanceScheme[] {
  let base = blockKey
    ? variants.filter(v => v.properties[blockKey]?.toLowerCase() !== 'true')
    : variants
  if (iconOnlyKey) {
    base = base.filter(v => v.properties[iconOnlyKey]?.toLowerCase() !== 'true')
  }

  const appearanceValues = [
    ...new Set(base.map(v => v.properties[appearanceKey]).filter(Boolean)),
  ]

  return appearanceValues.map(appearanceValue => {
    const states = new Map<string, StateStyle>()
    let noPadding = false
    for (const v of base) {
      if (v.properties[appearanceKey] !== appearanceValue) continue
      const state = v.properties[stateKey]?.toLowerCase()
      if (!state || states.has(state)) continue
      states.set(state, isDisabledState(state) ? toDisabledStateStyle(v) : toStateStyle(v))
      // base state에서 padding 유무 감지
      if (isBaseState(state) && !v.styles.padding) noPadding = true
    }
    return { appearanceValue, states, noPadding }
  })
}
