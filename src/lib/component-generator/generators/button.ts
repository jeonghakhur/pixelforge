import type { PluginComponentPayload, GeneratorOutput } from '../types';
import {
  BUTTON_VARIANTS,
  BUTTON_SIZES,
  isValidButtonVariant,
  isValidButtonSize,
} from '../a11y/button';

// ── 헬퍼 ─────────────────────────────────────────────────────────────

function fallback(val: string | undefined, fb: string): string {
  return val ?? fb;
}

function normalizePadding(padding: string): string {
  const parts = padding.trim().split(/\s+/);
  if (parts.length === 4 && parts[0] === parts[2] && parts[1] === parts[3]) {
    return `${parts[0]} ${parts[1]}`;
  }
  return padding;
}

// ── variants 배열에서 CSS 추출 ──────────────────────────────────────

type VariantEntry = NonNullable<PluginComponentPayload['variants']>[number];

/** state=rest인 variant들에서 size별 스타일 추출 */
function extractSizeStyles(
  variants: VariantEntry[],
): Map<string, { padding: string; height: string | null; borderRadius: string; gap: string }> {
  const map = new Map<string, { padding: string; height: string | null; borderRadius: string; gap: string }>();
  const restVariants = variants.filter((v) => v.properties.state?.toLowerCase() === 'rest');

  for (const v of restVariants) {
    const size = v.properties.size?.toLowerCase();
    if (!size || map.has(size)) continue;
    const s = v.styles;
    map.set(size, {
      padding:      s.padding ? normalizePadding(s.padding) : '',
      height:       s.height ?? null,
      borderRadius: s['border-radius'] ?? '',
      gap:          s.gap ?? '',
    });
  }
  return map;
}

/** childStyles에서 텍스트 색상 추출
 *  플러그인이 텍스트 fill을 background-color 키로 저장하는 경우도 처리 */
function extractChildTextColor(
  childStyles: Record<string, Record<string, string>>,
): string | null {
  const IGNORE = new Set(['search', 'icon', 'arrow', 'chevron']);
  for (const [key, cs] of Object.entries(childStyles)) {
    if (IGNORE.has(key.toLowerCase())) continue;
    if (cs.color) return cs.color;
    // Figma 플러그인이 텍스트 fill → background-color로 매핑하는 경우
    if (cs['background-color']) return cs['background-color'];
  }
  return null;
}

/** state=rest, block=false인 variant들에서 variant별 배경/텍스트/border 추출 */
function extractVariantStyles(
  variants: VariantEntry[],
): Map<string, { bg: string; color: string; border: string | null }> {
  const map = new Map<string, { bg: string; color: string; border: string | null }>();
  const restVariants = variants.filter(
    (v) => v.properties.state?.toLowerCase() === 'rest' &&
            v.properties.block?.toLowerCase() !== 'true',
  );

  for (const v of restVariants) {
    const variantName = v.properties.variant;
    if (!variantName || map.has(variantName)) continue;
    const s = v.styles;
    map.set(variantName, {
      bg:     s['background-color'] ?? '',
      color:  extractChildTextColor(v.childStyles) ?? s.color ?? '',
      border: s['border'] ?? s['border-color'] ?? null,
    });
  }
  return map;
}

/** state=hover, block=false인 variant별 hover 스타일 추출 */
function extractHoverStyles(
  variants: VariantEntry[],
): Map<string, { bg: string; border: string | null }> {
  const map = new Map<string, { bg: string; border: string | null }>();
  const hoverVariants = variants.filter(
    (v) => v.properties.state?.toLowerCase() === 'hover' &&
            v.properties.block?.toLowerCase() !== 'true',
  );

  for (const v of hoverVariants) {
    const variantName = v.properties.variant;
    if (!variantName || map.has(variantName)) continue;
    const s = v.styles;
    map.set(variantName, {
      bg:     s['background-color'] ?? '',
      border: s['border'] ?? null,
    });
  }
  return map;
}

