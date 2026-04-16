/**
 * Avatar 제너레이터
 *
 * AvatarImage Figma INSTANCE payload → TSX + CSS Module 코드 생성.
 * variants[] 없이 childStyles 기반으로 동작한다.
 * tsx-builder.ts 미사용 (Text 패턴과 동일하게 직접 생성).
 */

import type { NormalizedPayload, GeneratorOutput } from '../../types'
import type { GeneratorContext } from '../registry'
import { extractAvatarStyles, type AvatarStyles } from './extract'

// ── CSS 생성 ─────────────────────────────────────────────────────────────────

function buildAvatarCSS(name: string, s: AvatarStyles): string {
  const sourceDecoration = s.source.hasUnderline ? '\n  text-decoration: underline;' : ''

  return `/**
 * ${name}.module.css
 * source: Figma INSTANCE (variants 없음, childStyles 기반)
 * shape: ${s.shape} | size default: ${s.defaultSize}
 */

/* ── Base ── */
.root {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* ── Image ── */
.image {
  width: 100%;
  background: var(--surface-secondary) center / cover no-repeat;
  aspect-ratio: 1 / 1;
}

/* ── Shape ── */
.root[data-shape='circle'] .image {
  border-radius: 50%;
}
.root[data-shape='square'] .image {
  border-radius: var(--radius-md);
}

/* ── Size ── */
.root[data-size='sm'] .image { height: 160px; }
.root[data-size='md'] .image { height: 240px; }
.root[data-size='lg'] .image { height: 320px; }

/* ── Caption ── */
.caption {
  display: flex;
  flex-direction: column;
}

/* ── Name ── */
.name {
  color: ${s.name.color};
  font-size: ${s.name.fontSize};
  font-weight: ${s.name.fontWeight};
  line-height: ${s.name.lineHeight};
}

/* ── Source ── */
.source {
  color: ${s.source.color};
  font-size: ${s.source.fontSize};
  font-weight: ${s.source.fontWeight};
  line-height: ${s.source.lineHeight};${sourceDecoration}
}
`
}

// ── TSX 생성 ─────────────────────────────────────────────────────────────────

function buildAvatarTSX(componentName: string, s: AvatarStyles): string {
  return `import styles from './${componentName}.module.css'
import { forwardRef } from 'react'

export interface ${componentName}Props extends React.HTMLAttributes<HTMLElement> {
  /** 이미지 URL — 없으면 CSS placeholder 배경 사용 */
  src?: string
  /** 표시 이름 (Name 텍스트) */
  name?: string
  /** 직책/출처 (Source 텍스트) */
  role?: string
  /** 이미지 형태 */
  shape?: 'square' | 'circle'
  /** 이미지 크기 (sm: 160px / md: 240px / lg: 320px) */
  size?: 'sm' | 'md' | 'lg'
}

export const ${componentName} = forwardRef<HTMLElement, ${componentName}Props>(
  (
    {
      src,
      name,
      role,
      shape = '${s.shape}',
      size = '${s.defaultSize}',
      className = '',
      ...props
    },
    ref,
  ) => (
    <figure
      ref={ref}
      data-shape={shape}
      data-size={size}
      className={\`\${styles.root}\${className ? \` \${className}\` : ''}\`}
      {...props}
    >
      <div
        className={styles.image}
        style={src ? { backgroundImage: \`url(\${src})\` } : undefined}
        role="img"
        aria-label={name}
      />
      {(name || role) && (
        <figcaption className={styles.caption}>
          {name && <span className={styles.name}>{name}</span>}
          {role && <span className={styles.source}>{role}</span>}
        </figcaption>
      )}
    </figure>
  ),
)

${componentName}.displayName = '${componentName}'

export default ${componentName}
`
}

// ── 메인 제너레이터 ───────────────────────────────────────────────────────────

export function generateAvatar(
  payload: NormalizedPayload,
  _ctx: GeneratorContext,
): GeneratorOutput {
  const { name, childStyles, radixProps } = payload

  const styles = extractAvatarStyles(childStyles, radixProps)
  const tsx = buildAvatarTSX(name, styles)
  const css = buildAvatarCSS(name, styles)

  return {
    name,
    category: 'feedback',
    tsx,
    css,
    warnings: [],
  }
}
