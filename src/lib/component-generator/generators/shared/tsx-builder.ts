/**
 * 범용 TSX 코드 생성
 *
 * 모든 variant dimension을 data-* attribute로 매핑한다.
 * state는 data-state attribute로 통일 (pseudo-class 매핑 없음).
 */

import type { DimensionKeys } from './dimensions'
import type { ParsedComponentProp } from '../../component-props-parser'
import type { ComponentOverrides } from '../../props-override'
import { isBaseState } from './state-css'

export interface TsxBuildOptions {
  /** HTML 요소 ('button' | 'div' | 'span' | 'input' | 'article' | 'a') */
  element: string
  /** React HTML attribute 타입명 (제네릭 제외) */
  elementPropsType: string
  /** 제네릭 파라미터 (꺾쇠 포함) */
  elementPropsGeneric: string
  /** childStyles에서 파싱한 내부 구조 정보 */
  innerStructure?: InnerStructure
  /** componentProperties에서 파싱한 추가 props */
  componentProps?: ParsedComponentProp[]
  /** 개발자가 편집한 props 오버라이드 */
  overrides?: ComponentOverrides
}

/** childStyles 기반 컴포넌트 내부 구조 */
export interface InnerStructure {
  hasIconSlot: boolean
  hasTextWrapper: boolean
}

interface TsxBuildInput {
  name: string
  variantOptions: Record<string, string[]>
  variants: Array<{ properties: Record<string, string> }>
}

// ── childStyles 구조 파서 ────────────────────────────────────────────────

const ICON_SLOT_PATTERNS = /^(placeholder|icon-?slot|icon-?leading|icon-?trailing)/i
const TEXT_WRAPPER_PATTERNS = /^(text\s*padding|text\s*wrapper|label\s*padding)/i

