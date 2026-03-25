// ===========================
// 토큰 타입 중앙 설정
// 새 토큰 타입 추가/삭제는 TOKEN_TYPES 배열만 수정하면 됩니다.
// ===========================

export interface TokenTypeConfig {
  /** DB에 저장되는 식별자 */
  id: string;
  /** 한국어 표시명 */
  label: string;
  /** 토큰 페이지 설명 */
  description: string;
  /** Solar 아이콘 */
  icon: string;
  /** Figma 프레임 이름 매칭 패턴 (섹션 스코핑) */
  sectionPattern: RegExp;
  /** CSS 변수 접두어 (--pf-{cssPrefix}-...) */
  cssPrefix: string;
}

export const TOKEN_TYPES: TokenTypeConfig[] = [
  {
    id: 'color',
    label: 'Colors',
    description: 'Figma 파일에서 추출된 색상 팔레트를 확인하고 관리합니다.',
    icon: 'solar:pallete-linear',
    sectionPattern: /^(colors?|colours?|palette|색상|팔레트|fill)/i,
    cssPrefix: 'color',
  },
  {
    id: 'typography',
    label: 'Typography',
    description: '텍스트 스타일과 타입 스케일을 체계적으로 관리합니다.',
    icon: 'solar:text-field-linear',
    sectionPattern: /^(typ(e|o|ography)?|font|text.?style|텍스트|타이포|글자)/i,
    cssPrefix: 'font',
  },
  {
    id: 'spacing',
    label: 'Spacing',
    description: '레이아웃 간격 시스템을 정의하고 일관성을 유지합니다.',
    icon: 'solar:ruler-linear',
    sectionPattern: /^(spacing|space|gap|간격|여백|padding)/i,
    cssPrefix: 'spacing',
  },
  {
    id: 'radius',
    label: 'Radius',
    description: '모서리 둥글기 토큰을 관리합니다.',
    icon: 'solar:crop-linear',
    sectionPattern: /^(radius|corner|rounded|반경|모서리|round)/i,
    cssPrefix: 'radius',
  },
];

/** id → TokenTypeConfig 빠른 조회 */
export const TOKEN_TYPE_MAP: Record<string, TokenTypeConfig> = Object.fromEntries(
  TOKEN_TYPES.map((t) => [t.id, t]),
);

/** 전체 id 배열 */
export const ALL_TOKEN_TYPE_IDS: string[] = TOKEN_TYPES.map((t) => t.id);

/** 동적 TokenType — DB에 저장된 모든 문자열 허용 */
export type TokenType = string;
