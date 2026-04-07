import type { TokenRow } from '@/lib/actions/tokens';

export const TYPE_PREFIX: Record<string, string> = {
  color:            '',        // 색상은 prefix 없이 경로 기반 (--brand-600, --bg-primary 등)
  typography:       'font',
  spacing:          'spacing',
  'layout-spacing': 'layout',
  radius:           'radius',
  'text-style':     'text',
  heading:          'heading',
  shadow:           'shadow',
  container:        'container',
  width:            'width',
  font:             'font-family',
};

/**
 * 색상 토큰 슬러그 중복 세그먼트 제거
 * - background-bg-brand-solid → bg-brand-solid  (background → bg 약어)
 * - foreground-fg-white       → fg-white         (foreground → fg 약어)
 * - text-text-white           → text-white       (동일 단어 반복)
 * - border-border-primary     → border-primary   (동일 단어 반복)
 * - brand-600                 → brand-600        (변경 없음)
 */
const COLOR_ABBREV: Record<string, string> = {
  background: 'bg',
  foreground: 'fg',
};

export function deduplicateColorSlug(slug: string): string {
  let s = slug;
  while (true) {
    const dashIdx = s.indexOf('-');
    if (dashIdx < 0) break;
    const seg = s.slice(0, dashIdx);
    const rest = s.slice(dashIdx + 1);
    const abbrev = COLOR_ABBREV[seg] ?? seg;
    if (rest.startsWith(`${seg}-`) || rest.startsWith(`${abbrev}-`)) {
      s = rest;
    } else {
      break;
    }
  }
  return s;
}

const TYPE_LABEL: Record<string, string> = {
  color:            'Color',
  typography:       'Typography',
  spacing:          'Spacing',
  'layout-spacing': 'Layout Spacing',
  radius:           'Radius',
  'text-style':     'Text Style',
  heading:          'Heading',
  shadow:           'Shadow',
  container:        'Container',
  width:            'Width',
  font:             'Font',
};

const TYPE_ORDER = ['color', 'typography', 'spacing', 'radius'];

/** mode 문자열이 다크모드 블록에 속하는지 판별 */
function isDarkMode(mode: string | null): boolean {
  return mode !== null && /dark/i.test(mode);
}

export function toVarName(tokenName: string, prefix: string): string {
  if (prefix) {
    // prefix가 있는 타입 (spacing, radius 등): 중복 선두 제거 후 prefix 붙임
    let slug = tokenName
      .replace(/\([^)]*\)/g, '')
      .replace(/[·․]/g, '-')       // U+00B7 middle dot + U+2024 one dot leader → dash
      .replace(/\//g, '-')
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    while (slug.startsWith(`${prefix}-`)) {
      slug = slug.slice(prefix.length + 1);
    }
    // font prefix 특수 처리: "family-font-family-display" → "family-display"
    // Figma path "Font family/font-family-display" → slug "font-family-font-family-display"
    // prefix "font" strip 후 "family-font-family-display" → 내부 "font-family-" 반복 제거
    if (prefix === 'font' && slug.startsWith('family-font-family-')) {
      slug = slug.replace('family-font-family-', 'family-');
    }
    // 복수형 제거: shadows- → shadow prefix와 중복, backdrop-blurs- → blur
    slug = deduplicateSlugSegments(slug, prefix);
    return `--${prefix}-${slug}`;
  }

  // prefix 없는 경우 (color): Primitive vs Semantic vs Component 분기
  const cleanName = tokenName
    .replace(/\((\d+)\)/g, '')         // (900) 같은 숫자 레이블 제거
    .replace(/\(([^)]+)\)/g, '-$1');   // (alpha) → -alpha (괄호 내용 보존)

  const parts = cleanName
    .split('/')
    .map((s) =>
      s.replace(/[·․]/g, '-').replace(/\s+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').toLowerCase(),
    )
    .filter(Boolean);

  if (parts.length <= 1) return `--${parts[0] ?? ''}`;

  // Component colors: 마지막 세그먼트(실제 변수명)만 사용
  //   Component colors/Utility/Brand/utility-brand-600 → --utility-brand-600
  //   Component colors/Alpha/alpha-white-90            → --alpha-white-90
  //   Component colors/Components/Tooltips/tooltip-*   → --tooltip-*
  if (parts[0] === 'component-colors') {
    const lastSegment = parts[parts.length - 1];
    return `--${lastSegment}`;
  }

  const [, second, ...rest] = parts;
  const restSlug = rest.join('-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');

  if (restSlug) {
    const abbrev = COLOR_ABBREV[second] ?? second;
    if (restSlug.startsWith(`${second}-`) || restSlug.startsWith(`${abbrev}-`)) {
      // Semantic: 중복 세그먼트 dedup, colors- prefix 없음
      return `--${deduplicateColorSlug(`${second}-${restSlug}`)}`;
    }
    // Primitive 팔레트 (숫자 스케일: Brand/600 등)만 colors- prefix 유지
    // Effects, Alpha 등 특수 경로는 prefix 없이
    const lastPart = rest[rest.length - 1] ?? '';
    const fullSlug = `${second}-${restSlug}`;
    const isPalette = (/^\d+$/.test(lastPart) || ['white', 'black', 'transparent'].includes(lastPart))
      && !fullSlug.includes('alpha') && !fullSlug.includes('effect');
    if (isPalette) {
      return `--colors-${second}-${restSlug}`;
    }
    // 비팔레트 Primitive (effects, alpha 등): prefix 없이 그대로
    return `--${second}-${restSlug}`;
  }

  // 2-segment (Colors/white, Colors/black): Primitive
  return `--colors-${second}`;
}