/** state=press, block=false인 variant별 press 스타일 추출 */
function extractPressStyles(
  variants: VariantEntry[],
): Map<string, { bg: string }> {
  const map = new Map<string, { bg: string }>();
  const pressVariants = variants.filter(
    (v) => v.properties.state?.toLowerCase() === 'press' &&
            v.properties.block?.toLowerCase() !== 'true',
  );

  for (const v of pressVariants) {
    const variantName = v.properties.variant;
    if (!variantName || map.has(variantName)) continue;
    map.set(variantName, { bg: v.styles['background-color'] ?? '' });
  }
  return map;
}

/** state=disabled인 variant에서 opacity 추출 (첫 번째 발견 값) */
function extractDisabledStyle(variants: VariantEntry[]): { opacity: string; color: string | null } {
  const disabledVariant = variants.find(
    (v) => v.properties.state?.toLowerCase() === 'disabled' &&
            v.properties.block?.toLowerCase() !== 'true',
  );
  if (!disabledVariant) return { opacity: '0.4', color: null };

  const opacity = Object.values(disabledVariant.childStyles)
    .find((cs) => cs.opacity)?.opacity ?? disabledVariant.styles.opacity ?? '0.4';
  const color = extractChildTextColor(disabledVariant.childStyles);

  return { opacity, color };
}

// ── fallback: variants 없을 때 단일 payload 기반 ────────────────────

function buildSingleSizeTokens(
  size: string,
  figmaStyles: Record<string, string>,
  defaultSize: string,
): string {
  if (size === defaultSize && Object.keys(figmaStyles).length > 0) {
    const padding = figmaStyles.padding ? normalizePadding(figmaStyles.padding) : '';
    const height = figmaStyles.height ? `\n  min-height: ${figmaStyles.height};` : '';
    const borderRadius = figmaStyles['border-radius'] ?? 'var(--radius-8)';
    const gap = figmaStyles.gap ?? '8px';
    return `.root[data-size='${size}'] { padding: ${padding};${height} border-radius: ${borderRadius}; gap: ${gap}; }`;
  }
  const fb: Record<string, string> = {
    xsmall: `padding: 0.25rem 0.5rem; border-radius: var(--radius-4); font-size: 0.75rem;`,
    small:  `padding: 0.375rem 1rem; border-radius: var(--radius-8); font-size: 0.875rem;`,
    medium: `padding: 0.5rem 1rem; border-radius: var(--radius-8); font-size: 1rem;`,
    large:  `padding: 0.625rem 1.5rem; border-radius: var(--radius-12); font-size: 1rem;`,
    xlarge: `padding: 0.75rem 2rem; border-radius: var(--radius-12); font-size: 1.125rem;`,
  };
  return `.root[data-size='${size}'] { ${fb[size] ?? fb.medium} }`;
}

// ── 메인 생성 함수 ────────────────────────────────────────────────────

