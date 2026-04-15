/**
 * Figma CSS 변수 → 프로젝트 디자인 시스템 변수 매핑
 *
 * 플러그인 → PixelForge 변수명 변환 규칙:
 *   Primitive palette  : Colors/Brand/600               → var(--colors-brand-600)
 *   Semantic (alias)   : Colors/Background/bg-brand-solid → var(--bg-brand-solid)   (마지막 세그먼트)
 *   Component colors   : Component colors/.../utility-brand-600 → var(--utility-brand-600) (마지막 세그먼트)
 *   Spacing            : Spacing/8                      → var(--spacing-8)
 *   Layout spacing     : Layout spacing/80              → var(--layout-spacing-80)
 *
 * DB에 구버전 형식(var(--color-colors-*))이 남아 있는 경우는 css-generator.ts::resolveAliasRef 참조.
 */

import { colorSlugToVarName } from '@/lib/tokens/css-generator';
import { getGeneratorConfigSync } from '@/lib/generator-config-cache';

/** Figma slug → PixelForge var name: colorSlugToVarName에 위임 */
function figmaColorSlugToPixelForge(slug: string): string {
  return colorSlugToVarName(slug);
}

/**
 * CSS 속성값 문자열에서 var(--X) 패턴을 찾아 프로젝트 토큰 형식으로 변환
 * 시맨틱 매핑은 Settings > Generator에서 관리 (DB appSettings)
 */
export function mapCssValue(value: string): string {
  return value.replace(/var\(--([^)]+)\)/g, (_, varName: string) => {
    // 1. 시맨틱 매핑 우선 (Settings > Generator에서 설정)
    const semanticMap = getGeneratorConfigSync().semanticMap;
    if (semanticMap[varName]) {
      return `var(--${semanticMap[varName]})`;
    }
    // 2. Figma 색상 변수 (colors-*, component-colors-*) → 프로젝트 형식
    if (varName.startsWith('colors-') || varName.startsWith('component-colors-')) {
      return `var(--${figmaColorSlugToPixelForge(varName)})`;
    }
    // 3. 그 외 (spacing-*, radius-* 등) 이미 프로젝트 형식
    return `var(--${varName})`;
  });
}

// border-radius px → 프로젝트 토큰 변수 (tokens.css에서 동적 파싱)

function buildRadiusMap(): Record<string, string> {
  const tokensPaths = [
    join(process.cwd(), 'public', 'css', 'tokens.css'),
    join(process.cwd(), 'public', 'tokens.css'),
    join(process.cwd(), 'tokens.css'),
  ]
  const tokensPath = tokensPaths.find(p => existsSync(p))
  if (!tokensPath) return {}

  const css = readFileSync(tokensPath, 'utf8')

  // primitive: --radius-md: 8px
  const primitiveMap = new Map<string, string>()
  const primRe = /--radius-([\w-]+):\s*(\d+(?:\.\d+)?px)\s*;/g
  for (const match of css.matchAll(primRe)) {
    primitiveMap.set(`radius-${match[1]}`, match[2])
  }

  // semantic alias: --radius-md: var(--radius-2)
  const aliasRe = /--radius-([\w-]+):\s*var\(--radius-([\w-]+)\)\s*;/g
  const aliasMap = new Map<string, string>()
  for (const match of css.matchAll(aliasRe)) {
    const semanticName = match[1]
    const refName = `radius-${match[2]}`
    const px = primitiveMap.get(refName)
    if (px) aliasMap.set(px, `radius-${semanticName}`)
  }

  // 9999px → radius-full (특수 케이스)
  for (const [name, px] of primitiveMap) {
    if (px === '9999px' && !aliasMap.has(px)) {
      aliasMap.set(px, name)
    }
  }

  const result: Record<string, string> = {}
  for (const [name, px] of primitiveMap) {
    const varName = aliasMap.has(px) ? aliasMap.get(px)! : name
    if (!result[px]) result[px] = `var(--${varName}, ${px})`
  }

  return result
}

let _radiusMap: Record<string, string> | null = null

