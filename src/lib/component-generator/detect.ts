/**
 * 컴포넌트 타입 감지
 *
 * Figma 컴포넌트 이름 → 타입 문자열 → HTML 요소를 결정하는 두 함수.
 *
 * ─ 수정 가이드 ────────────────────────────────────────────────────────────
 * 새 컴포넌트 타입 추가 시:
 *   1. resolveType()에 이름 패턴 한 줄 추가
 *   2. resolveElement()에 case 한 줄 추가
 *   3. generators/registry.ts에 제너레이터 등록
 *   4. docs/conventions/component-generator-guide.md 섹션 4 업데이트
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { NormalizedPayload } from './types'

/**
 * 컴포넌트 이름 기반으로 타입 문자열 결정.
 *
 * 반환값은 generators/registry.ts의 GENERATORS 키와 일치해야 한다.
 * 매칭되는 패턴이 없으면 플러그인이 감지한 detectedType을 그대로 반환하고
 * generic 폴백 제너레이터가 사용된다 (GENERIC_FALLBACK 경고 발생).
 *
 * ⚠️ 패턴 순서 중요: 위쪽이 우선 적용됨.
 *    'button'을 아래에 두면 'ButtonGroup' 이름이 다른 패턴에 먼저 걸릴 수 있음.
 */
export function resolveType(payload: NormalizedPayload): string {
  const { detectedType, name } = payload

  // 전용 제너레이터가 있는 타입 ─ 아래에 새 타입 추가
  if (/button/i.test(name))               return 'button'
  if (/avatar/i.test(name))               return 'avatar'

  // 전용 제너레이터 없음 (generic 폴백) ─ 향후 제너레이터 추가 예정
  if (/badge|chip|tag/i.test(name))        return 'badge'
  if (/input|field|textarea/i.test(name))  return 'input'
  if (/card|panel/i.test(name))            return 'card'
  if (/modal|dialog/i.test(name))          return 'modal'
  if (/tab/i.test(name))                   return 'tabs'

  // 매칭 없음 → 플러그인 감지값 사용 (generic 폴백)
  return detectedType
}

export type HtmlElement = 'button' | 'span' | 'input' | 'article' | 'figure' | 'a' | 'div'

/**
 * 타입 문자열 → 생성될 TSX 루트 HTML 요소 결정.
 *
 * 시맨틱 HTML 원칙을 따른다:
 *   button → <button>  (인터랙션)
 *   avatar → <figure>  (이미지 + 캡션)
 *   badge  → <span>    (인라인 레이블)
 *   input  → <input>   (폼 요소)
 *   card   → <article> (독립 콘텐츠 단위)
 *   기타   → <div>     (의미 없는 컨테이너)
 */
export function resolveElement(resolvedType: string): HtmlElement {
  switch (resolvedType) {
    case 'button':  return 'button'
    case 'avatar':  return 'figure'
    case 'badge':   return 'span'
    case 'input':   return 'input'
    case 'card':    return 'article'
    default:        return 'div'
  }
}
