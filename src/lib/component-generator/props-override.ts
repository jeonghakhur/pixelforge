/**
 * Component Props Override — 타입 + Zod 스키마
 *
 * Figma에서 자동 생성된 props를 개발자가 수동으로 편집할 수 있게 한다.
 * sourceName을 매칭 키로 사용하여 Figma 재전송 후에도 오버라이드가 유지된다.
 */

import { z } from 'zod'

// ── 타입 정의 ─────────────────────────────────────────────────────────────

export interface PropsOverride {
  /** 원본 prop 이름 (매칭 키) — 재전송 시 이 이름으로 매칭 */
  sourceName: string
  /** 편집된 prop 이름 (최종 출력 이름) */
  name: string
  /** 삭제 플래그 — true면 TSX에 포함하지 않음 */
  removed: boolean
  /** 편집된 TypeScript 타입 (undefined면 원본 타입 유지) */
  tsType?: string
  /** 편집된 기본값 (undefined면 원본 기본값 유지) */
  defaultValue?: string | boolean
  /** prop 종류 */
  kind?: 'union' | 'boolean' | 'node' | 'string'
}

/** 컴포넌트당 오버라이드 묶음 */
export interface ComponentOverrides {
  /** 컴포넌트 이름 (undefined면 원본 유지) */
  name?: string
  /** props 오버라이드 목록 */
  props: PropsOverride[]
}

// ── Zod 스키마 ────────────────────────────────────────────────────────────

export const propsOverrideSchema = z.object({
  sourceName: z.string().min(1),
  name: z.string().min(1).regex(/^[a-z][a-zA-Z0-9]*$/, 'camelCase여야 합니다'),
  removed: z.boolean(),
  tsType: z.string().optional(),
  defaultValue: z.union([z.string(), z.boolean()]).optional(),
  kind: z.enum(['union', 'boolean', 'node', 'string']).optional(),
})

export const componentOverridesSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[A-Z][a-zA-Z0-9]*$/, 'PascalCase여야 합니다')
    .optional(),
  props: z.array(propsOverrideSchema),
})

// ── 헬퍼 ─────────────────────────────────────────────────────────────────

/**
 * prop 목록에서 이름 중복 검증
 * removed=true인 항목은 제외하고 검사
 */
export function validateUniqueNames(props: PropsOverride[]): boolean {
  const names = props.filter(p => !p.removed).map(p => p.name)
  return new Set(names).size === names.length
}
