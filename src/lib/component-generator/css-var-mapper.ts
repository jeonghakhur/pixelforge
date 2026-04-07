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

// border-radius px → 프로젝트 토큰 변수
// tokens.css에 정의된 --radius-* 값 기준
const PX_TO_RADIUS: Record<string, string> = {
  // Untitled UI 시맨틱 토큰
  '0px':    'var(--radius-none)',
  '2px':    'var(--radius-xxs)',
  '4px':    'var(--radius-xs)',
  '6px':    'var(--radius-sm)',
  '8px':    'var(--radius-md)',
  '10px':   'var(--radius-lg)',
  '12px':   'var(--radius-xl)',
  '16px':   'var(--radius-2xl)',
  '20px':   'var(--radius-3xl)',
  '24px':   'var(--radius-4xl)',
  '9999px': 'var(--radius-full)',
}

/**
 * border-radius 값 px → 토큰 변수 매핑
 * "8px" → "var(--radius-8)", 매핑 없으면 원래 값 반환
 */
export function mapRadiusValue(value: string): string {
  return PX_TO_RADIUS[value.trim()] ?? value
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
