/**
 * Avatar 제너레이터 (COMPONENT_SET 기반, 범용)
 *
 * 원칙: 노드 데이터를 생성의 기준으로 삼는다.
 *   - extract.ts가 노드에서 읽어온 값을 CSS/TSX 코드에 그대로 반영한다.
 *   - 노드에 없는 값을 생성기가 임의로 추가하지 않는다.
 *
 * ─ 수정 가이드 ─────────────────────────────────────────────────────────────
 *
 * ▸ 생성되는 CSS를 바꾸고 싶을 때
 *   → buildAvatarCSS()의 템플릿 문자열 수정.
 *   → 값은 s(AvatarStyles)에서 읽는다. 하드코딩하지 말 것.
 *
 * ▸ 생성되는 TSX props를 바꾸고 싶을 때
 *   → buildAvatarTSX()의 interface 템플릿 문자열 수정.
 *
 * ▸ 이 파일 수정 후에는 해당 컴포넌트를 재임포트해야 파일이 갱신된다.
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { NormalizedPayload, GeneratorOutput } from '../../types'
import type { GeneratorContext } from '../registry'
import { extractAvatarStyles, type AvatarStyles } from './extract'

// ── CSS 생성 ─────────────────────────────────────────────────────────────────

/**
 * AvatarStyles → CSS Module 코드 문자열 생성
 *
 * CSS 값의 출처:
 *   .root width        → variants[0].styles['width']
 *   .root align-items  → variants[0].styles['align-items']
 *   .root gap          → variants[0].styles['gap']
 *   .image align-self  → variants[i].childStyles['Image']['align-self']
 *   .image height (variant) → variants[i].childStyles['Image']['height']  (노드 직접값)
 *   .caption align-*   → 캡션 컨테이너 childStyles
 *   .name / .source    → Name / Source 텍스트 레이어 childStyles
 *
 * 노드에 없는 값:
 *   display: block   — <img> 태그는 기본이 inline이므로 block 필요 (렌더 보정)
 *   object-fit: cover — Figma background 'cover' 키워드의 <img> 태그 등가 번역
 *   background: var(--bg-secondary) — src 없을 때 placeholder (빈 상태 디자인)
 */
function buildAvatarCSS(name: string, s: AvatarStyles): string {
  // 루트 스타일 — 노드 값이 있을 때만 출력
  const rootWidthLine      = s.rootWidth      ? `  width: ${s.rootWidth};\n`           : ''
  const rootAlignItemsLine = s.rootAlignItems ? `  align-items: ${s.rootAlignItems};\n` : ''

  // 이미지 레이어 — align-self는 노드에서 읽은 값
  const imageAlignSelfLine = s.imageAlignSelf ? `  align-self: ${s.imageAlignSelf};\n` : ''

  // 캡션 컨테이너 — 노드 값이 있을 때만 출력
  const captionAlignSelfLine  = s.captionAlignSelf  ? `  align-self: ${s.captionAlignSelf};\n`   : ''
  const captionAlignItemsLine = s.captionAlignItems ? `  align-items: ${s.captionAlignItems};\n` : ''

  // Name / Source align-self
  const nameAlignSelfLine   = s.name.alignSelf   ? `  align-self: ${s.name.alignSelf};\n`   : ''
  const sourceAlignSelfLine = s.source.alignSelf ? `  align-self: ${s.source.alignSelf};\n` : ''

  // Source underline
  const sourceDecoration = s.source.hasUnderline ? '\n  text-decoration: underline;' : ''

  // variant별 CSS 규칙 — imageHeight는 노드에서 읽은 값 그대로 사용
  const variantRules = s.dimensions
    .map((d) => {
      const heightLine = d.imageHeight ? `  height: ${d.imageHeight};\n` : ''
      return (
        `/* ── Variant: ${d.slug} ── */\n` +
        `.root[data-${s.variantPropName}='${d.slug}'] .image {\n` +
        heightLine +
        `  border-radius: ${d.borderRadius};\n` +
        `}`
      )
    })
    .join('\n\n')

  return `/**
 * ${name}.module.css
 * source: Figma COMPONENT_SET (variantOptions 기반)
 * variants: ${s.dimensions.map((d) => d.slug).join(', ')}
 */

/* ── Base ── */
.root {
  display: flex;
${rootWidthLine}  flex-direction: column;
${rootAlignItemsLine}  gap: ${s.rootGap};
}

/* ── Image ── */
.image {
  display: block; /* <img>는 기본 inline — block으로 보정 */
${imageAlignSelfLine}  object-fit: cover; /* Figma background/cover 번역 */
  background: var(--bg-secondary); /* src 없을 때 placeholder */
}

/* ── Variants ── */
${variantRules}

/* ── Caption ── */
.caption {
  display: flex;
  flex-direction: column;
${captionAlignSelfLine}${captionAlignItemsLine}}

/* ── Name ── */
.name {
${nameAlignSelfLine}  color: ${s.name.color};
  font-size: ${s.name.fontSize};
  font-weight: ${s.name.fontWeight};
  line-height: ${s.name.lineHeight};
}

/* ── Source ── */
.source {
${sourceAlignSelfLine}  color: ${s.source.color};
  font-size: ${s.source.fontSize};
  font-weight: ${s.source.fontWeight};
  line-height: ${s.source.lineHeight};${sourceDecoration}
}
`
}