function getRadiusMap(): Record<string, string> {
  if (!_radiusMap) _radiusMap = buildRadiusMap()
  return _radiusMap
}

/**
 * border-radius 값 px → 토큰 변수 매핑 (fallback 포함)
 * "8px" → "var(--radius-md, 8px)", 매핑 없으면 원래 값 반환
 */
export function mapRadiusValue(value: string): string {
  if (value.includes('var(')) return value
  return getRadiusMap()[value.trim()] ?? value
}

// spacing px → 프로젝트 토큰 변수 (tokens.css에서 동적 파싱)

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * tokens.css에서 --spacing-* 변수를 파싱하여 px → var() 역매핑을 생성한다.
 *
 * 시맨틱 변수(alias)가 있으면 시맨틱 이름을 우선 사용한다.
 * 예: --spacing-md: var(--spacing-2) → 8px는 var(--spacing-md)
 *
 * tokens.css가 없거나 spacing 변수가 없으면 빈 맵 반환 → px 그대로 출력.
 */
function buildSpacingMap(): Record<string, string> {
  const tokensPaths = [
    join(process.cwd(), 'public', 'css', 'tokens.css'),
    join(process.cwd(), 'public', 'tokens.css'),
    join(process.cwd(), 'tokens.css'),
  ]
  const tokensPath = tokensPaths.find(p => existsSync(p))
  if (!tokensPath) return {}

  const css = readFileSync(tokensPath, 'utf8')

  // 1단계: primitive 변수 파싱 (--spacing-2: 8px → { 'spacing-2': '8px' })
  const primitiveMap = new Map<string, string>()
  const primRe = /--spacing-([\w-]+):\s*(\d+(?:\.\d+)?px)\s*;/g
  for (const match of css.matchAll(primRe)) {
    primitiveMap.set(`spacing-${match[1]}`, match[2])
  }

  // 2단계: semantic alias 파싱 (--spacing-md: var(--spacing-2) → { 'spacing-md': 'spacing-2' })
  const aliasRe = /--spacing-([\w-]+):\s*var\(--spacing-([\w-]+)\)\s*;/g
  const aliasMap = new Map<string, string>() // px → semantic var name
  for (const match of css.matchAll(aliasRe)) {
    const semanticName = match[1]
    const refName = `spacing-${match[2]}`
    const px = primitiveMap.get(refName)
    if (px) {
      aliasMap.set(px, `var(--spacing-${semanticName})`)
    }
  }

  // 3단계: px → var() 맵 생성 (semantic 우선, 없으면 primitive, fallback 포함)
  const result: Record<string, string> = {}
  for (const [name, px] of primitiveMap) {
    const varName = aliasMap.has(px)
      ? aliasMap.get(px)!.replace(/^var\(--/, '').replace(/\)$/, '')
      : name
    if (!result[px]) result[px] = `var(--${varName}, ${px})`
  }

  return result
}

let _spacingMap: Record<string, string> | null = null

function getSpacingMap(): Record<string, string> {
  if (!_spacingMap) _spacingMap = buildSpacingMap()
  return _spacingMap
}

/**
 * spacing 값 px → 토큰 변수 매핑
 * "8px" → "var(--spacing-md)", 매핑 없으면 원래 px 값 반환
 */
export function mapSpacingValue(value: string): string {
  if (value.includes('var(')) return value
  return getSpacingMap()[value.trim()] ?? value
}

// ── Typography 역매핑 (tokens.css 동적 파싱) ─────────────────────────────

interface TypographyMaps {
  fontSize: Record<string, string>      // "16px" → "var(--font-size-text-md, 1rem)"
  lineHeight: Record<string, string>    // "24px" → "var(--line-height-text-md, 1.5rem)"
  fontWeight: Record<string, string>    // "600" → "var(--font-weight-semibold, 600)"
}

function pxToRem(px: number): string {
  const rem = px / 16
  return `${rem}rem`
}

