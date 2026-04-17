/**
 * 제너레이터 레지스트리
 *
 * resolvedType(detect.ts 반환값) → 전용 제너레이터 함수 매핑.
 *
 * ─ 수정 가이드 ─────────────────────────────────────────────────────────────
 * 새 제너레이터 추가 순서:
 *   1. generators/{type}/index.ts 와 extract.ts 작성
 *   2. 아래 import 추가:  import { generateXxx } from './xxx'
 *   3. GENERATORS에 추가: xxx: generateXxx
 *   4. detect.ts의 resolveType()에 이름 패턴 추가
 *   5. detect.ts의 resolveElement()에 HTML 요소 추가
 *   6. docs/conventions/component-generator-guide.md 섹션 4 업데이트
 *
 * 등록하지 않으면 해당 타입은 generic.ts 폴백을 사용하고
 * GENERIC_FALLBACK 경고가 붙는다.
 * ───────────────────────────────────────────────────────────────────────────
 */

import type { NormalizedPayload, GeneratorOutput } from '../types'
import type { ComponentOverrides } from '../props-override'
import { generateButton } from './button'
import { generateAvatar } from './avatar'

export interface GeneratorContext {
  element: string
  overrides?: ComponentOverrides
}

export type GeneratorFn = (
  payload: NormalizedPayload,
  ctx: GeneratorContext,
) => GeneratorOutput

const GENERATORS: Record<string, GeneratorFn> = {
  button: generateButton,
  avatar: generateAvatar,
}

export function getGenerator(resolvedType: string): GeneratorFn | null {
  return GENERATORS[resolvedType] ?? null
}