/**
 * Component colors slug → 변수명 캐시.
 * slug에서 경로를 복원할 수 없으므로 buildGroups 시점에 캐시를 채운다.
 */
const _componentColorCache = new Map<string, string>();

/** Component colors 토큰의 slug→varName 캐시 등록 (buildGroups에서 호출) */
export function registerComponentColorMapping(originalName: string): void {
  const slug = originalName
    .replace(/\s+/g, '-').replace(/\//g, '-').toLowerCase()
    .replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
  // 마지막 세그먼트 = 실제 변수명
  const lastSlash = originalName.lastIndexOf('/');
  const lastSegment = lastSlash >= 0
    ? originalName.slice(lastSlash + 1).replace(/\s+/g, '-').toLowerCase()
    : originalName.replace(/\s+/g, '-').toLowerCase();
  _componentColorCache.set(slug, lastSegment);
}

/**
 * 색상 CSS slug → PixelForge var name (-- 제외)
 *
 * colors-neutral-900               → colors-neutral-900  (Primitive)
 * colors-background-bg-brand-solid → bg-brand-solid       (Semantic)
 * component-colors-*               → 캐시 조회 또는 dedup 폴백
 */
export function colorSlugToVarName(slug: string): string {
  let s = slug;

  // Component colors: 캐시에서 원본 이름의 마지막 세그먼트 조회
  if (s.startsWith('component-colors-')) {
    const cached = _componentColorCache.get(s);
    if (cached) return cached;
    // 폴백: prefix 제거 + dedup
    s = s.slice('component-colors-'.length);
    return deduplicateColorSlug(s);
  }

  if (s.startsWith('colors-')) s = s.slice('colors-'.length);
  else return s;

  const dashIdx = s.indexOf('-');
  if (dashIdx < 0) return `colors-${s}`;

  const second = s.slice(0, dashIdx);
  const rest = s.slice(dashIdx + 1);
  const abbrev = COLOR_ABBREV[second] ?? second;

  if (rest.startsWith(`${second}-`) || rest.startsWith(`${abbrev}-`)) {
    return deduplicateColorSlug(s); // Semantic
  }
  // Primitive 팔레트만 colors- prefix
  const lastDash = rest.lastIndexOf('-');
  const lastPart = lastDash >= 0 ? rest.slice(lastDash + 1) : rest;
  const isPalette = /^\d+$/.test(lastPart) || ['white', 'black', 'transparent'].includes(lastPart);
  return isPalette ? `colors-${s}` : s;
}

/**
 * DB에 저장된 alias 참조 값에서 실제 CSS 변수명을 해석한다.
 *
 * DB raw 형태 (플러그인 구버전 → 현재):
 *   구버전: var(--color-colors-neutral-900)        ← 불필요한 color- prefix 포함
 *           var(--color-component-colors-utility-brand-utility-brand-600)
 *   현재:   var(--colors-neutral-900)              ← 플러그인 198ff3f 이후 올바른 형식
 *           var(--bg-brand-solid)
 *           var(--spacing-8)
 *
 * 변환 규칙:
 *   color-colors-*      → colors-* (구버전 호환: color- prefix 제거)
 *   colors-*            → colorSlugToVarName (Primitive/Semantic 분기)
 *   component-colors-*  → colorSlugToVarName (마지막 세그먼트 추출)
 *   spacing-N (N≥80)    → layout-spacing-N  (Figma "Spacing" 단일 컬렉션 구버전 호환)
 *                          현재는 "Layout spacing" 컬렉션으로 분리되어 불필요하나 DB 호환용 유지
 */
function resolveAliasRef(rawVar: string): string {
  return rawVar.replace(/var\(--([^)]+)\)/g, (_, varName: string) => {
    let slug = varName;

    // 1. --color- prefix 제거 (구버전 DB 호환: 플러그인이 color- prefix를 잘못 추가했던 시기)
    if (slug.startsWith('color-')) {
      slug = slug.slice('color-'.length);
    }

    // 2. colors- 또는 component-colors- 시작 → colorSlugToVarName
    if (slug.startsWith('colors-') || slug.startsWith('component-colors-')) {
      return `var(--${colorSlugToVarName(slug)})`;
    }

    // 3. spacing alias → layout-spacing 리매핑
    //    tokens.css: --spacing-* (0~64px 스케일), --layout-spacing-* (80px~)
    //    Figma "Layout spacing" 컬렉션은 플러그인이 --layout-spacing-N으로 직접 출력하므로
    //    이 분기는 구버전 단일 "Spacing" 컬렉션 데이터 호환용
    if (slug.startsWith('spacing-')) {
      const numMatch = slug.match(/^spacing-(\d+)$/);
      if (numMatch && parseInt(numMatch[1]) >= 80) {
        return `var(--layout-${slug})`;
      }
    }

    // 4. 나머지 그대로 (--bg-*, --text-*, --utility-*, --radius-* 등 이미 올바른 형식)
    return `var(--${slug})`;
  });
}