// ── TSX 생성 ─────────────────────────────────────────────────────────────────

/**
 * AvatarStyles → TSX 컴포넌트 코드 문자열 생성
 *
 * 동적 생성 항목 (노드 기반):
 *   - 유니언 타입: variantOptions 값 목록
 *   - boolean props: componentProperties BOOLEAN 항목
 *
 * 노드에 없으나 포함된 항목:
 *   - isSafeUrl: XSS 방지 (src prop 보안 검증)
 *   - displayName / jobTitle prop 이름: Figma 레이어명("Name", "Source")을 JSX 친화적으로 변환
 */
function buildAvatarTSX(componentName: string, s: AvatarStyles): string {
  const { variantPropName, variantTypeName, defaultVariant, dimensions, booleanProps, captionGateProp } = s

  const variantUnion = dimensions.map((d) => `'${d.slug}'`).join(' | ')

  const boolInterfaceLines = booleanProps
    .map((b) => `  /** ${b.propName} 표시 여부 */\n  ${b.propName}?: boolean;`)
    .join('\n')
  const boolInterfaceSection = boolInterfaceLines ? `\n${boolInterfaceLines}` : ''

  const boolDestructure = booleanProps.map((b) => `${b.propName} = ${b.defaultValue}`).join(', ')
  const boolDestructureLine = boolDestructure ? `\n      ${boolDestructure},` : ''

  // captionGateProp: nodeTree propRefs 기반으로 extract.ts가 결정
  // 해당 prop이 false이면 figcaption 전체가 숨겨짐 (Figma 바인딩 그대로 반영)
  const captionCondition = captionGateProp
    ? `${captionGateProp} && (displayName || jobTitle)`
    : `displayName || jobTitle`

  return `import styles from './${componentName}.module.css'
import { forwardRef } from 'react'

export type ${variantTypeName} = ${variantUnion};

export interface ${componentName}Props extends React.HTMLAttributes<HTMLElement> {
  /** 이미지 URL — https://, http://, 또는 / 로 시작하는 경로 허용 */
  src?: string;
  /** 표시 이름 (Name 텍스트) */
  displayName?: string;
  /** 직책/출처 텍스트 */
  jobTitle?: string;
  /** 이미지 타입 */
  ${variantPropName}?: ${variantTypeName};${boolInterfaceSection}
}

const isSafeUrl = (url?: string): url is string => {
  if (!url) return false
  const t = url.trim()
  return /^https?:\\/\\//i.test(t) || t.startsWith('/')
}

export const ${componentName} = forwardRef<HTMLElement, ${componentName}Props>(
  (
    {
      src,
      displayName,
      jobTitle,
      ${variantPropName} = '${defaultVariant}',${boolDestructureLine}
      className,
      ...props
    },
    ref,
  ) => {
    const altText = displayName || jobTitle || ''

    return (
      <figure
        ref={ref}
        data-${variantPropName}={${variantPropName}}
        className={[styles.root, className].filter(Boolean).join(' ')}
        {...props}
      >
        {isSafeUrl(src) ? (
          <img
            src={src}
            alt={altText}
            loading="lazy"
            decoding="async"
            className={styles.image}
          />
        ) : (
          <div className={styles.image} aria-hidden="true" />
        )}
        {(${captionCondition}) && (
          <figcaption className={styles.caption}>
            {displayName && <span className={styles.name}>{displayName}</span>}
            {jobTitle && <span className={styles.source}>{jobTitle}</span>}
          </figcaption>
        )}
      </figure>
    )
  },
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
  const { name } = payload
  const s = extractAvatarStyles(payload, name)
  const tsx = buildAvatarTSX(name, s)
  const css = buildAvatarCSS(name, s)
  return { name, category: 'feedback', tsx, css, warnings: [] }
}
