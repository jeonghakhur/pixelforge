/**
 * Generator Config — 설정 캐시 (DB 의존성 없음)
 *
 * 클라이언트 번들 호환을 위해 DB import를 포함하지 않는다.
 * 서버에서 initGeneratorConfig()로 DB 값을 주입하면 이후 getGeneratorConfigSync()로 접근.
 * 미주입 시 기본값 사용.
 */

export interface GeneratorConfig {
  semanticMap: Record<string, string>;
  colorAbbrev: Record<string, string>;
  styleTypePassthrough: string[];
  paletteKeywords: string[];
}

const DEFAULTS: GeneratorConfig = {
  semanticMap: {
    'colors-gray-white': 'bg-elevated',
    'colors-gray-50': 'bg-surface',
    'colors-gray-100': 'glass-bg',
    'colors-gray-200': 'glass-border',
    'colors-gray-950': 'bg-body',
    'colors-gray-900': 'text-primary',
    'colors-gray-700': 'text-secondary',
    'colors-gray-500': 'text-muted',
    'colors-gray-300': 'border-color',
  },
  colorAbbrev: { background: 'bg', foreground: 'fg' },
  styleTypePassthrough: ['shadow', 'gradient', 'blur'],
  paletteKeywords: ['white', 'black', 'transparent'],
};

export const GENERATOR_CONFIG_KEYS: (keyof GeneratorConfig)[] = [
  'semanticMap', 'colorAbbrev', 'styleTypePassthrough', 'paletteKeywords',
];

export const GENERATOR_DEFAULTS = DEFAULTS;

let _config: GeneratorConfig = { ...DEFAULTS };

/** 서버에서 DB 값을 주입 (파이프라인 실행 전 호출) */
export function initGeneratorConfig(config: GeneratorConfig): void {
  _config = config;
}

/** 동기 접근 — initGeneratorConfig 미호출 시 기본값 반환 */
export function getGeneratorConfigSync(): GeneratorConfig {
  return _config;
}

/** 캐시 무효화 (설정 저장 후 호출) */
export function invalidateGeneratorConfigCache(): void {
  _config = { ...DEFAULTS };
}
