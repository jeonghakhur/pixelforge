/**
 * Figma CSS 변수 → 프로젝트 디자인 시스템 변수 매핑
 *
 * 플러그인은 Figma Variable 이름을 그대로 CSS 변수로 사용:
 *   var(--colors-gray-white)  ← Figma collection "colors", group "gray", value "white"
 *
 * 우리 토큰 파이프라인은 "color-" prefix를 추가:
 *   var(--color-colors-gray-white)
 *
 * 추가로 시맨틱 별칭을 우선 적용한다.
 */

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
 * CSS 속성값 문자열에서 var(--X) 패턴을 찾아 변환
 * var(--colors-gray-100) → var(--glass-bg) 또는 var(--color-colors-gray-100)
 *
 * Untitled UI 패턴(colors-brand-*, colors-neutral-* 등)은 이미
 * 시맨틱 경로를 포함하므로 prefix 없이 그대로 통과시킨다.
 */
export function mapCssValue(value: string): string {
  return value.replace(/var\(--([^)]+)\)/g, (_, varName: string) => {
    // 1. 시맨틱 매핑 우선 (기존 PixelForge 토큰)
    if (SEMANTIC_MAP[varName]) {
      return `var(--${SEMANTIC_MAP[varName]})`;
    }
    // 2. Untitled UI 패턴: colors-brand-*, colors-neutral-*, colors-base-*, colors-error-* 등
    //    이미 시맨틱 경로 포함 → prefix 없이 그대로 통과
    if (varName.startsWith('colors-')) {
      return `var(--${varName})`;
    }
    // 3. 기존 Figma 토큰 prefix 추가 (spacing-, radius-)
    if (varName.startsWith('spacing-') || varName.startsWith('radius-')) {
      return `var(--color-${varName})`;
    }
    // 4. 이미 우리 형식이거나 알 수 없으면 그대로
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
    if (varName.startsWith('colors-') || varName.startsWith('spacing-') || varName.startsWith('radius-')) {
      return `var(--color-${varName})`;
    }
    return `var(--${varName})`;
  });
}
