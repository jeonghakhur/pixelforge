/**
 * Text 컴포넌트 전용 토큰 리졸버
 *
 * DB tokens 테이블에서 Font size / Line height 토큰을 읽어
 * TypographyPayload를 구성한다.
 * COMPONENT_SET이 없는 Text 컴포넌트 생성 예외 경로 전용.
 */

import { db } from '@/lib/db'
import { tokens } from '@/lib/db/schema'
import { getActiveProjectId } from '@/lib/db/active-project'
import { like, and, eq } from 'drizzle-orm'
import type { TypographyPayload, TypographySizeToken } from '../../types'

/** Figma 토큰 표시 순서 (SIZE_ORDER에 없는 값은 뒤로) */
const SIZE_ORDER = [
  'display-2xl', 'display-xl', 'display-lg', 'display-md', 'display-xs',
  'text-xl', 'text-lg', 'text-md', 'text-sm', 'text-xs',
]

const WEIGHTS = ['regular', 'medium', 'semibold', 'bold'] as const

const DISPLAY_RE = /^display-/

/** "Font size/text-xs" → "text-xs" */
function extractSlug(name: string): string {
  return name.split('/').pop()!.toLowerCase().replace(/\s+/g, '-')
}

/** "12px" → "0.75rem", 이미 rem이면 그대로, 그 외 원본 반환 */
function pxToRem(raw: string): string {
  const m = raw.match(/^(\d+(?:\.\d+)?)px$/)
  if (m) return `${parseFloat(m[1]) / 16}rem`
  return raw
}

export async function resolveTypographyPayload(): Promise<TypographyPayload> {
  const projectId = getActiveProjectId()

  // font-size 토큰 조회
  const fontSizeRows = projectId
    ? await db.select().from(tokens).where(
        and(eq(tokens.projectId, projectId), like(tokens.name, 'Font size/%')),
      )
    : []

  // line-height 토큰 조회
  const lineHeightRows = projectId
    ? await db.select().from(tokens).where(
        and(eq(tokens.projectId, projectId), like(tokens.name, 'Line height/%')),
      )
    : []

  // semantic text color 조회 (Colors/Text/* 또는 text-* semantic 토큰)
  const colorRows = projectId
    ? await db.select().from(tokens).where(
        and(eq(tokens.projectId, projectId), like(tokens.name, 'Colors/Text/%')),
      )
    : []

  // line-height 슬러그 → rem 맵
  const lineHeightMap: Record<string, string> = {}
  for (const r of lineHeightRows) {
    lineHeightMap[extractSlug(r.name)] = pxToRem(r.raw ?? r.value)
  }

  // color slug 목록
  const colorTokens = colorRows.length > 0
    ? colorRows.map(r => extractSlug(r.name))
    : ['primary', 'secondary', 'tertiary', 'quaternary', 'disabled', 'placeholder']

  // size 목록 — SIZE_ORDER 기준 정렬, 없는 것 제외
  const foundSlugs = new Set(fontSizeRows.map(r => extractSlug(r.name)))
  const sizes = SIZE_ORDER.filter(s => foundSlugs.has(s))

  // sizeTokenMap 구성
  const sizeTokenMap: Record<string, TypographySizeToken> = {}
  for (const size of sizes) {
    const fsRow = fontSizeRows.find(r => extractSlug(r.name) === size)
    sizeTokenMap[size] = {
      fontSize: pxToRem(fsRow?.raw ?? fsRow?.value ?? '1rem'),
      lineHeight: lineHeightMap[size] ?? '1.5rem',
      fontFamily: DISPLAY_RE.test(size) ? 'display' : 'body',
    }
  }

  return {
    name: 'Text',
    sizes,
    weights: [...WEIGHTS],
    colorTokens,
    sizeTokenMap,
  }
}
