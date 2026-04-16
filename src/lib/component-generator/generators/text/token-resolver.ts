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

/**
 * colors 토큰 slug → Text 컴포넌트 color prop 값
 *
 * tokens.css 변수명 규칙:
 *   Colors/Text/text-quaternary-(500)  → --text-quaternary        (숫자 레이블 제거)
 *   Colors/Text/text-secondary_hover   → --text-secondary_hover   (_는 state 구분자, 보존)
 *   Colors/Text/text-primary_on-brand  → --text-primary_on-brand  (_는 보존)
 *   Colors/Text/text-brand-tertiary    → --text-brand-tertiary     (-는 보존)
 *
 * Text generator: var(--text-{slug})
 * 따라서 slug = tokens.css 변수명에서 "--text-" 제거한 값이어야 함.
 *
 * 처리 순서:
 *   1. 마지막 경로 세그먼트 추출
 *   2. "(숫자)" 레이블 제거 — CSS generator와 동일 규칙
 *   3. 선두 "text-" 제거 — CSS generator가 text-text- → text- dedup하는 것과 동일
 *   4. 공백 → "-", 괄호 제거 (유효 CSS ident)
 *   5. "_"와 "-"는 보존 (tokens.css 규칙 그대로)
 */
function extractColorSlug(name: string): string {
  const last = name.split('/').pop() ?? name
  return last
    .toLowerCase()
    .replace(/\((\d+)\)/g, '')          // (500) 제거 — CSS generator line 161과 동일
    .replace(/\(([^)]+)\)/g, '-$1')     // (alpha) → -alpha
    .replace(/\s+/g, '-')               // 공백 → dash
    .replace(/^text-/, '')              // 선두 "text-" 제거 (css-generator dedup과 대응)
    .replace(/[^a-z0-9_-]/g, '')        // _와 -는 보존, 그 외 특수문자만 제거
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
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

  // color slug 목록 — extractColorSlug로 CSS-safe ident 생성
  const rawColorSlugs = colorRows.length > 0
    ? colorRows.map(r => extractColorSlug(r.name))
    : ['primary', 'secondary', 'tertiary', 'quaternary', 'disabled', 'placeholder']

  // 빈 slug 제거 + 중복 제거
  const colorTokens = [...new Set(rawColorSlugs.filter(Boolean))]

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