function extractDisplayValue(token: TokenRow, type: string): string {
  if (type === 'color') {
    const rawOrValue = token.raw ?? token.value;
    // var() alias 참조
    if (rawOrValue.startsWith('var(--')) {
      return resolveAliasRef(rawOrValue);
    }
    try {
      const parsed = JSON.parse(token.value) as { hex?: string };
      return parsed.hex ?? token.raw ?? token.value;
    } catch {
      return token.raw ?? token.value;
    }
  }

  // typography: font-weight 문자열 → 숫자 변환
  if (type === 'typography') {
    const raw = token.raw ?? token.value;
    return normalizeFontWeight(raw);
  }

  const raw = token.raw ?? token.value;
  // alias 참조가 다른 타입에도 있을 수 있음 (spacing, container, width 등)
  if (raw.startsWith('var(--')) {
    return resolveAliasRef(raw);
  }
  return raw;
}

/** Figma font weight 문자열 → CSS 숫자 */
const FONT_WEIGHT_MAP: Record<string, string> = {
  'thin': '100',
  'extra light': '200',
  'light': '300',
  'regular': '400',
  'regular italic': '400',
  'medium': '500',
  'medium italic': '500',
  'semi bold': '600',
  'semibold': '600',
  'semibold italic': '600',
  'bold': '700',
  'bold italic': '700',
  'extra bold': '800',
  'black': '900',
};