/** childStyles 키에서 내부 구조를 감지한다 */
export function parseInnerStructure(
  childStyles: Record<string, Record<string, string>>,
): InnerStructure {
  let hasIconSlot = false
  let hasTextWrapper = false

  for (const key of Object.keys(childStyles)) {
    const topLevel = key.split('>')[0].trim()
    if (ICON_SLOT_PATTERNS.test(topLevel)) hasIconSlot = true
    if (TEXT_WRAPPER_PATTERNS.test(topLevel)) hasTextWrapper = true
  }

  return { hasIconSlot, hasTextWrapper }
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/** 내부 JSX body 생성
 *
 * 규칙:
 * - iconLeading/iconTrailing: ReactNode — truthy면 slot 렌더링
 * - iconOnly: children 숨기고 iconLeading 우선 (폴백: iconTrailing)
 * - loadingText === false 이면서 isLoading이면 텍스트 숨김
 */
function buildInnerJsx(
  inner: InnerStructure,
  hasIconOnly: boolean,
  hasSwapSlots: boolean,
  leadingSwap: ParsedComponentProp | undefined,
  trailingSwap: ParsedComponentProp | undefined,
  hasLoadingText: boolean,
  fallbackLeadingName = 'iconLeading',
  fallbackTrailingName = 'iconTrailing',
): string {
  const hasSlots = hasSwapSlots || inner.hasIconSlot

  const textInner = hasLoadingText
    ? `{(!isLoading || loadingText) && children}`
    : `{children}`

  if (!hasSlots) {
    return hasLoadingText
      ? `        {(!isLoading || loadingText) && children}`
      : '        {children}'
  }

  const leading = leadingSwap?.name ?? fallbackLeadingName
  const trailing = trailingSwap?.name ?? fallbackTrailingName

  const leadingSlot = `{${leading} && <span className={styles.iconSlot}>{${leading}}</span>}`
  const trailingSlot = `{${trailing} && <span className={styles.iconSlot}>{${trailing}}</span>}`
  const textSlot = inner.hasTextWrapper
    ? `<span className={styles.textWrapper}>${textInner}</span>`
    : textInner

  if (hasIconOnly) {
    // iconOnly는 아이콘이 있을 때만 동작 — 아이콘 없으면 일반 레이아웃으로 폴백
    return `        {iconOnly && (${leading} || ${trailing}) ? (
          <span className={styles.iconSlot}>{${leading} ?? ${trailing}}</span>
        ) : (
          <>
            ${leadingSlot}
            ${textSlot}
            ${trailingSlot}
          </>
        )}`
  }

  return `        ${leadingSlot}
        ${textSlot}
        ${trailingSlot}`
}

export function buildTsx(
  payload: TsxBuildInput,
  dims: DimensionKeys,
  options: TsxBuildOptions,
): string {
  const { name, variantOptions, variants } = payload
  const { element, elementPropsType, elementPropsGeneric } = options

  // ── Size ─────────────────────────────────────────────────────────────
  const sizeValues      = dims.sizeKey ? variantOptions[dims.sizeKey] : []
  const sizeUnion       = sizeValues.length > 0 ? sizeValues.map(s => `'${s}'`).join(' | ') : "'medium'"
  const defaultSize     = sizeValues.find(s => /^(md|medium)$/i.test(s)) ?? sizeValues[0] ?? 'medium'

  // ── State (data-state attribute) ──────────────────────────────────────
  // base state도 union에 포함 → sandbox 파서가 state prop을 감지할 수 있도록
  const stateValues = dims.stateKey ? variantOptions[dims.stateKey] : []
  const defaultState = stateValues.find(s => isBaseState(s))?.toLowerCase() ?? null
  const stateUnion = stateValues.length > 0
    ? stateValues.map(s => `'${s.toLowerCase()}'`).join(' | ')
    : null

  // ── Appearance ────────────────────────────────────────────────────────
  const appearanceKey    = dims.appearanceKeys[0]
  const appearanceValues = appearanceKey ? variantOptions[appearanceKey] : []
  const appearanceUnion  = appearanceValues.length > 0
    ? appearanceValues.map(v => `'${v}'`).join(' | ')
    : null
  const defaultAppearance = appearanceValues[0] ?? null

  // overrides 적용: sourceName → override 매핑 (dimension prop 체크용으로 먼저 선언)
  const overrideMap = new Map(
    (options.overrides?.props ?? []).map(o => [o.sourceName, o]),
  )

  // dimension prop 오버라이드: 사용자가 명시적으로 제거한 경우 비활성화
  const hasBlock    = dims.blockKey !== undefined && !overrideMap.get('block')?.removed
  const hasIconOnly = dims.iconOnlyKey !== undefined && !overrideMap.get('iconOnly')?.removed

  // ── data attribute name ───────────────────────────────────────────────
  const appearanceAttrName = appearanceKey
    ? appearanceKey.toLowerCase().replace(/\s+/g, '-')
    : null

  // ── TSX 조각 생성 ────────────────────────────────────────────────────
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
    ? `\n        data-${appearanceAttrName}={${appearancePropName}.toLowerCase().replace(/\\s+/g, '-')}`
    : ''

  // state prop
  const stateTypeDef = stateUnion ? `export type ${name}State = ${stateUnion};\n` : ''
  const stateProp    = stateUnion ? `\n  state?: ${name}State;` : ''
  const stateDefault = stateUnion && defaultState
    ? `\n      state = '${defaultState}',`
    : stateUnion ? `\n      state,` : ''
  const stateAttr    = dims.stateKey
    ? `\n        data-state={state ?? undefined}`
    : ''

  const blockProp         = hasBlock ? `\n  block?: boolean;` : ''
  const blockDefault      = hasBlock ? `\n      block = false,` : ''
  const blockAttr         = hasBlock ? `\n        data-block={block ? '' : undefined}` : ''
  const iconOnlyProp      = hasIconOnly ? `\n  iconOnly?: boolean;` : ''
  const iconOnlyDefault   = hasIconOnly ? `\n      iconOnly = false,` : ''
  const iconOnlyAttr      = hasIconOnly ? `\n        data-icon-only={iconOnly ? '' : undefined}` : ''

  // ── 내부 구조 + componentProperties 기반 props ─────────────────────────
  const inner = options.innerStructure ?? { hasIconSlot: false, hasTextWrapper: false }

  const cProps = (options.componentProps ?? [])
    .filter(cp => !overrideMap.get(cp.name)?.removed)
    .map(cp => {
      const ov = overrideMap.get(cp.name)
      if (!ov) return cp
      return {
        ...cp,
        name: ov.name ?? cp.name,
        defaultValue: ov.defaultValue ?? cp.defaultValue,
        tsType: ov.tsType ?? cp.tsType,
      }
    })

  // componentProperties에서 prop/default/destructuring 생성
  const cpPropLines: string[] = []
  const cpDefaultLines: string[] = []
  for (const cp of cProps) {
    if (cp.type === 'boolean') {
      cpPropLines.push(`\n  ${cp.name}?: ${cp.tsType};`)
      cpDefaultLines.push(`\n      ${cp.name} = ${cp.defaultValue},`)
    } else if (cp.type === 'node') {
      cpPropLines.push(`\n  ${cp.name}?: ${cp.tsType};`)
      cpDefaultLines.push(`\n      ${cp.name},`)
    } else if (cp.type === 'string') {
      cpPropLines.push(`\n  ${cp.name}?: ${cp.tsType};`)
      cpDefaultLines.push(`\n      ${cp.name} = '${cp.defaultValue}',`)
    }
  }
  const cpPropsStr = cpPropLines.join('')
  const cpDefaultsStr = cpDefaultLines.join('')

  // icon swap node props 감지 — 원본 이름으로 감지, rename된 이름으로 JSX 생성
  // (rename 후에도 /leading/ 정규식이 깨지지 않도록 rawCProps 기준으로 탐색)
  const rawCProps = options.componentProps ?? []
  const rawLeading = rawCProps.find(p => p.type === 'node' && /leading/i.test(p.name))
  const rawTrailing = rawCProps.find(p => p.type === 'node' && /trailing/i.test(p.name))
  const leadingSwap = rawLeading && !overrideMap.get(rawLeading.name)?.removed
    ? { ...rawLeading, name: overrideMap.get(rawLeading.name)?.name ?? rawLeading.name }
    : undefined
  const trailingSwap = rawTrailing && !overrideMap.get(rawTrailing.name)?.removed
    ? { ...rawTrailing, name: overrideMap.get(rawTrailing.name)?.name ?? rawTrailing.name }
    : undefined
  const hasSwapSlots = !!(leadingSwap || trailingSwap)

  // loadingText boolean 감지
  const hasLoadingText = cProps.some(p => p.type === 'boolean' && /loadingtext/i.test(p.name.replace(/\s+/g, '')))

  // 하위 호환: componentProperties가 없으면 innerStructure 폴백
  // 단, 사용자가 명시적으로 제거(override.removed)한 경우 제외
  const fallbackLeadingRemoved = !hasSwapSlots && (overrideMap.get('iconLeading')?.removed ?? false)
  const fallbackTrailingRemoved = !hasSwapSlots && (overrideMap.get('iconTrailing')?.removed ?? false)
  // override에서 rename된 이름 적용 (없으면 기본값)
  const fallbackLeadingName = overrideMap.get('iconLeading')?.name ?? 'iconLeading'
  const fallbackTrailingName = overrideMap.get('iconTrailing')?.name ?? 'iconTrailing'
  const useFallbackSlot = !hasSwapSlots && inner.hasIconSlot

  const iconSlotProp = useFallbackSlot
    ? [
        !fallbackLeadingRemoved ? `\n  ${fallbackLeadingName}?: ReactNode;` : '',
        !fallbackTrailingRemoved ? `\n  ${fallbackTrailingName}?: ReactNode;` : '',
      ].join('')
    : ''
  const iconSlotDefault = useFallbackSlot
    ? [
        !fallbackLeadingRemoved ? `\n      ${fallbackLeadingName},` : '',
        !fallbackTrailingRemoved ? `\n      ${fallbackTrailingName},` : '',
      ].join('')
    : ''

  // buildInnerJsx에 전달할 effective hasIconSlot (양쪽 모두 제거 시 슬롯 JSX 비활성화)
  const effectiveInner = useFallbackSlot && fallbackLeadingRemoved && fallbackTrailingRemoved
    ? { ...inner, hasIconSlot: false }
    : inner

  // ── element별 분기 ────────────────────────────────────────────────────
  const isButton = element === 'button'
  const typeAttr = isButton ? `\n        type={type}` : ''
  const typeProp = isButton ? `\n      type = 'button',` : ''

  const refType = getRefType(element)
  const fullPropsType = `${elementPropsType}${elementPropsGeneric}`

  return `import { forwardRef } from 'react';
import type { ${elementPropsType}, ReactNode } from 'react';
import styles from './${name}.module.css';

${appearanceTypeDef}${stateTypeDef}export type ${name}Size = ${sizeUnion};

export interface ${name}Props extends ${fullPropsType} {${appearanceProp}
  size?: ${name}Size;${stateProp}${blockProp}${iconOnlyProp}${iconSlotProp}${cpPropsStr}
  children?: ReactNode;
}

/**
 * ${name} — Figma COMPONENT_SET 기반 자동 생성
 * dimensions: ${JSON.stringify(Object.fromEntries(
    Object.entries(variantOptions).map(([k, v]) => [k, v.length]),
  ))}
 */
export const ${name} = forwardRef<${refType}, ${name}Props>(
  (
    {${appearanceDefault}
      size = '${defaultSize}',${stateDefault}${blockDefault}${iconOnlyDefault}${iconSlotDefault}${cpDefaultsStr}${typeProp}
      disabled,
      onClick,
      children,
      className = '',
      ...props
    },
    ref,
  ) => {
    const isLoading = ${dims.stateKey ? "state === 'loading'" : 'false'};
    const isDisabled = disabled || isLoading${dims.stateKey ? " || state === 'disabled'" : ''};

    return (
      <${element}
        ref={ref}${typeAttr}
        data-size={size}${appearanceAttr}${stateAttr}${blockAttr}${iconOnlyAttr}
        aria-disabled={isDisabled || undefined}
        aria-busy={isLoading || undefined}
        onClick={isDisabled ? undefined : onClick}
        className={\`\${styles.root}\${className ? \` \${className}\` : ''}\`}
        {...props}
      >
${buildInnerJsx(effectiveInner, hasIconOnly, hasSwapSlots, leadingSwap, trailingSwap, hasLoadingText, fallbackLeadingName, fallbackTrailingName)}
      </${element}>
    );
  },
);
${name}.displayName = '${name}';

export default ${name};
`
}

function getRefType(element: string): string {
  switch (element) {
    case 'button':  return 'HTMLButtonElement'
    case 'input':   return 'HTMLInputElement'
    case 'a':       return 'HTMLAnchorElement'
    case 'span':    return 'HTMLSpanElement'
    case 'article': return 'HTMLElement'
    default:        return 'HTMLDivElement'
  }
}
