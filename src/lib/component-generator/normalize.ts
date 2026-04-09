/**
 * 플러그인 페이로드 정규화
 *
 * raw JSON → NormalizedPayload 변환
 * - 컴포넌트 이름 추출 (PascalCase)
 * - radixProps 정규화 (color→variant, nodeName 파싱)
 * - optional 필드 기본값 부여
 * - legacy 필드(html, htmlClass, htmlCss, jsx) 무시
 */

import type { NormalizedPayload } from './types'

// ── Figma color → Button variant 매핑 ───────────────────────────────
const COLOR_TO_VARIANT: Record<string, string> = {
  gray:    'Default',
  blue:    'Primary',
  accent:  'Primary',
  green:   'Primary',
  red:     'Outline',
  ghost:   'Invisible',
  outline: 'Outline',
}

// ── 헬퍼 ────────────────────────────────────────────────────────────

function parseVariantProps(nodeName: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!nodeName.includes('=')) return result

  for (const part of nodeName.split(',')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue
    const key = part.slice(0, eqIdx).trim().toLowerCase()
    const val = part.slice(eqIdx + 1).trim()
    if (key && val) result[key] = val
  }
  return result
}

function toPascalCase(str: string): string {
  return str
    .replace(/[_\-\s]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toUpperCase())
}

function extractComponentName(str: string): string {
  const segment = str.includes('/') ? str.split('/').pop()! : str
  return toPascalCase(segment)
}

// ── 메인 정규화 함수 ─────────────────────────────────────────────────

export function normalize(raw: Record<string, unknown>): NormalizedPayload {
  const rawName = typeof raw.name === 'string' ? raw.name : ''
  const texts = raw.texts as { title?: string; all?: string[] } | undefined
  const meta = raw.meta as { nodeName?: string } | undefined
  const nodeName = meta?.nodeName ?? rawName

  // 1. 실제 컴포넌트 이름 추출
  //   - COMPONENT_SET: rawName에 '='가 없으면 정규 이름 → rawName 사용 ("Buttons/Button")
  //     (nodeName에 '='가 있어도 rawName이 깨끗하면 COMPONENT_SET의 대표 variant 설명일 뿐)
  //   - 개별 COMPONENT 인스턴스: rawName 자체에 '=' 포함 → texts.title 폴백
  const hasCleanName = !rawName.includes('=') && rawName.trim().length > 0

  const realName = hasCleanName
    ? extractComponentName(rawName)
    : extractComponentName(texts?.title?.trim() || texts?.all?.[0]?.trim() || rawName)

  // 2. nodeName에서 변형 속성 추출
  const variantProps = parseVariantProps(nodeName)

  // 3. radixProps 정규화
  const originalProps = (raw.radixProps as Record<string, string>) ?? {}
  const normalizedProps: Record<string, string> = { ...originalProps }

  if (normalizedProps.color && !normalizedProps.variant) {
    const mapped = COLOR_TO_VARIANT[normalizedProps.color.toLowerCase()]
    normalizedProps.variant = mapped ?? 'Default'
    delete normalizedProps.color
  }

  if (variantProps.size)    normalizedProps.size    = variantProps.size
  if (variantProps.state)   normalizedProps.state   = variantProps.state
  if (variantProps.block)   normalizedProps.block   = variantProps.block
  if (variantProps.variant) normalizedProps.variant = variantProps.variant

  // 4. NormalizedPayload 구성 (legacy 필드 제외)
  return {
    name:           realName,
    meta:           (raw.meta ?? { nodeId: '', nodeName: '', nodeType: '', masterId: null, masterName: null }) as NormalizedPayload['meta'],
    styles:         (raw.styles as Record<string, string>) ?? {},
    detectedType:   (raw.detectedType as string) ?? 'layout',
    texts:          (raw.texts as NormalizedPayload['texts']) ?? { title: '', description: '', actions: [], all: [] },
    childStyles:    (raw.childStyles as Record<string, Record<string, string>>) ?? {},
    radixProps:     normalizedProps,
    variantOptions: (raw.variantOptions as Record<string, string[]>) ?? {},
    variants:       (raw.variants as NormalizedPayload['variants']) ?? [],
  }
}
