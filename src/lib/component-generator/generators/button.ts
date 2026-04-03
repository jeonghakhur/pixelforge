import type { PluginComponentPayload, GeneratorOutput, GeneratorWarning } from '../types';
import { mapCssValue } from '../css-var-mapper';

type VariantEntry = NonNullable<PluginComponentPayload['variants']>[number];

// ── 차원 분류 ─────────────────────────────────────────────────────────────
//
// variantOptions 키를 역할별로 분류한다.
//   state:  rest/hover/press/disabled → CSS pseudo-class / data-disabled
//   size:   xsmall/small/...         → padding·radius·gap 규칙
//   block:  true/false               → width: 100%
//   나머지: 색상·스타일 variant       → CSS data-attribute selector

interface DimensionKeys {
  stateKey:       string | undefined
  sizeKey:        string | undefined
  blockKey:       string | undefined
  appearanceKeys: string[]
}

function classifyDimensions(variantOptions: Record<string, string[]>): DimensionKeys {
  const keys = Object.keys(variantOptions)
  const lower = (k: string) => k.toLowerCase()
  return {
    stateKey:       keys.find(k => lower(k) === 'state'),
    sizeKey:        keys.find(k => lower(k) === 'size'),
    blockKey:       keys.find(k => lower(k) === 'block'),
    appearanceKeys: keys.filter(k => !['state', 'size', 'block'].includes(lower(k))),
  }
}

// ── CSS 값 변환 ───────────────────────────────────────────────────────────
//
// Figma Variables가 바인딩된 경우: var(--X) → mapCssValue() 로 시맨틱 변수 치환
// 바인딩이 없는 경우: raw 값(hex, px 등)을 그대로 사용 + 경고

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function mapValue(value: string): string {
  return value.includes('var(--') ? mapCssValue(value) : value
}

function isRawHex(value: string): boolean {
  return HEX_RE.test(value.trim())
}

// ── 자식 텍스트 색상 추출 ────────────────────────────────────────────────

const ICON_CHILD_NAMES = new Set(['search', 'icon', 'arrow', 'chevron', 'arrow-right'])

function extractChildTextColor(
  childStyles: Record<string, Record<string, string>>,
): string | null {
  for (const [key, cs] of Object.entries(childStyles)) {
    if (ICON_CHILD_NAMES.has(key.toLowerCase())) continue
    if (cs.color)             return mapValue(cs.color)
    if (cs['background-color']) return mapValue(cs['background-color'])
  }
  return null
}

// ── state별 스타일 집합 ───────────────────────────────────────────────────

interface StateStyle {
  bg:      string | null
  color:   string | null
  border:  string | null
  opacity: string | null
}

function toStateStyle(v: VariantEntry): StateStyle {
  const s = v.styles
  const childOpacity =
    Object.values(v.childStyles).find(cs => cs.opacity)?.opacity ?? null
  return {
    bg:      s['background-color'] ? mapValue(s['background-color']) : null,
    color:   extractChildTextColor(v.childStyles),
    border:  s['border'] ?? s['border-color'] ?? null,
    opacity: childOpacity ?? s.opacity ?? null,
  }
}

// ── 경고 수집 헬퍼 ────────────────────────────────────────────────────────

