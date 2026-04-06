/**
 * @deprecated css-generator.ts 사용. 이 파일은 레거시 Bootstrap 5-Variable 패턴용으로, 향후 삭제 예정.
 */
import type { TokenRow } from '@/lib/actions/tokens';
import { TOKEN_TYPE_MAP } from './token-types';

export interface CssExportOptions {
  fileName?: string;
  extractedAt?: string;
  method?: string;
}

interface ColorValue {
  hex: string;
  rgba: { r: number; g: number; b: number; a: number };
}

interface TypographyValue {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight?: number;
  letterSpacing?: number;
}

interface SpacingValue {
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  gap?: number;
}

interface RadiusValue {
  value: number;
}

// ===========================
// 네이밍 변환
// ===========================
function toCssSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[/\\]/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function toCssVarName(tokenType: string, name: string): string {
  // config에서 cssPrefix를 가져오고, 없으면 type 자체를 사용
  const prefix = TOKEN_TYPE_MAP[tokenType]?.cssPrefix ?? tokenType;
  return `--pf-${prefix}-${toCssSlug(name)}`;
}

// ===========================
// 색상 — Bootstrap 5 5-Variable 패턴
// ===========================
function darkenHex(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const r = Math.max(0, Math.round(parseInt(clean.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(clean.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(clean.slice(4, 6), 16) * (1 - amount)));
  const toH = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toH(r)}${toH(g)}${toH(b)}`;
}

function generateColorVars(name: string, cv: ColorValue): string[] {
  const base = toCssVarName('color', name);
  const { r, g, b } = cv.rgba;
  const text = darkenHex(cv.hex, 0.3);
  return [
    `  ${base}:                ${cv.hex};`,
    `  ${base}-rgb:            ${r}, ${g}, ${b};`,
    `  ${base}-text:           ${text};`,
    `  ${base}-bg-subtle:      rgba(${r}, ${g}, ${b}, 0.08);`,
    `  ${base}-border-subtle:  rgba(${r}, ${g}, ${b}, 0.2);`,
  ];
}

// ===========================
// 타이포그래피
// ===========================
function generateTypoVars(name: string, tv: TypographyValue): string[] {
  const slug = toCssSlug(name);
  const lines = [
    `  --pf-font-family-${slug}:    '${tv.fontFamily}', system-ui, sans-serif;`,
    `  --pf-font-size-${slug}:      ${tv.fontSize}px;`,
    `  --pf-font-weight-${slug}:    ${tv.fontWeight};`,
  ];
  if (tv.lineHeight) {
    lines.push(`  --pf-line-height-${slug}:   ${(tv.lineHeight / tv.fontSize).toFixed(2)};`);
  }
  if (tv.letterSpacing) {
    lines.push(`  --pf-letter-spacing-${slug}: ${tv.letterSpacing}px;`);
  }
  return lines;
}

// ===========================
// 간격
// ===========================
function generateSpacingVars(name: string, sv: SpacingValue): string[] {
  const lines: string[] = [];
  const slug = toCssSlug(name);
  if (sv.paddingTop !== undefined && sv.paddingTop > 0) lines.push(`  --pf-spacing-pt-${slug}: ${sv.paddingTop}px;`);
  if (sv.paddingRight !== undefined && sv.paddingRight > 0) lines.push(`  --pf-spacing-pr-${slug}: ${sv.paddingRight}px;`);
  if (sv.paddingBottom !== undefined && sv.paddingBottom > 0) lines.push(`  --pf-spacing-pb-${slug}: ${sv.paddingBottom}px;`);
  if (sv.paddingLeft !== undefined && sv.paddingLeft > 0) lines.push(`  --pf-spacing-pl-${slug}: ${sv.paddingLeft}px;`);
  if (sv.gap !== undefined && sv.gap > 0) lines.push(`  --pf-spacing-gap-${slug}: ${sv.gap}px;`);
  return lines;
}

// ===========================
// 반경
// ===========================
function generateRadiusVars(name: string, rv: RadiusValue): string[] {
  return [`  ${toCssVarName('radius', name)}: ${rv.value}px;`];
}

// ===========================
// 모드 분리
// ===========================
function splitByMode(tokens: TokenRow[]): {
  light: TokenRow[];
  dark: TokenRow[];
  single: TokenRow[];
} {
  const light: TokenRow[] = [];
  const dark: TokenRow[] = [];
  const single: TokenRow[] = [];

  for (const t of tokens) {
    if (!t.mode) {
      single.push(t);
    } else if (/dark/i.test(t.mode)) {
      dark.push(t);
    } else {
      light.push(t);
    }
  }
  return { light, dark, single };
}

// ===========================
// 섹션 생성
// ===========================
function buildSection(tokens: TokenRow[], label: string): string {
  if (tokens.length === 0) return '';

  const lines: string[] = [`  /* ── ${label} ── */`];

  const byType: Record<string, TokenRow[]> = {};
  for (const t of tokens) {
    if (!byType[t.type]) byType[t.type] = [];
    byType[t.type].push(t);
  }

  for (const [type, group] of Object.entries(byType)) {
    if (group.length === 0) continue;
    lines.push(`  /* ${type} */`);
    for (const token of group) {
      try {
        const parsed = JSON.parse(token.value);
        let vars: string[] = [];
        if (type === 'color') vars = generateColorVars(token.name, parsed as ColorValue);
        else if (type === 'typography') vars = generateTypoVars(token.name, parsed as TypographyValue);
        else if (type === 'spacing') vars = generateSpacingVars(token.name, parsed as SpacingValue);
        else if (type === 'radius') vars = generateRadiusVars(token.name, parsed as RadiusValue);
        else vars = [`  ${toCssVarName(type, token.name)}: ${token.raw ?? JSON.stringify(parsed)};`];
        lines.push(...vars);
      } catch {
        // 파싱 실패한 토큰은 skip
      }
    }
  }

  return lines.join('\n');
}

// ===========================
// 메인 함수
// ===========================
export function generateTokensCss(tokens: TokenRow[], options?: CssExportOptions): string {
  const fileName = options?.fileName ?? 'Design Tokens';
  const extractedAt = options?.extractedAt ?? new Date().toISOString();
  const method = options?.method ?? 'node-scan';

  const { light, dark, single } = splitByMode(tokens);

  const header = `/* === PixelForge Design Tokens ===
 * Source: ${fileName}
 * Extracted: ${extractedAt}
 * Method: ${method}
 * Total: ${tokens.length} tokens
 *
 * Usage:
 *   color: var(--pf-color-primary);
 *   background: rgba(var(--pf-color-primary-rgb), 0.1);
 *   font-size: var(--pf-font-size-heading-xl);
 */`;

  const parts: string[] = [header, ''];

  // :root — light 또는 single(mode 없는) 토큰
  const rootTokens = light.length > 0 ? light : single;
  if (rootTokens.length > 0) {
    parts.push(':root {');
    parts.push(buildSection(rootTokens, 'Light / Default'));
    parts.push('}');
    parts.push('');
  }

  // [data-theme="dark"]
  if (dark.length > 0) {
    parts.push('[data-theme="dark"] {');
    parts.push(buildSection(dark, 'Dark'));
    parts.push('}');
    parts.push('');
  }

  // single이 있고 light도 있으면 :root에 single도 추가
  if (light.length > 0 && single.length > 0) {
    parts.push(':root {');
    parts.push(buildSection(single, 'Shared (no mode)'));
    parts.push('}');
    parts.push('');
  }

  return parts.join('\n');
}