export function generateButton(payload: PluginComponentPayload): GeneratorOutput {
  const { name, radixProps, styles: figmaStyles, childStyles, variantOptions, variants } = payload;

  const rawVariant = radixProps['variant'] ?? '';
  const rawSize    = radixProps['size']    ?? '';
  const hasBlock   = radixProps['block'] === 'true';

  // 타입 union — variantOptions(COMPONENT_SET) 우선, 없으면 상수 fallback
  const variantKey = variantOptions
    ? Object.keys(variantOptions).find((k) => /variant|type|style|kind/i.test(k))
    : null;
  const sizeKey = variantOptions
    ? Object.keys(variantOptions).find((k) => /^size$/i.test(k))
    : null;

  const resolvedVariants: readonly string[] =
    (variantKey && variantOptions![variantKey]) ? variantOptions![variantKey] : BUTTON_VARIANTS;
  const resolvedSizes: readonly string[] =
    (sizeKey && variantOptions![sizeKey]) ? variantOptions![sizeKey] : BUTTON_SIZES;

  // defaultVariant/defaultSize — Figma 실제 옵션 기준으로 검증
  const defaultVariant = resolvedVariants.includes(rawVariant)
    ? rawVariant
    : (resolvedVariants[0] ?? (isValidButtonVariant(rawVariant) ? rawVariant : 'Primary'));
  const defaultSize = resolvedSizes.includes(rawSize)
    ? rawSize
    : (resolvedSizes[0] ?? (isValidButtonSize(rawSize) ? rawSize : 'medium'));

  const variantUnion = resolvedVariants.map((v) => `'${v}'`).join(' | ');
  const sizeUnion    = resolvedSizes.map((s) => `'${s}'`).join(' | ');

  // ── CSS 데이터 추출 ──────────────────────────────────────────────
  const hasVariants = variants && variants.length > 0;

  // size별 스타일 (variants 있으면 Figma 실제값, 없으면 payload/fallback)
  const sizeStyleMap = hasVariants ? extractSizeStyles(variants!) : null;

  // variant별 색상 (variants 있으면 Figma 실제값, 없으면 토큰 변수)
  const variantStyleMap = hasVariants ? extractVariantStyles(variants!) : null;
  const hoverStyleMap   = hasVariants ? extractHoverStyles(variants!)   : null;
  const pressStyleMap   = hasVariants ? extractPressStyles(variants!)   : null;

  // disabled 스타일
  const disabledStyle = hasVariants
    ? extractDisabledStyle(variants!)
    : {
        opacity: Object.values(childStyles ?? {}).find((c) => c.opacity)?.opacity ?? '0.4',
        color: null,
      };

  // ── size CSS rules ───────────────────────────────────────────────
  const sizeRules = resolvedSizes.map((size) => {
    if (sizeStyleMap) {
      const t = sizeStyleMap.get(size.toLowerCase());
      if (t) {
        const heightLine = t.height ? `\n  min-height: ${t.height};` : '';
        const gapLine    = t.gap    ? `\n  gap: ${t.gap};`            : '';
        const brLine     = t.borderRadius ? `\n  border-radius: ${t.borderRadius};` : '';
        return `.root[data-size='${size}'] {\n  padding: ${t.padding};${heightLine}${brLine}${gapLine}\n}`;
      }
    }
    return buildSingleSizeTokens(size, figmaStyles ?? {}, defaultSize);
  }).join('\n\n');

  // ── variant CSS rules ────────────────────────────────────────────
  const buildVariantRules = (): string => {
    if (variantStyleMap) {
      return resolvedVariants.map((v) => {
        const s = variantStyleMap.get(v);
        if (!s) return '';

        const bgLine     = s.bg     ? `  background: ${s.bg};`           : `  background: var(--bg-elevated);`;
        const colorLine  = s.color  ? `  color: ${s.color};`             : `  color: var(--text-primary);`;
        const borderLine = s.border ? `  border: ${s.border.startsWith('1px') ? s.border : `1px solid ${s.border}`};` : '';

        // hover 상태
        const hover = hoverStyleMap?.get(v);
        const hoverBg = hover?.bg ? `background: ${hover.bg};` : 'opacity: 0.88;';
        const hoverBorder = hover?.border ? ` border: ${hover.border.startsWith('1px') ? hover.border : `1px solid ${hover.border}`};` : '';
        const hoverRule = `.root[data-variant='${v}']:hover:not([data-disabled]) { ${hoverBg}${hoverBorder} }`;

        // press 상태
        const press = pressStyleMap?.get(v);
        const pressRule = press?.bg
          ? `.root[data-variant='${v}']:active:not([data-disabled]) { background: ${press.bg}; transform: scale(0.98); }`
          : `.root[data-variant='${v}']:active:not([data-disabled]) { transform: scale(0.98); }`;

        return [
          `.root[data-variant='${v}'] {\n${bgLine}\n${colorLine}\n${borderLine ? borderLine + '\n' : ''}}`,
          hoverRule,
          pressRule,
        ].join('\n');
      }).filter(Boolean).join('\n\n');
    }

    // token 변수 기반 fallback
    return `
.root[data-variant='Primary'] {
  background: var(--accent);
  color: var(--bg-body);
}
.root[data-variant='Primary']:hover:not([data-disabled]) { opacity: 0.88; }
.root[data-variant='Primary']:active:not([data-disabled]) { transform: scale(0.98); }

.root[data-variant='Secondary'] {
  background: var(--accent-subtle);
  color: var(--accent);
}
.root[data-variant='Secondary']:hover:not([data-disabled]) { background: var(--accent-dim); }

.root[data-variant='Default'] {
  background: ${fallback(figmaStyles?.['background-color'], 'var(--bg-elevated)')};
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}
.root[data-variant='Default']:hover:not([data-disabled]) { background: var(--glass-highlight); }
.root[data-variant='Default']:active:not([data-disabled]) { transform: scale(0.99); }

.root[data-variant='Outline'] {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
}
.root[data-variant='Outline']:hover:not([data-disabled]) { background: var(--accent-subtle); }

.root[data-variant='Invisible'] {
  background: transparent;
  color: var(--text-secondary);
}
.root[data-variant='Invisible']:hover:not([data-disabled]) { background: var(--glass-bg); color: var(--text-primary); }`.trim();
  };

  // ── TSX ──────────────────────────────────────────────────────────
  const blockProp    = hasBlock ? `\n  block?: boolean;` : '';
  const blockAttr    = hasBlock ? `\n      data-block={block ? '' : undefined}` : '';
  const blockDefault = hasBlock ? `\n      block = false,` : '';

  const tsx = `import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './${name}.module.css';

export type ${name}Variant = ${variantUnion};
export type ${name}Size = ${sizeUnion};

export interface ${name}Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ${name}Variant;
  size?: ${name}Size;${blockProp}
  children?: ReactNode;
}

/**
 * ${name} — Figma COMPONENT_SET 기반 생성
 *
 * 접근성:
 * - type="button" 기본값 (form submit 방지)
 * - aria-disabled + data-disabled (포커스 유지하며 비활성화)
 * - data-variant / data-size (CSS data-attribute 타겟팅)
 * - forwardRef (부모 ref 접근 지원)
 */
export const ${name} = forwardRef<HTMLButtonElement, ${name}Props>(
  (
    {
      variant = '${defaultVariant}',
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
      data-variant={variant}
      data-size={size}${blockAttr}
      data-disabled={disabled ? '' : undefined}
      aria-disabled={disabled || undefined}
      className={\`\${styles.root} \${className}\`}
      {...props}
    >
      {children}
    </button>
  ),
);
${name}.displayName = '${name}';

export default ${name};
`;

  // ── CSS ──────────────────────────────────────────────────────────
  const disabledColorLine = disabledStyle.color ? `\n  color: ${disabledStyle.color};` : '';
  const blockRule = hasBlock
    ? `\n/* ── Block ── */\n.root[data-block] {\n  display: flex;\n  width: 100%;\n}\n`
    : '';

  const css = `/**
 * ${name}.module.css
 * ${hasVariants ? 'Figma COMPONENT_SET 실제값 기반' : 'tokens.css 변수 기반 (COMPONENT_SET 데이터 없음)'}
 */

.root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${fallback(figmaStyles?.gap, 'var(--spacing-4, 0.25rem)')};
  border: none;
  cursor: pointer;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  text-decoration: none;
  font-family: inherit;
  transition: opacity 150ms ease, transform 150ms ease, background 150ms ease;
}

.root:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ── Disabled ── */
.root[data-disabled] {
  opacity: ${disabledStyle.opacity};${disabledColorLine}
  cursor: not-allowed;
  pointer-events: none;
}
${blockRule}
/* ── Size variants ── */
${sizeRules}

/* ── Style variants ── */
${buildVariantRules()}
`;

  return { name, category: 'action', tsx, css };
}