function normalizeFontWeight(value: string): string {
  const lower = value.trim().toLowerCase();
  return FONT_WEIGHT_MAP[lower] ?? value;
}

interface VarLine { varName: string; value: string }
interface TokenGroup { groupName: string; items: VarLine[] }

/**
 * Color 토큰을 분류:
 *   1-primitives      → hex 원시 색상 (Colors/Brand/600 등)
 *   2-semantic/XX      → var 참조 시맨틱 (Colors/Background, Text, Foreground, Border)
 *   3-component        → Component colors, Alpha, Effects
 *
 * Semantic 그룹은 Figma 서브폴더 이름으로 세분류하여 원본 순서 유지
 */

/** Semantic 서브그룹 정렬 순서 (Figma 원본 기준) */
const SEMANTIC_ORDER = ['Background', 'Text', 'Foreground', 'Border', 'Effects'];

function classifyColorGroup(token: TokenRow): string {
  const raw = token.raw ?? token.value;
  const name = token.name;
  const isAlias = raw.startsWith('var(--');

  const nameParts = name.split('/');
  const subGroup = nameParts.length >= 2 ? nameParts[1] : '';

  // Component colors/: 카테고리 + 서브그룹별 분류
  if (name.startsWith('Component colors/')) {
    const COMP_ORDER = ['Utility', 'Components', 'Alpha'];
    const idx = COMP_ORDER.findIndex(c => subGroup.toLowerCase().startsWith(c.toLowerCase()));
    const catKey = idx >= 0 ? String(idx).padStart(2, '0') : '99';
    // Alpha: 단일 그룹 (3레벨이 변수명 자체이므로 세분류 불필요)
    if (subGroup.toLowerCase() === 'alpha') {
      return `3-component-${catKey}-${subGroup}`;
    }
    // Utility/Components: 3레벨 서브그룹 (Brand, Blue, Tooltips 등)
    const thirdGroup = nameParts.length >= 3 ? nameParts[2] : '';
    return `3-component-${catKey}-${subGroup}-${thirdGroup}`;
  }

  // Colors/Neutral (alpha) → Primitives 뒤 별도 그룹
  if (subGroup.toLowerCase().includes('alpha')) return '1-primitives-alpha';
  // Colors/Effects → Primitives 뒤 별도 그룹
  if (subGroup === 'Effects') return '1-primitives-effects';

  // Semantic: alias 참조이거나 시맨틱 경로(Background/Text/Foreground/Border)
  const semanticIdx = SEMANTIC_ORDER.indexOf(subGroup);
  if (isAlias || semanticIdx >= 0) {
    const sortKey = semanticIdx >= 0 ? String(semanticIdx).padStart(2, '0') : '99';
    return `2-semantic-${sortKey}-${subGroup}`;
  }

  // Primitives: hex 값
  return '1-primitives';
}

const COLOR_GROUP_LABEL: Record<string, string> = {
  '1-primitives':         'Primitives',
  '1-primitives-alpha':   'Neutral (alpha)',
  '1-primitives-effects': 'Effects',
};

/** 색상 그룹 라벨 해석 — semantic/component 서브그룹 이름 추출 */
function resolveColorGroupLabel(groupName: string): string {
  if (COLOR_GROUP_LABEL[groupName]) return COLOR_GROUP_LABEL[groupName];
  // 2-semantic-00-Background → Background
  if (groupName.startsWith('2-semantic-')) {
    return groupName.split('-').slice(3).join('-') || 'Semantic';
  }
  // 3-component-00-Utility-Brand → Utility / Brand
  if (groupName.startsWith('3-component-')) {
    const rest = groupName.split('-').slice(3).filter(Boolean);
    return rest.join(' / ') || 'Component colors';
  }
  return groupName;
}

