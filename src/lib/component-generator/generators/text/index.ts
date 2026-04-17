/**
 * Text 컴포넌트 제너레이터
 *
 * DB Typography 토큰(Font size / Line height) 기반으로
 * Text.tsx + Text.module.css를 생성한다.
 *
 * Button generator와 달리 NormalizedPayload / tsx-builder 미사용.
 * COMPONENT_SET이 없는 Text 예외 경로 전용.
 */

import type { TypographyPayload, GeneratorOutput, GeneratorWarning } from '../../types'

// ── CSS 생성 ─────────────────────────────────────────────────────────

function buildTextCSS(payload: TypographyPayload): string {
  const { sizes, weights, colorTokens, sizeTokenMap } = payload

  const lines: string[] = []

  // ── Base ──
  lines.push(`/* ── Base ── */`)
  lines.push(`.root {`)
  lines.push(`  font-family: var(--font-family-body, Inter);`)
  lines.push(`  font-size: var(--font-size-text-md, 1rem);`)
  lines.push(`  line-height: var(--line-height-text-md, 1.5rem);`)
  lines.push(`  font-weight: var(--font-weight-regular, 400);`)
  lines.push(`  color: var(--text-primary);`)
  lines.push(`  margin: 0;`)
  lines.push(`}`)
  lines.push(``)

  // ── Size ──
  lines.push(`/* ── Size ── */`)
  for (const size of sizes) {
    const t = sizeTokenMap[size]
    if (!t) continue
    lines.push(`.root[data-size='${size}'] {`)
    if (t.fontFamily === 'display') {
      lines.push(`  font-family: var(--font-family-display, Inter);`)
    }
    lines.push(`  font-size: var(--font-size-${size}, ${t.fontSize});`)
    lines.push(`  line-height: var(--line-height-${size}, ${t.lineHeight});`)
    lines.push(`}`)
  }
  lines.push(``)

  // ── Weight ──
  lines.push(`/* ── Weight ── */`)
  const weightMap: Record<string, string> = {
    medium: '500',
    semibold: '600',
    bold: '700',
  }
  for (const [w, fallback] of Object.entries(weightMap)) {
    if (weights.includes(w)) {
      lines.push(`.root[data-weight='${w}'] { font-weight: var(--font-weight-${w}, ${fallback}); }`)
    }
  }
  lines.push(``)

  // ── Color ── (primary는 base에서 처리)
  lines.push(`/* ── Color ── */`)
  for (const color of colorTokens) {
    if (color === 'primary') continue
    lines.push(`.root[data-color='${color}'] { color: var(--text-${color}); }`)
  }
  lines.push(``)

  // ── Align ──
  lines.push(`/* ── Align ── */`)
  lines.push(`.root[data-align='left']   { text-align: left; }`)
  lines.push(`.root[data-align='center'] { text-align: center; }`)
  lines.push(`.root[data-align='right']  { text-align: right; }`)
  lines.push(``)

  // ── Wrap ──
  lines.push(`/* ── Wrap ── */`)
  lines.push(`.root[data-wrap='balance'] { text-wrap: balance; }`)
  lines.push(`.root[data-wrap='pretty']  { text-wrap: pretty; }`)
  lines.push(`.root[data-wrap='nowrap']  { white-space: nowrap; }`)
  lines.push(``)

  // ── Truncate ──
  lines.push(`/* ── Truncate ── */`)
  lines.push(`.truncate {`)
  lines.push(`  overflow: hidden;`)
  lines.push(`  text-overflow: ellipsis;`)
  lines.push(`  white-space: nowrap;`)
  lines.push(`}`)
  lines.push(``)

  // ── sr-only (VisuallyHidden 패턴) ──
  lines.push(`/* ── sr-only ── */`)
  lines.push(`.srOnly {`)
  lines.push(`  position: absolute;`)
  lines.push(`  width: 1px;`)
  lines.push(`  height: 1px;`)
  lines.push(`  padding: 0;`)
  lines.push(`  margin: -1px;`)
  lines.push(`  overflow: hidden;`)
  lines.push(`  clip: rect(0, 0, 0, 0);`)
  lines.push(`  white-space: nowrap;`)
  lines.push(`  border-width: 0;`)
  lines.push(`}`)

  return `/**\n * Text.module.css\n * source: DB Typography tokens (font-size / line-height)\n */\n\n` + lines.join('\n')
}

// ── TSX 생성 ─────────────────────────────────────────────────────────

function buildTextTSX(payload: TypographyPayload): string {
  const { sizes, weights, colorTokens } = payload

  const sizeUnion = sizes.map(s => `'${s}'`).join(' | ')
  const weightUnion = weights.map(w => `'${w}'`).join(' | ')
  const colorUnion = colorTokens.map(c => `'${c}'`).join(' | ')

  const defaultSize = sizes.includes('text-md') ? 'text-md' : (sizes[0] ?? 'text-md')
  const defaultColor = colorTokens.includes('primary') ? 'primary' : colorTokens[0] ?? 'primary'

  return `import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Text.module.css';

export type TextSize = ${sizeUnion || "'text-md'"};
export type TextWeight = ${weightUnion || "'regular' | 'medium' | 'semibold' | 'bold'"};
export type TextColor = ${colorUnion || "'primary' | 'secondary'"};
export type TextTag = 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'label';

export interface TextProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  size?: TextSize;
  weight?: TextWeight;
  color?: TextColor;
  as?: TextTag;
  truncate?: boolean;
  align?: 'left' | 'center' | 'right';
  wrap?: 'balance' | 'pretty' | 'nowrap';
  srOnly?: boolean;
}

export function Text({
  children = 'Text',
  size = '${defaultSize}',
  weight = 'regular',
  color = '${defaultColor}',
  as: Tag = 'p',
  truncate,
  align,
  wrap,
  srOnly,
  className,
  ...props
}: TextProps) {
  const cls = [
    styles.root,
    truncate && styles.truncate,
    srOnly && styles.srOnly,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag
      className={cls}
      data-size={size}
      data-weight={weight}
      data-color={color}
      {...(align && { 'data-align': align })}
      {...(wrap && { 'data-wrap': wrap })}
      {...props}
    >
      {children}
    </Tag>
  );
}

export default Text;
`
}

// ── 메인 ─────────────────────────────────────────────────────────────

export function generateText(payload: TypographyPayload): GeneratorOutput {
  const warnings: GeneratorWarning[] = []

  if (payload.sizes.length === 0) {
    warnings.push({
      code: 'TEXT_TOKEN_MISSING',
      message: 'font-size 토큰이 없습니다. 먼저 Typography 토큰을 동기화해주세요.',
    })
  }

  // 최소 폰트 사이즈 경고 (WCAG 권장 12px 미만)
  for (const [size, t] of Object.entries(payload.sizeTokenMap)) {
    const m = t.fontSize.match(/^(\d+(?:\.\d+)?)rem$/)
    if (m && parseFloat(m[1]) * 16 < 12) {
      warnings.push({
        code: 'TEXT_SIZE_BELOW_MIN',
        message: `size '${size}'의 font-size(${t.fontSize})가 12px 미만입니다.`,
        value: size,
      })
    }
  }

  const css = buildTextCSS(payload)
  const tsx = buildTextTSX(payload)

  return { name: 'Text', category: 'feedback', tsx, css, warnings }
}
