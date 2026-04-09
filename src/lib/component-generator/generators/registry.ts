/**
 * 제너레이터 레지스트리
 *
 * resolvedType → 전용 제너레이터 매핑.
 * 새 전용 제너레이터 추가 시 GENERATORS에 한 줄만 추가.
 */

import type { NormalizedPayload, GeneratorOutput } from '../types'
import { generateButton } from './button'

export interface GeneratorContext {
  element: string
}

export type GeneratorFn = (
  payload: NormalizedPayload,
  ctx: GeneratorContext,
) => GeneratorOutput

const GENERATORS: Record<string, GeneratorFn> = {
  button: generateButton,
}

export function getGenerator(resolvedType: string): GeneratorFn | null {
  return GENERATORS[resolvedType] ?? null
}