function buildGroups(tokens: TokenRow[], prefix: string): TokenGroup[] {
  const map = new Map<string, VarLine[]>();

  // Color 타입: Primitives → Semantic → Component 순 정렬
  const isColor = prefix === '';

  for (const token of tokens) {
    // Component colors 캐시 등록 (참조 해석용)
    if (isColor && token.name.startsWith('Component colors/')) {
      registerComponentColorMapping(token.name);
    }
    const group = isColor
      ? classifyColorGroup(token)
      : (token.name.indexOf('/') >= 0 ? token.name.slice(0, token.name.indexOf('/')) : '');
    const varName = toVarName(token.name, prefix);

    // Typography / Text Style / Heading: parse JSON value → font shorthand
    if (prefix === 'font' || prefix === 'text' || prefix === 'heading') {
      try {
        const parsed = JSON.parse(token.value) as {
          fontFamily?: string; fontWeight?: number; fontSize?: number;
          lineHeight?: string | number | null; letterSpacing?: string | number | null;
        };
        if (parsed.fontFamily) {
          const lh = parsed.lineHeight ?? 'normal';
          const fontShorthand = `${parsed.fontWeight} ${parsed.fontSize}px/${lh} '${parsed.fontFamily}'`;
          if (!map.has(group)) map.set(group, []);
          map.get(group)!.push({ varName, value: fontShorthand });
          if (parsed.letterSpacing && parsed.letterSpacing !== '0' && parsed.letterSpacing !== 0) {
            map.get(group)!.push({ varName: `${varName}-ls`, value: String(parsed.letterSpacing) });
          }
          continue;
        }
      } catch { /* not JSON typography — fall through */ }
    }

    // Shadow: use raw (CSS box-shadow string)
    if (prefix === 'shadow') {
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push({ varName, value: token.raw ?? token.value });
      continue;
    }

    // Font family: use raw value wrapped in quotes
    if (prefix === 'font-family') {
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push({ varName, value: `'${token.raw ?? token.value}'` });
      continue;
    }

    // String: wrap in quotes so value is valid for CSS content property
    const value = token.type === 'string'
      ? `"${(token.raw ?? token.value).replace(/"/g, '\\"')}"`
      : extractDisplayValue(token, token.type);

    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push({ varName, value });
  }
  const groups = Array.from(map.entries()).map(([groupName, items]) => ({ groupName, items }));
  // Color 타입: 1-primitives → 2-semantic → 3-component 순 정렬
  if (isColor) {
    groups.sort((a, b) => a.groupName.localeCompare(b.groupName));
  }
  // Primitives 패밀리 등장 순서 수집 (Figma 원본 순서 보존)
  if (isColor) {
    for (const group of groups) {
      if (!group.groupName.startsWith('1-primitives')) continue;
      const familyOrder: string[] = [];
      for (const item of group.items) {
        const fam = extractColorFamily(item.varName);
        if (!familyOrder.includes(fam)) familyOrder.push(fam);
      }
      _primitiveFamilyOrder = familyOrder;
      break;
    }
  }

  // 숫자/크기 기반 정렬
  for (const group of groups) {
    group.items.sort((a, b) => sortVarLines(a, b, prefix));
  }
  return groups;
}

/**
 * slug에서 prefix와 의미적으로 중복되는 선두 세그먼트를 제거
 *   shadows-shadow-xs        → shadow-xs         (prefix: shadow)
 *   backdrop-blurs-backdrop-blur-sm → backdrop-blur-sm (prefix: blur → 근본: blur)
 *   focus-rings-focus-ring   → focus-ring         (prefix: shadow → 그룹 이름 제거)
 */
