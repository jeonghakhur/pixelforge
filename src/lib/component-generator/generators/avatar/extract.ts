/**
 * Avatar 전용 추출 로직
 *
 * AvatarImage INSTANCE payload의 childStyles에서
 * 이미지 높이·shape·텍스트 스타일을 추출한다.
 */

import {
  mapCssValue,
  mapFontSizeValue,
  mapLineHeightValue,
  mapFontWeightValue,
} from '../../css-var-mapper'

export interface AvatarTextStyles {
  color: string
  fontSize: string
  fontWeight: string
  lineHeight: string
}

export interface AvatarStyles {
  /** Image 컨테이너 원본 높이 (px 문자열) */
  imageHeight: string
  /** radixProps.variant 기반 shape */
  shape: 'square' | 'circle'
  /** imageHeight에서 분류한 기본 size */
  defaultSize: 'sm' | 'md' | 'lg'
  name: AvatarTextStyles
  source: AvatarTextStyles & { hasUnderline: boolean }
}

/** Image.height px → size slug */
function classifySize(height: string): 'sm' | 'md' | 'lg' {
  const px = parseInt(height, 10)
  if (px <= 180) return 'sm'
  if (px <= 280) return 'md'
  return 'lg'
}

export function extractAvatarStyles(
  childStyles: Record<string, Record<string, string>>,
  radixProps: Record<string, string>,
): AvatarStyles {
  const img = childStyles['Image'] ?? {}

  // "Text and supporting text > Name" / "> Source" 키를 유연하게 탐색
  let nameStyles: Record<string, string> = {}
  let sourceStyles: Record<string, string> = {}

  for (const [key, cs] of Object.entries(childStyles)) {
    const lower = key.toLowerCase()
    if (lower.includes('> name') || lower.endsWith('name')) nameStyles = cs
    if (lower.includes('> source') || lower.endsWith('source')) sourceStyles = cs
  }

  const imageHeight = img.height ?? '320px'
  const shapeRaw = (radixProps.variant ?? 'Square').toLowerCase()
  const shape: 'square' | 'circle' = shapeRaw === 'circle' ? 'circle' : 'square'

  return {
    imageHeight,
    shape,
    defaultSize: classifySize(imageHeight),
    name: {
      color:      mapCssValue(nameStyles.color ?? 'var(--text-primary)'),
      fontSize:   mapFontSizeValue(nameStyles['font-size'] ?? '18px'),
      fontWeight: mapFontWeightValue(nameStyles['font-weight'] ?? '500'),
      lineHeight: mapLineHeightValue(nameStyles['line-height'] ?? '28px'),
    },
    source: {
      color:        mapCssValue(sourceStyles.color ?? 'var(--text-tertiary)'),
      fontSize:     mapFontSizeValue(sourceStyles['font-size'] ?? '16px'),
      fontWeight:   mapFontWeightValue(sourceStyles['font-weight'] ?? '400'),
      lineHeight:   mapLineHeightValue(sourceStyles['line-height'] ?? '24px'),
      hasUnderline: sourceStyles['text-decoration-line'] === 'underline',
    },
  }
}
