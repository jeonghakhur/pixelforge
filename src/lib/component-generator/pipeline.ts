/**
 * Component Generator 파이프라인
 *
 * 단일 진입점: normalize → detect → generate
 */

import { normalize } from './normalize'
import { resolveType, resolveElement } from './detect'
import { getGenerator } from './generators/registry'
import { generateGeneric } from './generators/generic'
import type { PipelineResult } from './types'
import type { ComponentOverrides } from './props-override'

export interface PipelineOptions {
  overrides?: ComponentOverrides
}

export function runPipeline(raw: Record<string, unknown>, options?: PipelineOptions): PipelineResult {
  // 1. 정규화
  const payload = normalize(raw)

  // 컴포넌트명 오버라이드 적용
  if (options?.overrides?.name) {
    payload.name = options.overrides.name
  }

  // 2. 타입 감지
  const resolvedType = resolveType(payload)

  // 3. 제너레이터 선택 (전용 > 폴백)
  const generator = getGenerator(resolvedType)
  const useGeneric = !generator
  const gen = generator ?? generateGeneric

  // 4. HTML 요소 결정
  const element = resolveElement(resolvedType)

  // 5. 생성
  try {
    const output = gen(payload, { element, overrides: options?.overrides })
    if (useGeneric) {
      output.warnings.push({
        code: 'GENERIC_FALLBACK',
        message: `'${payload.name}': 전용 제너레이터 없음, 범용 폴백 사용`,
      })
    }
    const warnings = output.warnings.map(
      w => `[${w.code}] ${w.message}${w.value ? ` (${w.value})` : ''}`,
    )
    return { success: true, output, warnings, resolvedType }
  } catch (err) {
    return {
      success: false,
      output: null,
      warnings: [],
      resolvedType,
      error: `'${payload.name}' 생성 중 오류: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}
