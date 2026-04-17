/**
 * Avatar 전용 추출 로직 (COMPONENT_SET 기반, 범용)
 *
 * 원칙: 노드 데이터를 생성의 기준으로 삼는다.
 *   - 노드에 있는 값 → 그대로 읽어서 CSS에 반영
 *   - 노드에 없는 값 → 생성기가 임의로 추가하지 않음
 *   - 파생 계산(aspect-ratio 등) → 노드에 명시된 값이 있으면 사용하지 않음
 *
 * ─ 수정 가이드 ─────────────────────────────────────────────────────────────
 *
 * ▸ 루트 컨테이너 너비/정렬이 잘못 나올 때
 *   → variants[0].styles 에서 읽는다. 노드의 실제 값을 확인할 것.
 *
 * ▸ 이미지 높이가 잘못 나올 때
 *   → variants[i].childStyles['Image']['height'] 에서 읽는다.
 *   → 레이어 이름이 'Image'가 아니라면 키 이름을 확인해야 한다.
 *
 * ▸ 새로운 레이어가 추가된 경우
 *   → AvatarStyles에 해당 레이어 스타일 필드를 추가하고
 *     extractAvatarStyles() 안에서 childStyles를 읽는 로직을 추가한다.
 * ─────────────────────────────────────────────────────────────────────────
 */

import {
  mapCssValue,
  mapFontSizeValue,
  mapLineHeightValue,
  mapFontWeightValue,
} from '../../css-var-mapper'
import type { NormalizedPayload, NodeTreeEntry } from '../../types'

// ── 공개 인터페이스 ───────────────────────────────────────────────────────────

/** Name / Source 텍스트 레이어의 스타일 */
export interface TextStyle {
  color: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  /** text-decoration-line === 'underline' 여부 */
  hasUnderline: boolean
  /** align-self (예: "stretch") — 노드에서 직접 읽음 */
  alignSelf: string
}

/** componentProperties에서 추출된 BOOLEAN 프롭 하나 */
export interface BooleanPropDef {
  /** camelCase prop 이름 (예: 'source') */
  propName: string
  /** Figma defaultValue를 boolean으로 변환한 값 */
  defaultValue: boolean
  /** 원본 Figma property ID (예: 'Source#3287:4621') — propRefs 역참조에 사용 */
  rawKey: string
}

/**
 * 각 variant의 이미지 치수 정보.
 *
 * ⚠️ aspect-ratio는 사용하지 않는다.
 *    노드에 height가 명시되어 있으므로 파생 계산 없이 직접 사용한다.
 */
export interface VariantDimension {
  /** variantOptions 값을 소문자로 변환한 식별자 (예: 'square', 'portrait') */
  slug: string
  /**
   * Image 레이어의 height — 노드에서 직접 읽은 값 (예: "320px", "440px").
   * 없으면 빈 문자열.
   */
  imageHeight: string
  /** 이름에 'circle'이 포함되면 '50%', 아니면 'var(--radius-md)' */
  borderRadius: string
}

/** extractAvatarStyles()가 반환하는 전체 스타일 데이터 */
export interface AvatarStyles {
  /** variantOptions의 첫 번째 키 (예: 'type') */
  variantPropName: string
  /** 생성될 TypeScript 유니언 타입명 (예: 'AvatarImageType') */
  variantTypeName: string
  /** 첫 번째 variant의 slug — TSX 기본값으로 사용 (예: 'square') */
  defaultVariant: string

  // ── 루트 컨테이너 스타일 (variants[0].styles 기반) ──────────────────────────
  /** 루트 컨테이너 너비 (예: "320px") — 노드에서 직접 읽음 */
  rootWidth: string
  /** 루트 align-items (예: "flex-start") — 노드에서 직접 읽음 */
  rootAlignItems: string
  /** 루트 gap — mapCssValue 변환 후 값 */
  rootGap: string

  // ── Image 레이어 공통 스타일 ─────────────────────────────────────────────────
  /** 이미지 align-self (예: "stretch") — 노드에서 직접 읽음, 모든 variant 공통 */
  imageAlignSelf: string

  // ── Caption 레이어 스타일 ────────────────────────────────────────────────────
  /** 캡션 align-self (예: "stretch") — 노드에서 직접 읽음 */
  captionAlignSelf: string
  /** 캡션 align-items (예: "flex-start") — 노드에서 직접 읽음 */
  captionAlignItems: string

  /** 각 variant의 이미지 치수 정보 */
  dimensions: VariantDimension[]
  /** componentProperties에서 추출한 BOOLEAN 프롭 목록 */
  booleanProps: BooleanPropDef[]
  /**
   * figcaption 전체를 게이트하는 boolean prop 이름 (예: 'source').
   * nodeTree propRefs.visible → booleanProps rawKey 역참조로 결정.
   * 없으면 undefined — caption 가시성은 텍스트 props만으로 결정.
   */
  captionGateProp?: string
  /** "Name" 텍스트 레이어 스타일 */
  name: TextStyle
  /** "Source" 텍스트 레이어 스타일 */
  source: TextStyle
}

// ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

/**
 * Figma componentProperties 키의 ID 접미사 제거
 * 예: "Source#3287:4621" → "Source"
 */
function stripPropId(key: string): string {
  return key.replace(/#[^#]*$/, '').trim()
}

/**
 * Figma prop 이름 → camelCase 변환
 * 예:
 *   "Source"      → "source"
 *   "Show Source" → "showSource"
 *   "show-border" → "showBorder"
 */
function toCamelCase(s: string): string {
  const words = s.trim().split(/[\s_-]+/)
  return words
    .map((w, i) =>
      i === 0
        ? w.charAt(0).toLowerCase() + w.slice(1)
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join('')
}

/**
 * childStyles에서 텍스트 레이어 하나의 스타일을 추출한다.
 *
 * 원칙: 노드에 있는 값을 우선 사용하고, 없을 때만 defaults를 사용한다.
 * css-var-mapper를 통해 Figma 변수명을 프로젝트 토큰 변수로 변환한다.
 */
function extractTextStyle(
  cs: Record<string, string>,
  defaults: { color: string; fontSize: string; fontWeight: string; lineHeight: string },
): TextStyle {
  return {
    color:        mapCssValue(cs['color'] ?? defaults.color),
    fontSize:     mapFontSizeValue(cs['font-size'] ?? defaults.fontSize),
    fontWeight:   mapFontWeightValue(cs['font-weight'] ?? defaults.fontWeight),
    lineHeight:   mapLineHeightValue(cs['line-height'] ?? defaults.lineHeight),
    hasUnderline: cs['text-decoration-line'] === 'underline',
    alignSelf:    cs['align-self'] ?? '',
  }
}

/**
 * nodeTree를 순회하며 propRefs.visible → 레이어 이름 맵을 만든다.
 * 반환값: { "Source#3287:4621": "Text and supporting text", ... }
 * — captionGateProp 결정에 사용된다.
 */
function buildPropLayerMap(nodeTree?: NodeTreeEntry): Record<string, string> {
  const map: Record<string, string> = {}
  if (!nodeTree) return map
  const walk = (node: NodeTreeEntry) => {
    if (node.propRefs?.visible) map[node.propRefs.visible] = node.name
    node.children?.forEach(walk)
  }
  walk(nodeTree)
  return map
}

// ── 공개 추출 함수 ────────────────────────────────────────────────────────────

/**
 * NormalizedPayload → AvatarStyles 변환 (메인 진입점)
 *
 * 읽는 Figma 데이터:
 *   variants[i].styles          — 루트 컨테이너 스타일 (width, align-items, gap 등)
 *   variants[i].childStyles     — 자식 레이어별 스타일
 *     └ "Image"                 — 이미지 레이어 (height, align-self)
 *     └ caption 컨테이너        — 텍스트 그룹 (align-self, align-items)
 *     └ "...> Name"             — 이름 텍스트 레이어
 *     └ "...> Source"           — 출처 텍스트 레이어
 *   variantOptions              — variant prop 이름 + 값 목록
 *   componentProperties         — BOOLEAN props (source 등)
 */
export function extractAvatarStyles(
  payload: NormalizedPayload,
  componentName: string,
): AvatarStyles {
  const { variantOptions, variants, componentProperties } = payload

  // ── Variant prop 이름 / 타입명 ──────────────────────────────────────────────
  const variantPropName = Object.keys(variantOptions)[0] ?? 'type'
  const variantValues: string[] = variantOptions[variantPropName] ?? []
  const capProp = variantPropName.charAt(0).toUpperCase() + variantPropName.slice(1)
  const variantTypeName = `${componentName}${capProp}`

  // ── 루트 컨테이너 스타일 (variants[0].styles 기반) ───────────────────────────
  // 모든 variant의 루트 스타일이 동일하다는 전제 하에 첫 번째 variant를 사용한다.
  // (Square/Portrait 모두 width: 320px, align-items: flex-start, gap: var(--spacing-md))
  const rootStyles = variants[0]?.styles ?? {}
  const rootWidth     = rootStyles['width'] ?? ''
  const rootAlignItems = rootStyles['align-items'] ?? ''
  const rootGap       = mapCssValue(rootStyles['gap'] ?? 'var(--spacing-md)')

  // ── 각 variant의 이미지 치수 ─────────────────────────────────────────────────
  // Image.height를 노드에서 직접 읽는다 (aspect-ratio 계산 없음).
  const dimensions: VariantDimension[] = variantValues.map((val) => {
    const slug = val.toLowerCase()

    // "circle"이 slug에 포함되면 border-radius를 50% (원형)으로 처리
    const isCircle = /circle/i.test(slug)
    const borderRadius = isCircle ? '50%' : 'var(--radius-md)'

    // variants[]에서 이 slug에 해당하는 항목 탐색
    const vEntry = variants.find((v) =>
      Object.entries(v.properties).some(
        ([k, vv]) =>
          k.toLowerCase() === variantPropName.toLowerCase() &&
          vv.toLowerCase() === slug,
      ),
    )

    // Image.height — 노드에 있는 값 그대로 사용 ("320px", "440px" 등)
    const imageHeight = vEntry?.childStyles['Image']?.['height'] ?? ''

    return { slug, imageHeight, borderRadius }
  })

  if (dimensions.length === 0) {
    dimensions.push({ slug: 'default', imageHeight: '', borderRadius: 'var(--radius-md)' })
  }

  // ── Image 레이어 공통 스타일 ─────────────────────────────────────────────────
  // align-self는 모든 variant에서 동일("stretch")이므로 첫 번째 variant에서 읽는다.
  const imageStyle0 = variants[0]?.childStyles['Image'] ?? {}
  const imageAlignSelf = imageStyle0['align-self'] ?? ''

  // ── Caption 컨테이너 스타일 ───────────────────────────────────────────────────
  // "Image"도 아니고 리프 텍스트 레이어("...> Name", "...> Source")도 아닌
  // 중간 컨테이너를 찾는다. flex-direction이 있으면 컨테이너로 판단.
  const baseChildStyles = variants[0]?.childStyles ?? {}
  let captionAlignSelf  = ''
  let captionAlignItems = ''

  for (const [key, cs] of Object.entries(baseChildStyles)) {
    const lower = key.toLowerCase()
    const isLeaf = lower.includes('> name') || lower.includes('> source')
    const isImage = lower === 'image'
    if (!isImage && !isLeaf && cs['flex-direction']) {
      captionAlignSelf  = cs['align-self']  ?? ''
      captionAlignItems = cs['align-items'] ?? ''
      break
    }
  }

  // ── Boolean props (componentProperties) ─────────────────────────────────────
  // "Source#3287:4621" → propName: "source", rawKey: "Source#3287:4621"
  // INSTANCE_SWAP / TEXT 타입은 현재 미지원 (향후 확장 예정)
  const booleanProps: BooleanPropDef[] = Object.entries(componentProperties ?? {})
    .filter(([, def]) => def.type === 'BOOLEAN')
    .map(([key, def]) => ({
      propName: toCamelCase(stripPropId(key)),
      defaultValue: def.defaultValue === true || def.defaultValue === 'true',
      rawKey: key,
    }))

  // ── captionGateProp 결정 ──────────────────────────────────────────────────────
  // nodeTree를 순회해 propRefs.visible → 레이어 이름 맵을 만든다.
  // 캡션 컨테이너(flex-direction이 있는 중간 레이어)에 바인딩된 prop을 찾아
  // captionGateProp으로 설정한다.
  const propLayerMap = buildPropLayerMap(variants[0]?.nodeTree)
  let captionGateProp: string | undefined

  for (const [propId, layerName] of Object.entries(propLayerMap)) {
    const lower = layerName.toLowerCase()
    // 이미지 레이어나 리프 텍스트가 아닌 중간 컨테이너인지 확인
    if (lower !== 'image' && !lower.includes('> name') && !lower.includes('> source')) {
      const matched = booleanProps.find((b) => b.rawKey === propId)
      if (matched) {
        captionGateProp = matched.propName
        break
      }
    }
  }

  // ── 텍스트 스타일 추출 ────────────────────────────────────────────────────────
  // 우선순위:
  //   1. variants[0].childStyles — "Name", "...> Name" 키 탐색
  //   2. payload.childStyles (fallback) — "Type=Square > ... > Name" 패턴

  let nameCs: Record<string, string>   = {}
  let sourceCs: Record<string, string> = {}

  for (const [key, cs] of Object.entries(baseChildStyles)) {
    const lower = key.toLowerCase()
    if (lower === 'name'   || lower.endsWith('> name'))   nameCs   = cs
    if (lower === 'source' || lower.endsWith('> source')) sourceCs = cs
  }

  // Fallback: payload.childStyles
  if (Object.keys(nameCs).length === 0) {
    for (const [key, cs] of Object.entries(payload.childStyles)) {
      const lower = key.toLowerCase()
      if (lower.includes('> name')   && Object.keys(nameCs).length   === 0) nameCs   = cs
      if (lower.includes('> source') && Object.keys(sourceCs).length === 0) sourceCs = cs
    }
  }

  return {
    variantPropName,
    variantTypeName,
    defaultVariant: dimensions[0].slug,
    rootWidth,
    rootAlignItems,
    rootGap,
    imageAlignSelf,
    captionAlignSelf,
    captionAlignItems,
    dimensions,
    booleanProps,
    captionGateProp,
    // defaults: 노드에서 값을 못 읽었을 때만 사용하는 최후 fallback
    name: extractTextStyle(nameCs, {
      color:      'var(--text-primary)',
      fontSize:   '18px',
      fontWeight: '500',
      lineHeight: '28px',
    }),
    source: extractTextStyle(sourceCs, {
      color:      'var(--text-tertiary)',
      fontSize:   '16px',
      fontWeight: '400',
      lineHeight: '24px',
    }),
  }
}