function deduplicateSlugSegments(slug: string, prefix: string): string {
  // 1. 복수형 그룹 이름 제거: shadows-, backdrop-blurs-, focus-rings-, avatars-
  const groupRe = /^[a-z]+-(?:s|es|rs|blurs)-/;
  let s = slug;
  // 반복 세그먼트 제거: "shadows-" (prefix의 복수), "focus-rings-"
  const segments = s.split('-');
  // 첫 세그먼트가 prefix의 복수형이면 제거
  if (segments[0] === prefix + 's' || segments[0] + 's' === prefix) {
    s = segments.slice(1).join('-');
  }
  // "backdrop-blurs" → 2-word 그룹명 제거
  if (s.startsWith('backdrop-blurs-')) s = s.slice('backdrop-blurs-'.length);
  if (s.startsWith('focus-rings-')) s = s.slice('focus-rings-'.length);
  if (s.startsWith('avatars-')) s = s.slice('avatars-'.length);
  if (s.startsWith('portfolio-mockups-')) s = s.slice('portfolio-mockups-'.length);
  return s;
}

/** T-shirt 사이즈 순서 (none ~ full) */
const SIZE_ORDER: Record<string, number> = {
  'none': 0, 'xxs': 1, 'xs': 2, 'sm': 3, 'md': 4,
  'lg': 5, 'xl': 6, '2xl': 7, '3xl': 8, '4xl': 9,
  '5xl': 10, '6xl': 11, '7xl': 12, '8xl': 13, '9xl': 14,
  '10xl': 15, '11xl': 16, 'full': 99,
};

/**
 * 시맨틱 색상 토큰 정렬 키
 *
 * 규칙:
 *   1. 기본 계층 (primary → secondary → tertiary → quaternary) + 변형
 *   2. 독립 토큰 (white, placeholder)
 *   3. brand- 그룹 (brand-primary → brand-secondary → brand-tertiary) + 변형
 *   4. 상태 색상 (error → warning → success) + 변형
 *   5. 변형(_hover, _on-brand, _alt)은 부모 바로 뒤
 */
const SEMANTIC_HIERARCHY: Record<string, number> = {
  'primary': 10, 'secondary': 20, 'tertiary': 30, 'quaternary': 40,
};
const SEMANTIC_INDEPENDENT: Record<string, number> = {
  'white': 100, 'placeholder': 101,
};
const SEMANTIC_ROLE: Record<string, number> = {
  'error': 300, 'warning': 310, 'success': 320,
};

export function semanticSortKey(varName: string): number {
  // --text-primary_on-brand → base='text-primary', variant='on-brand'
  // --bg-brand-solid_hover → base='bg-brand-solid', variant='hover'
  const clean = varName.replace(/^--/, '');
  const underIdx = clean.indexOf('_');
  const base = underIdx > 0 ? clean.slice(0, underIdx) : clean;
  const hasVariant = underIdx > 0;

  // prefix 제거 (text-, bg-, fg-, border-)
  const prefixes = ['text-', 'bg-', 'fg-', 'border-', 'utility-', 'alpha-'];
  let slug = base;
  for (const p of prefixes) {
    if (slug.startsWith(p)) { slug = slug.slice(p.length); break; }
  }

  // brand- 그룹 (brand-primary, brand-secondary, brand-tertiary)
  if (slug.startsWith('brand-')) {
    const brandSlug = slug.slice('brand-'.length);
    const hier = SEMANTIC_HIERARCHY[brandSlug];
    if (hier !== undefined) return 200 + hier + (hasVariant ? 1 : 0);
    return 250 + (hasVariant ? 1 : 0);
  }

  // 상태 (error-primary, warning-primary, success-primary)
  for (const [role, order] of Object.entries(SEMANTIC_ROLE)) {
    if (slug.startsWith(role)) return order + (hasVariant ? 1 : 0);
  }

  // 기본 계층 (primary, secondary, tertiary, quaternary)
  const hier = SEMANTIC_HIERARCHY[slug];
  if (hier !== undefined) return hier + (hasVariant ? 1 : 0);

  // 독립 (white, placeholder)
  const indep = SEMANTIC_INDEPENDENT[slug];
  if (indep !== undefined) return indep + (hasVariant ? 1 : 0);

  // solid, _hover 등 기타
  return 150 + (hasVariant ? 1 : 0);
}

