/**
 * 범용 TSX 코드 생성
 *
 * 모든 variant dimension을 data-* attribute로 매핑한다.
 * state는 data-state attribute로 통일 (pseudo-class 매핑 없음).
 */

import type { DimensionKeys } from './dimensions'
import { isBaseState } from './state-css'

export interface TsxBuildOptions {
  /** HTML 요소 ('button' | 'div' | 'span' | 'input' | 'article' | 'a') */
  element: string
  /** React HTML attribute 타입명 (제네릭 제외) */
  elementPropsType: string
  /** 제네릭 파라미터 (꺾쇠 포함) */
  elementPropsGeneric: string
}

interface TsxBuildInput {
  name: string
  variantOptions: Record<string, string[]>
  variants: Array<{ properties: Record<string, string> }>
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
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

  const hasBlock    = dims.blockKey !== undefined
  const hasIconOnly = dims.iconOnlyKey !== undefined

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
    ? `\n      data-${appearanceAttrName}={${appearancePropName}.toLowerCase().replace(/\\s+/g, '-')}`
    : ''

  // state prop
  const stateTypeDef = stateUnion ? `export type ${name}State = ${stateUnion};\n` : ''
  const stateProp    = stateUnion ? `\n  state?: ${name}State;` : ''
  const stateDefault = stateUnion && defaultState
    ? `\n      state = '${defaultState}',`
    : stateUnion ? `\n      state,` : ''
  const stateAttr    = dims.stateKey
    ? `\n      data-state={state ?? undefined}`
    : ''

  const blockProp         = hasBlock ? `\n  block?: boolean;` : ''
  const blockDefault      = hasBlock ? `\n      block = false,` : ''
  const blockAttr         = hasBlock ? `\n      data-block={block ? '' : undefined}` : ''
  const iconOnlyProp      = hasIconOnly ? `\n  iconOnly?: boolean;` : ''
  const iconOnlyDefault   = hasIconOnly ? `\n      iconOnly = false,` : ''
  const iconOnlyAttr      = hasIconOnly ? `\n      data-icon-only={iconOnly ? '' : undefined}` : ''

  // ── element별 분기 ────────────────────────────────────────────────────
  const isButton = element === 'button'
  const typeAttr = isButton ? `\n      type={type}` : ''
  const typeProp = isButton ? `\n      type = 'button',` : ''

  const refType = getRefType(element)
  const fullPropsType = `${elementPropsType}${elementPropsGeneric}`

  return `import { forwardRef } from 'react';
import type { ${elementPropsType}, ReactNode } from 'react';
import styles from './${name}.module.css';

${appearanceTypeDef}${stateTypeDef}export type ${name}Size = ${sizeUnion};

export interface ${name}Props extends ${fullPropsType} {${appearanceProp}
  size?: ${name}Size;${stateProp}${blockProp}${iconOnlyProp}
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
      size = '${defaultSize}',${stateDefault}${blockDefault}${iconOnlyDefault}${typeProp}
      disabled,
      onClick,
      children,
      className = '',
      ...props
    },
    ref,
  ) => {
    const isLoading = ${dims.stateKey ? "state === 'loading'" : 'false'};
    const isDisabled = disabled || isLoading;

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
        {children}
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
