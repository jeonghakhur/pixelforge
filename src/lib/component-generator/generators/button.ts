import type { PluginComponentPayload, GeneratorOutput, GeneratorWarning } from '../types';
import { mapCssValue, mapRadiusValue } from '../css-var-mapper';

type VariantEntry = NonNullable<PluginComponentPayload['variants']>[number];

// ── 차원 분류 ─────────────────────────────────────────────────────────────
//
// variantOptions 키를 역할별로 분류한다.
//   state:    rest/hover/press/disabled 또는 Default/Hover/Focused/Disabled/Loading
//   size:     xs/sm/md/lg/xl 또는 xsmall/small/...
//   block:    true/false               → width: 100%
//   iconOnly: False/True               → 정사각 padding, gap 제거
//   나머지:   색상·스타일 variant       → CSS data-attribute selector (hierarchy 등)

interface DimensionKeys {
  stateKey:       string | undefined
  sizeKey:        string | undefined
  blockKey:       string | undefined
  iconOnlyKey:    string | undefined
  appearanceKeys: string[]
}

function classifyDimensions(variantOptions: Record<string, string[]>): DimensionKeys {
  const keys = Object.keys(variantOptions)
  const normalize = (k: string) => k.toLowerCase().replace(/\s+/g, '')
  return {
    stateKey:       keys.find(k => normalize(k) === 'state'),
    sizeKey:        keys.find(k => normalize(k) === 'size'),
    blockKey:       keys.find(k => normalize(k) === 'block'),
    iconOnlyKey:    keys.find(k => normalize(k) === 'icononly'),
    appearanceKeys: keys.filter(k =>
      !['state', 'size', 'block', 'icononly'].includes(normalize(k)),
    ),
  }
}

// ── State → CSS 셀렉터 매핑 ──────────────────────────────────────────────
//
// JSON 구조의 state 값을 그대로 사용한다 (정규화 없음).
// variants에 존재하는 state만 CSS가 생성되고, 매핑에 없는 state는 폴백.

interface StateCssMapping {
  selector: string      // '' = base rule (.root)
  extra?: string        // 추가 CSS 속성
}

const STATE_CSS_MAP: Record<string, StateCssMapping> = {
  // 기존 구조 호환 (Primary.node.json)
  'rest':     { selector: '' },
  'hover':    { selector: ':hover:not([data-disabled])' },
  'press':    { selector: ':active:not([data-disabled])', extra: 'transform: scale(0.98);' },
  'disabled': { selector: '[data-disabled]', extra: 'cursor: not-allowed;\n  pointer-events: none;' },
  // Untitled UI 구조 (Button.node.json)
  'default':  { selector: '' },
  'focused':  { selector: ':focus-visible:not([data-disabled])' },
  'loading':  { selector: '[data-loading]', extra: 'pointer-events: none;' },
}

/** base rule이 되는 state인지 (셀렉터 '') */
function isBaseState(state: string): boolean {
  return STATE_CSS_MAP[state]?.selector === ''
}

// ── CSS 값 변환 ───────────────────────────────────────────────────────────

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function mapValue(value: string): string {
  return value.includes('var(--') ? mapCssValue(value) : value
}

function isRawHex(value: string): boolean {
  return HEX_RE.test(value.trim())
}

// ── 자식 텍스트 색상 추출 ────────────────────────────────────────────────

const ICON_CHILD_NAMES = new Set(['search', 'icon', 'arrow', 'chevron', 'arrow-right', 'placeholder'])

/**
 * 자식 텍스트 노드의 색상을 추출한다.
 *
 * [플러그인 quirk] Figma 플러그인이 TEXT 노드의 fill(글자색)을
 * CSS `color` 대신 `background-color` 키로 전달하는 경우가 있다.
 * 따라서 `color`를 먼저 시도하고, 없으면 `background-color`를 텍스트 색으로 사용한다.
 * 아이콘/placeholder 자식은 제외한다.
 */
