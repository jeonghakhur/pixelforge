/**
 * Figma Component Properties → TSX Props 변환
 *
 * Figma 프로퍼티 이름을 정규화하여 React props로 변환한다.
 * emoji, #nodeId 제거 후 camelCase 변환.
 *
 * 타입 매핑:
 *   BOOLEAN       → boolean prop
 *   INSTANCE_SWAP → ReactNode prop
 *   TEXT          → string prop
 */

import type { ComponentPropertyDef } from './types'

/** 정규화된 Component Property */
export interface ParsedComponentProp {
  /** 정규화된 prop 이름 (camelCase) */
  name: string
  /** 원본 Figma 이름 */
  rawName: string
  /** prop 타입 */
  type: 'boolean' | 'node' | 'string'
  /** React 타입 문자열 */
  tsType: string
  /** 기본값 */
  defaultValue: string | boolean
}

// emoji + 기호 제거 (Supplementary, Dingbats, Arrows, Variation Selectors, ZWJ)
const EMOJI_RE = /[\u{1F000}-\u{1FFFF}]|[\u2190-\u27BF]|[\u2B00-\u2BFF]|[\uFE00-\uFE0F]|\u200D|[\u{1F1E0}-\u{1F1FF}]|[\u{E0020}-\u{E007F}]/gu

/**
 * Figma 프로퍼티 이름 정규화
 * "⬅️ Icon leading#3287:1577" → "iconLeading"
 * "🔀 Icon trailing swap#3466:852" → "iconTrailingSwap"
 * "Loading text#8994:0" → "loadingText"
 */
function cleanPropertyName(raw: string): string {
  return raw
    .replace(/#[\d:]+$/, '')        // #nodeId 제거
    .replace(EMOJI_RE, '')           // emoji 제거
    .trim()
    .replace(/\s+(.)/g, (_, c: string) => c.toUpperCase())  // space → camelCase
    .replace(/^(.)/, (c: string) => c.toLowerCase())         // 첫 글자 소문자
}

/**
 * componentProperties → ParsedComponentProp[] 변환
 *
 * variantOptions의 dimension(size, state, hierarchy 등)과
 * 겹치는 프로퍼티는 제외한다 (이미 variant로 처리됨).
 */
/** "iconLeadingSwap" → "iconLeading", 그 외는 그대로 */
function stripSwapSuffix(name: string): string {
  return name.replace(/Swap$/, '')
}

export function parseComponentProperties(
  properties: Record<string, ComponentPropertyDef> | undefined,
  variantDimensions?: string[],
): ParsedComponentProp[] {
  if (!properties) return []

  const dimensionSet = new Set(
    (variantDimensions ?? []).map(d => d.toLowerCase().replace(/\s+/g, '')),
  )

  // 1차 파싱: 모든 props 수집
  interface Entry { name: string; rawKey: string; def: ComponentPropertyDef }
  const entries: Entry[] = []
  for (const [rawKey, def] of Object.entries(properties)) {
    const name = cleanPropertyName(rawKey)
    if (dimensionSet.has(name.toLowerCase())) continue
    entries.push({ name, rawKey, def })
  }

  // BOOLEAN + INSTANCE_SWAP 쌍 감지: "iconLeadingSwap"의 base "iconLeading"과 매칭
  const swapBaseNames = new Set(
    entries
      .filter(e => e.def.type === 'INSTANCE_SWAP')
      .map(e => stripSwapSuffix(e.name))
      .filter(n => n.endsWith('Swap') === false && n !== ''),
  )

  const result: ParsedComponentProp[] = []

  for (const { name, rawKey, def } of entries) {
    switch (def.type) {
      case 'BOOLEAN':
        // 같은 base의 SWAP이 있으면 BOOLEAN은 스킵 (ReactNode로 통합)
        if (swapBaseNames.has(name)) continue
        result.push({
          name,
          rawName: rawKey,
          type: 'boolean',
          tsType: 'boolean',
          defaultValue: def.defaultValue,
        })
        break
      case 'INSTANCE_SWAP':
        result.push({
          // Swap 접미사 제거 → iconLeading, iconTrailing
          name: stripSwapSuffix(name),
          rawName: rawKey,
          type: 'node',
          tsType: 'ReactNode',
          defaultValue: '',
        })
        break
      case 'TEXT':
        result.push({
          name,
          rawName: rawKey,
          type: 'string',
          tsType: 'string',
          defaultValue: def.defaultValue,
        })
        break
    }
  }

  return result
}
