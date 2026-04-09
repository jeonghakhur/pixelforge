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

/** Figma slug → PixelForge var name: colorSlugToVarName에 위임 */
function figmaColorSlugToPixelForge(slug: string): string {
  return colorSlugToVarName(slug);
}

// 시맨틱 매핑 (Figma 변수명 → 우리 디자인 시스템 변수)
// key: 플러그인이 쓰는 var 이름 (-- 제외)
// value: 우리 디자인 시스템 var 이름 (-- 제외)
const SEMANTIC_MAP: Record<string, string> = {
  // 배경
  'colors-gray-white': 'bg-elevated',
  'colors-gray-50':    'bg-surface',
  'colors-gray-100':   'glass-bg',
  'colors-gray-200':   'glass-border',
  'colors-gray-950':   'bg-body',
  // 텍스트
  'colors-gray-900':   'text-primary',
  'colors-gray-700':   'text-secondary',
  'colors-gray-500':   'text-muted',
  // 테두리
  'colors-gray-300':   'border-color',
};

/**
 * CSS 속성값 문자열에서 var(--X) 패턴을 찾아 PixelForge 토큰 형식으로 변환
 * var(--colors-brand-600)               → var(--brand-600)
 * var(--colors-background-bg-brand-solid) → var(--bg-brand-solid)
 */
export function mapCssValue(value: string): string {
  return value.replace(/var\(--([^)]+)\)/g, (_, varName: string) => {
    // 1. 시맨틱 매핑 우선 (PixelForge 자체 디자인 시스템)
    if (SEMANTIC_MAP[varName]) {
      return `var(--${SEMANTIC_MAP[varName]})`;
    }
    // 2. Figma 색상 변수 (colors-*, component-colors-*) → PixelForge 형식
    if (varName.startsWith('colors-') || varName.startsWith('component-colors-')) {
      return `var(--${figmaColorSlugToPixelForge(varName)})`;
    }
    // 3. 그 외 (spacing-*, radius-* 등) 이미 PixelForge 형식
    return `var(--${varName})`;
  });
}

// border-radius px → 프로젝트 토큰 변수 (tokens.css에서 동적 파싱)

function buildRadiusMap(): Record<string, string> {
  const tokensPaths = [
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
  return getSpacingMap()[value.trim()] ?? value
}

/**
 * CSS 블록 전체를 변환
 */
export function mapCssBlock(css: string): string {
  return css.replace(/var\(--([^)]+)\)/g, (_, varName: string) => {
    if (SEMANTIC_MAP[varName]) {
      return `var(--${SEMANTIC_MAP[varName]})`;
    }
    if (varName.startsWith('colors-') || varName.startsWith('component-colors-')) {
      return `var(--${figmaColorSlugToPixelForge(varName)})`;
    }
    return `var(--${varName})`;
  });
}