function extractChildTextColor(
  childStyles: Record<string, Record<string, string>>,
): string | null {
  for (const [key, cs] of Object.entries(childStyles)) {
    if (ICON_CHILD_NAMES.has(key.toLowerCase())) continue
    // 로딩 아이콘 제외
    if (key.toLowerCase().includes('loading')) continue
    // 표준 CSS color 키 우선
    if (cs.color) return mapValue(cs.color)
    // 플러그인이 텍스트 fill을 background-color로 전달하는 경우 (버그 1 대응)
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

/**
 * disabled 상태의 opacity를 결정론적으로 추출한다. (버그 5 대응)
 * 3순위: 텍스트 자식 → 아이콘 자식 → rootStyles
 * + variant.styles에 직접 있는 경우도 처리 (Untitled UI 패턴)
 */
function extractDisabledOpacity(
  childStyles: Record<string, Record<string, string>>,
  rootStyles: Record<string, string>,
): string | null {
  // 0순위: variant.styles에 직접 opacity가 있는 경우 (Untitled UI)
  if (rootStyles.opacity) return rootStyles.opacity
  // 1순위: 텍스트 자식의 opacity
  for (const [key, cs] of Object.entries(childStyles)) {
    if (!ICON_CHILD_NAMES.has(key.toLowerCase()) && !key.toLowerCase().includes('loading') && cs.opacity) return cs.opacity
  }
  // 2순위: 아이콘 자식의 opacity
  for (const [key, cs] of Object.entries(childStyles)) {
    if (ICON_CHILD_NAMES.has(key.toLowerCase()) && cs.opacity) return cs.opacity
  }
  return null
}

/** non-disabled state: opacity 불필요 */
function toStateStyle(v: VariantEntry): StateStyle {
  const s = v.styles
  return {
    bg:      s['background-color'] ? mapValue(s['background-color']) : null,
    color:   extractChildTextColor(v.childStyles),
    border:  s['border'] ?? s['border-color'] ?? null,
    opacity: null,
  }
}

/** disabled state 전용: opacity 추출 */
function toDisabledStateStyle(v: VariantEntry): StateStyle {
  const s = v.styles
  return {
    bg:      s['background-color'] ? mapValue(s['background-color']) : null,
    color:   extractChildTextColor(v.childStyles),
    border:  s['border'] ?? s['border-color'] ?? null,
    opacity: extractDisabledOpacity(v.childStyles, s),
  }
}

/**
 * block=true / block=false 변형 쌍의 스타일이 일치하는지 검증한다.
 * 불일치 시 BLOCK_STYLE_MISMATCH 경고를 발행한다.
 */
function deduplicateByBlock(
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

// ── State 스타일 추출 ────────────────────────────────────────────────────

function extractStateStyles(
  variants: VariantEntry[],
  stateKey: string,
  warnings: GeneratorWarning[],
  blockKey?: string,
  iconOnlyKey?: string,
): Map<string, StateStyle> {
  const map = new Map<string, StateStyle>()
  // block=true, iconOnly=true 제외하여 대표 스타일 추출
  let base = blockKey
    ? variants.filter(v => v.properties[blockKey]?.toLowerCase() !== 'true')
    : variants
  if (iconOnlyKey) {
    base = base.filter(v => v.properties[iconOnlyKey]?.toLowerCase() !== 'true')
  }

  for (const v of base) {
    const state = v.properties[stateKey]?.toLowerCase()
    if (!state || map.has(state)) continue
    map.set(state, state === 'disabled' ? toDisabledStateStyle(v) : toStateStyle(v))
  }
  return map
}

// ── CSS 생성: 단일 색상 스킴 (state만으로 구분) ─────────────────────────

function buildStateCSS(
  stateMap: Map<string, StateStyle>,
  selectorPrefix: string,
  warnings: GeneratorWarning[],
  name: string,
): string {
  const rules: string[] = []

  for (const [state, style] of stateMap) {
    const mapping = STATE_CSS_MAP[state]
    if (!mapping) {
      warnings.push({
        code: 'UNKNOWN_STATE',
        message: `'${state}' state의 CSS 셀렉터가 정의되지 않음 → [data-state='${state}'] 폴백`,
        value: state,
      })
      // 폴백 셀렉터
      const lines: string[] = []
      if (style.bg) lines.push(`  background: ${style.bg};`)
      if (style.color) lines.push(`  color: ${style.color};`)
      if (style.border) lines.push(`  border: ${style.border.startsWith('1px') ? style.border : `1px solid ${style.border}`};`)
      if (style.opacity) lines.push(`  opacity: ${style.opacity};`)
      if (lines.length) rules.push(`${selectorPrefix}[data-state='${state}'] {\n${lines.join('\n')}\n}`)
      continue
    }

    const sel = mapping.selector === ''
      ? selectorPrefix
      : `${selectorPrefix}${mapping.selector}`

    const lines: string[] = []
    if (style.bg) {
      lines.push(`  background: ${style.bg};`)
      warnUnmappedHex(warnings, style.bg, `${name} ${state}.bg`)
    } else if (isBaseState(state)) {
      // base state에 bg 없는 것은 투명 버튼 (Tertiary, Link 계열) → 정상
    }
    if (style.color) {
      lines.push(`  color: ${style.color};`)
      warnUnmappedHex(warnings, style.color, `${name} ${state}.color`)
    }
    if (style.border) {
      lines.push(`  border: ${style.border.startsWith('1px') ? style.border : `1px solid ${style.border}`};`)
    }
    if (style.opacity) lines.push(`  opacity: ${style.opacity};`)
    if (mapping.extra) lines.push(`  ${mapping.extra}`)

    if (lines.length) rules.push(`${sel} {\n${lines.join('\n')}\n}`)
  }

  return rules.join('\n\n')
}

function buildSingleSchemeCSS(
  stateMap: Map<string, StateStyle>,
  warnings: GeneratorWarning[],
  name: string,
): string {
  return buildStateCSS(stateMap, '.root', warnings, name)
}

// ── CSS 생성: appearance 차원 있음 ──────────────────────────────────────

interface AppearanceScheme {
  appearanceValue: string
  states: Map<string, StateStyle>
}

function extractAppearanceSchemes(
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
    for (const v of base) {
      if (v.properties[appearanceKey] !== appearanceValue) continue
      const state = v.properties[stateKey]?.toLowerCase()
      if (!state || states.has(state)) continue
      states.set(state, state === 'disabled' ? toDisabledStateStyle(v) : toStateStyle(v))
    }
    return { appearanceValue, states }
  })
}

function buildMultiSchemeCSS(
  appearanceKey: string,
  schemes: AppearanceScheme[],
  warnings: GeneratorWarning[],
  name: string,
): string {
  const rules: string[] = []

  for (const { appearanceValue, states } of schemes) {
    const attrVal = appearanceValue.toLowerCase().replace(/\s+/g, '-')
    const sel = `.root[data-${appearanceKey.toLowerCase().replace(/\s+/g, '-')}='${attrVal}']`
    const ctx = `${name}[${appearanceValue}]`
    const css = buildStateCSS(states, sel, warnings, ctx)
    if (css) rules.push(css)
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
    if (s.padding) lines.push(`  padding: ${mapValue(s.padding)};`)
    if (s['border-radius']) lines.push(`  border-radius: ${mapRadiusValue(s['border-radius'])};`)
    if (s.gap) lines.push(`  gap: ${mapValue(s.gap)};`)

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

function buildIconOnlyCSSRules(
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
      sizeMap.set(size, `.root[data-icon-only][data-size='${size}'] {\n  padding: ${mapValue(padding)};\n  gap: 0;\n}`)
    }
  }

  if (sizeMap.size > 0) {
    rules.push(`.root[data-icon-only] {\n  gap: 0;\n}`)
    rules.push(...Array.from(sizeMap.values()))
  }

  return rules.join('\n\n')
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

  const hasBlock    = dims.blockKey !== undefined
  const hasIconOnly = dims.iconOnlyKey !== undefined

  // block=true/false 스타일 일관성 검증
  if (dims.blockKey) {
    deduplicateByBlock(variants, dims.blockKey, warnings)
  }

  // ── 색상 스킴 CSS ─────────────────────────────────────────────────────
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
  const sizeCSS = hasData && dims.sizeKey
    ? buildSizeCSSRules(variants, dims.sizeKey, sizeValues, dims.stateKey, dims.blockKey, dims.iconOnlyKey, warnings)
    : ''

  const blockCSS = hasBlock
    ? `.root[data-block] {\n  display: flex;\n  width: 100%;\n}`
    : ''

  const iconOnlyCSS = hasIconOnly && dims.iconOnlyKey
    ? buildIconOnlyCSSRules(variants, dims.iconOnlyKey, dims.sizeKey, dims.stateKey)
    : ''

  const baseGap = rootStyles.gap ? mapValue(rootStyles.gap) : null

  // ── appearance key → data attribute name ──────────────────────────────
  const appearanceAttrName = appearanceKey
    ? appearanceKey.toLowerCase().replace(/\s+/g, '-')
    : null

  // ── TSX 생성 ──────────────────────────────────────────────────────────
  const appearanceTypeDef = appearanceUnion
    ? `export type ${name}${capitalizeFirst(appearanceKey)} = ${appearanceUnion};\n`
    : ''
  const appearancePropName = appearanceKey
    ? appearanceKey.replace(/\s+/g, '').replace(/^(.)/, (c: string) => c.toLowerCase())
    : null
  const appearanceProp    = appearanceUnion && appearancePropName
    ? `\n  ${appearancePropName}?: ${name}${capitalizeFirst(appearanceKey)};`
    : ''
  const appearanceDefault = appearanceUnion && appearancePropName
    ? `\n      ${appearancePropName} = '${defaultAppearance}',`
    : ''
  const appearanceAttr    = appearanceUnion && appearancePropName && appearanceAttrName
    ? `\n      data-${appearanceAttrName}={${appearancePropName}.toLowerCase().replace(/\\s+/g, '-')}`
    : ''
  const blockProp         = hasBlock ? `\n  block?: boolean;` : ''
  const blockDefault      = hasBlock ? `\n      block = false,` : ''
  const blockAttr         = hasBlock ? `\n      data-block={block ? '' : undefined}` : ''
  const iconOnlyProp      = hasIconOnly ? `\n  iconOnly?: boolean;` : ''
  const iconOnlyDefault   = hasIconOnly ? `\n      iconOnly = false,` : ''
  const iconOnlyAttr      = hasIconOnly ? `\n      data-icon-only={iconOnly ? '' : undefined}` : ''

  // Loading state 존재 여부 확인
  const hasLoadingState = dims.stateKey
    ? variants.some(v => v.properties[dims.stateKey!]?.toLowerCase() === 'loading')
    : false
  const loadingProp    = hasLoadingState ? `\n  loading?: boolean;` : ''
  const loadingDefault = hasLoadingState ? `\n      loading = false,` : ''
  const loadingAttr    = hasLoadingState ? `\n      data-loading={loading ? '' : undefined}` : ''
  const loadingAria    = hasLoadingState ? `\n      aria-busy={loading || undefined}` : ''

  const tsx = `import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './${name}.module.css';

${appearanceTypeDef}export type ${name}Size = ${sizeUnion};

export interface ${name}Props extends ButtonHTMLAttributes<HTMLButtonElement> {${appearanceProp}
  size?: ${name}Size;${blockProp}${iconOnlyProp}${loadingProp}
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
      size = '${defaultSize}',${blockDefault}${iconOnlyDefault}${loadingDefault}
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
      data-size={size}${appearanceAttr}${blockAttr}${iconOnlyAttr}${loadingAttr}
      data-disabled={disabled ? '' : undefined}
      aria-disabled={disabled || undefined}${loadingAria}
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
${iconOnlyCSS ? `\n/* ── Icon Only ── */\n${iconOnlyCSS}` : ''}
`

  return { name, category: 'action', tsx, css, warnings }
}