function buildTypographyMaps(): TypographyMaps {
  const tokensPaths = [
    join(process.cwd(), 'public', 'css', 'tokens.css'),
    join(process.cwd(), 'public', 'tokens.css'),
    join(process.cwd(), 'tokens.css'),
  ]
  const tokensPath = tokensPaths.find(p => existsSync(p))
  if (!tokensPath) return { fontSize: {}, lineHeight: {}, fontWeight: {} }

  const css = readFileSync(tokensPath, 'utf8')

  const fontSize: Record<string, string> = {}
  const lineHeight: Record<string, string> = {}
  const fontWeight: Record<string, string> = {}

  // --font-size-text-md: 1rem  (또는 레거시 16px)
  for (const match of css.matchAll(/--(font-size-[\w-]+):\s*(\d+(?:\.\d+)?)(rem|px)\s*;/g)) {
    const unit = match[3]
    const px = unit === 'rem' ? parseFloat(match[2]) * 16 : parseFloat(match[2])
    const remVal = unit === 'rem' ? `${match[2]}rem` : pxToRem(px)
    fontSize[`${px}px`] = `var(--${match[1]}, ${remVal})`
  }

  // --line-height-text-md: 1.5rem  (또는 레거시 24px)
  for (const match of css.matchAll(/--(line-height-[\w-]+):\s*(\d+(?:\.\d+)?)(rem|px)\s*;/g)) {
    const unit = match[3]
    const px = unit === 'rem' ? parseFloat(match[2]) * 16 : parseFloat(match[2])
    const remVal = unit === 'rem' ? `${match[2]}rem` : pxToRem(px)
    lineHeight[`${px}px`] = `var(--${match[1]}, ${remVal})`
  }

  // --font-weight-semibold: 600
  for (const match of css.matchAll(/--(font-weight-[\w-]+):\s*(\d+)\s*;/g)) {
    // italic 변형 제외
    if (match[1].includes('italic')) continue
    fontWeight[match[2]] = `var(--${match[1]}, ${match[2]})`
  }

  return { fontSize, lineHeight, fontWeight }
}

let _typographyMaps: TypographyMaps | null = null

function getTypographyMaps(): TypographyMaps {
  if (!_typographyMaps) _typographyMaps = buildTypographyMaps()
  return _typographyMaps
}

/**
 * font-size px → 토큰 변수 매핑 (rem fallback)
 * "16px" → "var(--font-size-text-md, 1rem)", 매핑 없으면 rem 변환만
 */
export function mapFontSizeValue(value: string): string {
  if (value.includes('var(')) return value
  const mapped = getTypographyMaps().fontSize[value.trim()]
  if (mapped) return mapped
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/)
  return match ? `${parseFloat(match[1]) / 16}rem` : value
}

/**
 * line-height px → 토큰 변수 매핑 (rem fallback)
 * "24px" → "var(--line-height-text-md, 1.5rem)", 매핑 없으면 rem 변환만
 */
export function mapLineHeightValue(value: string): string {
  if (value.includes('var(')) return value
  const mapped = getTypographyMaps().lineHeight[value.trim()]
  if (mapped) return mapped
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/)
  return match ? `${parseFloat(match[1]) / 16}rem` : value
}

/**
 * font-weight 값 → 토큰 변수 매핑
 * "600" → "var(--font-weight-semibold, 600)", 매핑 없으면 원래 값
 */
export function mapFontWeightValue(value: string): string {
  if (value.includes('var(')) return value
  return getTypographyMaps().fontWeight[value.trim()] ?? value
}

/**
 * CSS 블록 전체를 변환
 */
export function mapCssBlock(css: string): string {
  return css.replace(/var\(--([^)]+)\)/g, (_, varName: string) => {
    const semanticMap = getGeneratorConfigSync().semanticMap;
    if (semanticMap[varName]) {
      return `var(--${semanticMap[varName]})`;
    }
    if (varName.startsWith('colors-') || varName.startsWith('component-colors-')) {
      return `var(--${figmaColorSlugToPixelForge(varName)})`;
    }
    return `var(--${varName})`;
  });
}
