import type { PluginComponentPayload, GeneratorOutput } from '../types';
import { mapCssBlock } from '../css-var-mapper';
import {
  BUTTON_VARIANTS,
  BUTTON_SIZES,
  isValidButtonVariant,
  isValidButtonSize,
} from '../a11y/button';

export function generateButton(payload: PluginComponentPayload): GeneratorOutput {
  const { name, radixProps, htmlCss, styles } = payload;

  // radixProps에서 variant / size 추출 — Figma 원본 이름 그대로 사용
  const rawVariant = radixProps['variant'] ?? 'Primary';
  const rawSize = radixProps['size'] ?? 'medium';
  const defaultVariant = isValidButtonVariant(rawVariant) ? rawVariant : 'Primary';
  const defaultSize = isValidButtonSize(rawSize) ? rawSize : 'medium';

  // 루트 스타일에서 width/height 추출 (고정 크기면 SCSS에 반영)
  const rootWidth = styles['width'];
  const rootHeight = styles['height'];
  const hasDimensions = rootWidth && !rootWidth.includes('auto') && rootHeight && !rootHeight.includes('auto');

  const variantUnion = BUTTON_VARIANTS.map((v) => `'${v}'`).join(' | ');
  const sizeUnion = BUTTON_SIZES.map((s) => `'${s}'`).join(' | ');

  // ── TSX 생성 ──────────────────────────────────────────────────────
  const tsx = `import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './${name}.module.css';

export type ${name}Variant = ${variantUnion};
export type ${name}Size = ${sizeUnion};

export interface ${name}Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ${name}Variant;
  size?: ${name}Size;
  children?: ReactNode;
}

/**
 * ${name} — Radix Button 패턴 기반
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
      size = '${defaultSize}',
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
      data-size={size}
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

  // ── CSS 생성 (tokens.css 변수 활용) ──────────────────────────────
  const mappedCss = mapCssBlock(htmlCss);
  const rootDisplay = styles['display'] ?? 'inline-flex';

  const css = `/**
 * ${name}.module.css
 * Figma variant / size 기반 — tokens.css 변수 활용
 */

.root {
  display: ${rootDisplay};
  align-items: center;
  justify-content: center;
  gap: var(--spacing-4, 0.25rem);
  border: none;
  cursor: pointer;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  text-decoration: none;
  font-family: inherit;
  ${hasDimensions ? `width: ${rootWidth};\n  height: ${rootHeight};` : ''}
  transition: opacity 150ms ease, transform 150ms ease, background 150ms ease;
}

.root:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* disabled */
.root[data-disabled] {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

/* ── Size variants ── */
.root[data-size='xsmall'] { padding: 0.25rem var(--spacing-8, 0.5rem);  font-size: 0.75rem;  border-radius: var(--radius-4); }
.root[data-size='small']  { padding: 0.375rem var(--spacing-16, 1rem);  font-size: 0.875rem; border-radius: var(--radius-8); }
.root[data-size='medium'] { padding: 0.5rem var(--spacing-16, 1rem);    font-size: 1rem;     border-radius: var(--radius-8); }
.root[data-size='large']  { padding: 0.625rem var(--spacing-16, 1rem);  font-size: 1rem;     border-radius: var(--radius-12); }
.root[data-size='xlarge'] { padding: 0.75rem var(--spacing-48, 1.5rem); font-size: 1.125rem; border-radius: var(--radius-12); }

/* ── Style variants ── */
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
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  box-shadow: var(--elevation-10);
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
.root[data-variant='Invisible']:hover:not([data-disabled]) { background: var(--glass-bg); color: var(--text-primary); }

/* ── Figma 원본 스타일 참고 ──
${mappedCss.replace(/^/gm, '   ')}
*/
`;

  return { name, category: 'action', tsx, css };
}
