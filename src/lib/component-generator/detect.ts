/**
 * 컴포넌트 타입 감지
 *
 * detectedType 보정 + HTML 요소 결정
 */

import type { NormalizedPayload } from './types'

/** detectedType 보정: 이름 기반으로 정확한 컴포넌트 타입 결정 */
export function resolveType(payload: NormalizedPayload): string {
  const { detectedType, name } = payload

  if (/button/i.test(name))               return 'button'
  if (/badge|chip|tag/i.test(name))        return 'badge'
  if (/input|field|textarea/i.test(name))  return 'input'
  if (/card|panel/i.test(name))            return 'card'
  if (/modal|dialog/i.test(name))          return 'modal'
  if (/tab/i.test(name))                   return 'tabs'

  return detectedType
}

export type HtmlElement = 'button' | 'span' | 'input' | 'article' | 'a' | 'div'

/** 컴포넌트 타입 → HTML 요소 */
export function resolveElement(resolvedType: string): HtmlElement {
  switch (resolvedType) {
    case 'button':  return 'button'
    case 'badge':   return 'span'
    case 'input':   return 'input'
    case 'card':    return 'article'
    default:        return 'div'
  }
}