function sortVarLines(a: VarLine, b: VarLine, prefix: string): number {
  // Color Primitives: 패밀리별 그룹핑 → 스케일순
  if (prefix === '' && a.varName.startsWith('--colors-') && b.varName.startsWith('--colors-')) {
    const famA = extractColorFamily(a.varName);
    const famB = extractColorFamily(b.varName);
    if (famA !== famB) {
      return familySortKey(famA) - familySortKey(famB);
    }
    const scaleA = extractNumericKey(a.varName);
    const scaleB = extractNumericKey(b.varName);
    if (scaleA !== Infinity || scaleB !== Infinity) return scaleA - scaleB;
    return a.varName.localeCompare(b.varName);
  }

  // 시맨틱 색상 (--text-*, --bg-*, --fg-*, --border-*): 계층 순 + 변형 부모 뒤
  if (prefix === '' && !a.varName.startsWith('--colors-') && !b.varName.startsWith('--colors-')) {
    const semA = semanticSortKey(a.varName);
    const semB = semanticSortKey(b.varName);
    if (semA !== semB) return semA - semB;
    // 같은 시맨틱 키 내: 스케일 숫자순 (utility-brand-50 → 100 → ... → 950)
    const numA = extractNumericKey(a.varName);
    const numB = extractNumericKey(b.varName);
    if (numA !== Infinity && numB !== Infinity) return numA - numB;
  }

  // px 값 기준
  const pxA = extractPxValue(a.value);
  const pxB = extractPxValue(b.value);
  if (pxA !== null && pxB !== null) return pxA - pxB;

  // 변수명 끝 숫자 (spacing-0-5 → 0.5, layout-spacing-96 → 96)
  const numA = extractNumericKey(a.varName);
  const numB = extractNumericKey(b.varName);
  if (numA !== Infinity && numB !== Infinity) return numA - numB;

  // T-shirt 사이즈
  const sizeA = extractSizeKey(a.varName);
  const sizeB = extractSizeKey(b.varName);
  if (sizeA !== Infinity && sizeB !== Infinity) return sizeA - sizeB;

  return 0;
}

/** Primitives 패밀리 등장 순서 (Figma 원본 순서 보존) */
let _primitiveFamilyOrder: string[] = [];

/** --colors-brand-600 → 'brand', --colors-base-white → 'base' */
function extractColorFamily(varName: string): string {
  const m = varName.match(/^--colors-([\w-]+?)-\w+$/);
  return m ? m[1] : varName;
}

/** 패밀리 정렬 키 (Figma 등장 순서 기반) */
function familySortKey(family: string): number {
  const idx = _primitiveFamilyOrder.indexOf(family);
  return idx >= 0 ? idx : 999;
}

/** CSS 값에서 px 숫자 추출 (8px → 8, 9999px → 9999, var(--...) → null) */
function extractPxValue(value: string): number | null {
  const m = value.match(/^(\d+(?:\.\d+)?)px$/);
  return m ? parseFloat(m[1]) : null;
}

/** 변수명에서 마지막 숫자부분 추출 (--spacing-1-5 → 1.5, --spacing-10 → 10) */
function extractNumericKey(varName: string): number {
  const match = varName.match(/-(\d+(?:-\d+)?)$/);
  if (!match) return Infinity;
  return parseFloat(match[1].replace('-', '.'));
}

/** 변수명에서 T-shirt 사이즈 추출 (--width-xxs → 1, --radius-md → 4) */
function extractSizeKey(varName: string): number {
  const match = varName.match(/-(none|\d*x*s|sm|md|lg|\d*xl|full)$/);
  if (!match) return Infinity;
  return SIZE_ORDER[match[1]] ?? Infinity;
}