function warnUnmappedHex(
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

function warnMissingState(
  warnings: GeneratorWarning[],
  state: string,
  context: string,
): void {
  warnings.push({
    code: 'MISSING_STATE',
    message: `${context}: '${state}' 상태 데이터가 variants에 없습니다`,
    value: state,
  })
}

// ── Case A: appearance 차원 없음 (state만으로 색상 구분) ──────────────────

function extractStateColorsByState(
  variants: VariantEntry[],
  stateKey: string,
  blockKey?: string,
): Map<string, StateStyle> {
  const map = new Map<string, StateStyle>()
  const base = blockKey
    ? variants.filter(v => v.properties[blockKey]?.toLowerCase() !== 'true')
    : variants

  for (const v of base) {
    const state = v.properties[stateKey]?.toLowerCase()
    if (!state || map.has(state)) continue
    map.set(state, toStateStyle(v))
  }
  return map
}

function buildSingleSchemeCSS(
  stateMap: Map<string, StateStyle>,
  warnings: GeneratorWarning[],
  name: string,
): string {
  const rules: string[] = []

  // rest → base
  const rest = stateMap.get('rest')
  if (rest) {
    const lines: string[] = []
    if (rest.bg) {
      lines.push(`  background: ${rest.bg};`)
      warnUnmappedHex(warnings, rest.bg, `${name} rest.bg`)
    } else {
      warnings.push({ code: 'MISSING_COLOR', message: `${name}: rest 상태에 background-color가 없습니다` })
    }
    if (rest.color) {
      lines.push(`  color: ${rest.color};`)
      warnUnmappedHex(warnings, rest.color, `${name} rest.color`)
    }
    if (rest.border) lines.push(`  border: ${rest.border.startsWith('1px') ? rest.border : `1px solid ${rest.border}`};`)
    if (lines.length) rules.push(`.root {\n${lines.join('\n')}\n}`)
  } else {
    warnMissingState(warnings, 'rest', name)
  }

  // hover
  const hover = stateMap.get('hover')
  if (hover?.bg) {
    const borderLine = hover.border ? `\n  border: ${hover.border};` : ''
    rules.push(`.root:hover:not([data-disabled]) {\n  background: ${hover.bg};${borderLine}\n}`)
    warnUnmappedHex(warnings, hover.bg, `${name} hover.bg`)
  } else {
    warnMissingState(warnings, 'hover', name)
  }

  // press → :active
  const press = stateMap.get('press')
  if (press?.bg) {
    rules.push(`.root:active:not([data-disabled]) {\n  background: ${press.bg};\n  transform: scale(0.98);\n}`)
    warnUnmappedHex(warnings, press.bg, `${name} press.bg`)
  } else {
    warnMissingState(warnings, 'press', name)
  }

  // disabled
  const disabled = stateMap.get('disabled')
  if (disabled) {
    const lines: string[] = []
    if (disabled.opacity) lines.push(`  opacity: ${disabled.opacity};`)
    if (disabled.bg) {
      lines.push(`  background: ${disabled.bg};`)
      warnUnmappedHex(warnings, disabled.bg, `${name} disabled.bg`)
    }
    if (disabled.color) lines.push(`  color: ${disabled.color};`)
    lines.push(`  cursor: not-allowed;`, `  pointer-events: none;`)
    rules.push(`.root[data-disabled] {\n${lines.join('\n')}\n}`)
  } else {
    warnMissingState(warnings, 'disabled', name)
  }

  return rules.join('\n\n')
}

// ── Case B: appearance 차원 있음 ─────────────────────────────────────────

interface AppearanceScheme {
  appearanceValue: string
  rest:     StateStyle
  hover:    StateStyle | null
  press:    StateStyle | null
  disabled: StateStyle | null
}

function extractAppearanceSchemes(
  variants: VariantEntry[],
  appearanceKey: string,
  stateKey: string,
  blockKey?: string,
): AppearanceScheme[] {
  const base = blockKey
    ? variants.filter(v => v.properties[blockKey]?.toLowerCase() !== 'true')
    : variants

  const appearanceValues = [
    ...new Set(base.map(v => v.properties[appearanceKey]).filter(Boolean)),
  ]

  return appearanceValues.map(appearanceValue => {
    const getState = (state: string): StateStyle | null => {
      const v = base.find(
        e => e.properties[appearanceKey] === appearanceValue
          && e.properties[stateKey]?.toLowerCase() === state,
      )
      return v ? toStateStyle(v) : null
    }

    const rest = getState('rest')
    return {
      appearanceValue,
      rest:     rest ?? { bg: null, color: null, border: null, opacity: null },
      hover:    getState('hover'),
      press:    getState('press'),
      disabled: getState('disabled'),
    }
  })
}

function buildMultiSchemeCSS(
  appearanceKey: string,
  schemes: AppearanceScheme[],
  warnings: GeneratorWarning[],
  name: string,
): string {
  const rules: string[] = []

  for (const { appearanceValue, rest, hover, press, disabled } of schemes) {
    const sel = `.root[data-${appearanceKey.toLowerCase()}='${appearanceValue}']`
    const ctx = `${name}[${appearanceValue}]`

    if (rest.bg || rest.color || rest.border) {
      const lines: string[] = []
      if (rest.bg) {
        lines.push(`  background: ${rest.bg};`)
        warnUnmappedHex(warnings, rest.bg, `${ctx} rest.bg`)
      }
      if (rest.color) lines.push(`  color: ${rest.color};`)
      if (rest.border) lines.push(`  border: ${rest.border.startsWith('1px') ? rest.border : `1px solid ${rest.border}`};`)
      rules.push(`${sel} {\n${lines.join('\n')}\n}`)
    } else {
      warnings.push({ code: 'MISSING_COLOR', message: `${ctx}: rest 상태에 색상 데이터가 없습니다` })
    }

    if (hover?.bg) {
      rules.push(`${sel}:hover:not([data-disabled]) {\n  background: ${hover.bg};\n}`)
      warnUnmappedHex(warnings, hover.bg, `${ctx} hover.bg`)
    } else {
      warnMissingState(warnings, 'hover', ctx)
    }

    if (press?.bg) {
      rules.push(`${sel}:active:not([data-disabled]) {\n  background: ${press.bg};\n  transform: scale(0.98);\n}`)
    } else {
      warnMissingState(warnings, 'press', ctx)
    }

    if (disabled) {
      const lines: string[] = []
      if (disabled.opacity) lines.push(`  opacity: ${disabled.opacity};`)
      if (disabled.bg) lines.push(`  background: ${disabled.bg};`)
      if (disabled.color) lines.push(`  color: ${disabled.color};`)
      lines.push(`  cursor: not-allowed;`, `  pointer-events: none;`)
      rules.push(`${sel}[data-disabled] {\n${lines.join('\n')}\n}`)
    } else {
      warnMissingState(warnings, 'disabled', ctx)
    }
  }

  return rules.join('\n\n')
}

// ── Size CSS ──────────────────────────────────────────────────────────────

function buildSizeCSSRules(
  variants: VariantEntry[],
  sizeKey: string,
  allSizes: string[],
  stateKey?: string,
  blockKey?: string,
  warnings?: GeneratorWarning[],
): string {
  const sizeMap = new Map<string, string>()

  for (const v of variants) {
    const size = v.properties[sizeKey]
    if (!size || sizeMap.has(size)) continue
    if (stateKey && v.properties[stateKey]?.toLowerCase() !== 'rest') continue
    if (blockKey && v.properties[blockKey]?.toLowerCase() === 'true') continue

    const s = v.styles
    const lines: string[] = []
    if (s.padding)          lines.push(`  padding: ${mapValue(s.padding)};`)
    if (s['border-radius']) lines.push(`  border-radius: ${mapValue(s['border-radius'])};`)
    if (s.gap)              lines.push(`  gap: ${mapValue(s.gap)};`)
    if (s.height)           lines.push(`  min-height: ${mapValue(s.height)};`)

    if (lines.length) sizeMap.set(size, `.root[data-size='${size}'] {\n${lines.join('\n')}\n}`)
  }

  // variantOptions에 있지만 variants 데이터에 없는 size → 경고
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

// ── 유틸 ──────────────────────────────────────────────────────────────────

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// ── 메인 생성 함수 ────────────────────────────────────────────────────────

export function generateButton(payload: PluginComponentPayload): GeneratorOutput {
  const {
    name,
    variantOptions = {},
    variants = [],
    styles: rootStyles = {},
  } = payload

  const warnings: GeneratorWarning[] = []
  const dims    = classifyDimensions(variantOptions)
  const hasData = variants.length > 0

  if (!hasData) {
    warnings.push({
      code: 'NO_VARIANTS_DATA',
      message: `variants 배열이 비어 있습니다. rootStyles 기반으로 최소 CSS만 생성합니다.`,
    })
  }

  // ── 타입 Union: variantOptions에서 직접 파생 ─────────────────────────
  const sizeValues      = dims.sizeKey ? variantOptions[dims.sizeKey] : []
  const sizeUnion       = sizeValues.length > 0 ? sizeValues.map(s => `'${s}'`).join(' | ') : "'medium'"
  const defaultSize     = sizeValues[0] ?? 'medium'

  const appearanceKey    = dims.appearanceKeys[0]
  const appearanceValues = appearanceKey ? variantOptions[appearanceKey] : []
  const appearanceUnion  = appearanceValues.length > 0
    ? appearanceValues.map(v => `'${v}'`).join(' | ')
    : null
  const defaultAppearance = appearanceValues[0] ?? null

  const hasBlock = dims.blockKey !== undefined

  // ── 색상 스킴 CSS ─────────────────────────────────────────────────────
  let colorSchemeCSS = ''

  if (!hasData) {
    // variants 없음 → rootStyles 폴백
    const bg = rootStyles['background-color']
    if (bg) {
      colorSchemeCSS = `.root {\n  background: ${mapValue(bg)};\n}`
      warnUnmappedHex(warnings, mapValue(bg), `${name} rootStyles`)
    } else {
      colorSchemeCSS = '/* color data not available */'
      warnings.push({ code: 'MISSING_COLOR', message: `${name}: rootStyles에 background-color가 없습니다` })
    }
  } else if (dims.stateKey && appearanceValues.length === 0) {
    // state만 있음 → 단일 색상 스킴
    const stateMap = extractStateColorsByState(variants, dims.stateKey, dims.blockKey)
    colorSchemeCSS  = buildSingleSchemeCSS(stateMap, warnings, name)
  } else if (dims.stateKey && appearanceKey) {
    // appearance + state 매트릭스
    const schemes  = extractAppearanceSchemes(variants, appearanceKey, dims.stateKey, dims.blockKey)
    colorSchemeCSS = buildMultiSchemeCSS(appearanceKey, schemes, warnings, name)
  }

  // ── Size / Block CSS ─────────────────────────────────────────────────
  const sizeCSS = hasData && dims.sizeKey
    ? buildSizeCSSRules(variants, dims.sizeKey, sizeValues, dims.stateKey, dims.blockKey, warnings)
    : ''

  const blockCSS = hasBlock
    ? `.root[data-block] {\n  display: flex;\n  width: 100%;\n}`
    : ''

  // root gap: rootStyles에서 추출 (size별 규칙에서도 중복 설정되지만 base에도 명시)
  const baseGap = rootStyles.gap ? mapValue(rootStyles.gap) : null

  // ── TSX 생성 ──────────────────────────────────────────────────────────
  const appearanceTypeDef = appearanceUnion
    ? `export type ${name}${capitalizeFirst(appearanceKey)} = ${appearanceUnion};\n`
    : ''
  const appearanceProp    = appearanceUnion ? `\n  ${appearanceKey}?: ${name}${capitalizeFirst(appearanceKey)};` : ''
  const appearanceDefault = appearanceUnion ? `\n      ${appearanceKey} = '${defaultAppearance}',` : ''
  const appearanceAttr    = appearanceUnion ? `\n      data-${appearanceKey.toLowerCase()}={${appearanceKey}}` : ''
  const blockProp         = hasBlock ? `\n  block?: boolean;` : ''
  const blockDefault      = hasBlock ? `\n      block = false,` : ''
  const blockAttr         = hasBlock ? `\n      data-block={block ? '' : undefined}` : ''

  const tsx = `import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './${name}.module.css';

${appearanceTypeDef}export type ${name}Size = ${sizeUnion};

export interface ${name}Props extends ButtonHTMLAttributes<HTMLButtonElement> {${appearanceProp}
  size?: ${name}Size;${blockProp}
  children?: ReactNode;
}

/**
 * ${name} — Figma COMPONENT_SET 기반 자동 생성
 * dimensions: ${JSON.stringify(Object.fromEntries(
    Object.entries(variantOptions).map(([k, v]) => [k, v.length]),
  ))}
 */
export const ${name} = forwardRef<HTMLButtonElement, ${name}Props>(
  (
    {${appearanceDefault}
      size = '${defaultSize}',${blockDefault}
      disabled,
      children,
      className = '',
      type = 'button',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      data-size={size}${appearanceAttr}${blockAttr}
      data-disabled={disabled ? '' : undefined}
      aria-disabled={disabled || undefined}
      className={\`\${styles.root}\${className ? \` \${className}\` : ''}\`}
      {...props}
    >
      {children}
    </button>
  ),
);
${name}.displayName = '${name}';

export default ${name};
`

  // ── CSS 생성 ──────────────────────────────────────────────────────────
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
  font-weight: 500;
  line-height: 1;
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
`

  return { name, category: 'action', tsx, css, warnings }
}