/** TokenRow 배열 → :root { ... } + [data-theme="dark"] { ... } CSS 문자열 */
export function generateCssCode(tokens: TokenRow[], type: string): string {
  if (tokens.length === 0) return '/* 토큰이 없습니다. */';

  const rootTokens = tokens.filter((t) => !isDarkMode(t.mode));
  const darkTokens  = tokens.filter((t) =>  isDarkMode(t.mode));

  const lines: string[] = [
    `/* Generated by PixelForge · ${formatDate()} */`,
    '',
  ];

  const rootBlock = renderBlock(':root', rootTokens);
  if (rootBlock.length > 0) lines.push(...rootBlock);

  if (darkTokens.length > 0) {
    const darkBlock = renderBlock('[data-theme="dark"]', darkTokens);
    if (darkBlock.length > 0) lines.push('', ...darkBlock);
  }

  return lines.length > 2 ? lines.join('\n') : '/* 토큰이 없습니다. */';
}

function formatDate(): string {
  return new Date()
    .toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\. /g, '-')
    .replace('.', '');
}

/** 모든 타입의 TokenRow → :root { } + [data-theme="dark"] { } CSS 문자열 */
export function generateAllCssCode(allTokens: TokenRow[]): string {
  if (allTokens.length === 0) return '/* 토큰이 없습니다. */';

  // 다크모드 여부로 분리
  const rootTokens = allTokens.filter((t) => !isDarkMode(t.mode));
  const darkTokens  = allTokens.filter((t) =>  isDarkMode(t.mode));

  const lines: string[] = [
    `/* Generated by PixelForge · ${formatDate()} */`,
    '',
  ];

  lines.push(...renderBlock(':root', rootTokens));

  if (darkTokens.length > 0) {
    lines.push('', ...renderBlock('[data-theme="dark"]', darkTokens));
  }

  return lines.join('\n');
}

/** TokenRow[] → CSS 블록 라인 배열 */
function renderBlock(selector: string, tokens: TokenRow[]): string[] {
  const byType = new Map<string, TokenRow[]>();
  for (const token of tokens) {
    if (!byType.has(token.type)) byType.set(token.type, []);
    byType.get(token.type)!.push(token);
  }

  const orderedTypes = [
    ...TYPE_ORDER.filter((t) => byType.has(t)),
    ...[...byType.keys()].filter((t) => !TYPE_ORDER.includes(t)),
  ];

  const inner: string[] = [];
  for (const type of orderedTypes) {
    const typeTokens = byType.get(type)!;
    const prefix = TYPE_PREFIX[type] ?? type;
    const label = TYPE_LABEL[type] ?? type;
    const groups = buildGroups(typeTokens, prefix);
    const allItems = groups.flatMap((g) => g.items);
    if (allItems.length === 0) continue;

    if (inner.length > 0) inner.push('');
    inner.push(`  /* ── ${label} ── */`);

    for (let gi = 0; gi < groups.length; gi++) {
      const { groupName, items } = groups[gi];
      if (gi > 0) inner.push('');
      // Color 분류 라벨 또는 Figma 그룹 이름
      const displayLabel = prefix === '' ? resolveColorGroupLabel(groupName) : groupName;
      if (displayLabel) inner.push(`  /* ${displayLabel} */`);
      for (const { varName, value } of items) {
        inner.push(`  ${varName}: ${value};`);
      }
    }
  }

  if (inner.length === 0) return [];
  return [`${selector} {`, ...inner, '}'];
}

/**
 * CSS 코드를 unified diff (컨텍스트 라인만) 형식으로 래핑.
 * diff2html이 변경 없는 파일 뷰로 렌더링하도록 한다.
 */
export function wrapAsDiff(cssCode: string, filename = 'tokens.css'): string {
  const codeLines = cssCode.split('\n');
  const n = codeLines.length;
  const contextLines = codeLines.map((line) => ` ${line}`).join('\n');
  return [
    `diff --git a/${filename} b/${filename}`,
    `--- a/${filename}`,
    `+++ b/${filename}`,
    `@@ -1,${n} +1,${n} @@`,
    contextLines,
  ].join('\n');
}
