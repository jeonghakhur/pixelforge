/**
 * Alias 색상 토큰의 실제 hex/rgba 값을 해석한다.
 * alias → alias → hex 체인 최대 5단까지 추적.
 */

import type { TokenRow } from '@/lib/actions/tokens';
import { toVarName } from '@/lib/tokens/css-generator';

export interface ResolvedColorToken extends TokenRow {
  /** alias 해석된 실제 hex 값 (직접값이면 undefined) */
  resolvedHex?: string;
  /** 참조 대상 CSS 변수명 (--colors-neutral-900 등) */
  aliasTarget?: string;
}

function extractVarRef(val: string): string | null {
  const m = val.match(/var\(--([\w-]+)\)/);
  return m ? `--${m[1]}` : null;
}

function extractColorValue(val: string): string | null {
  if (val.startsWith('#')) return val.slice(0, 7);
  if (val.startsWith('rgba(') || val.startsWith('rgb(')) return val;
  try {
    const parsed = JSON.parse(val) as { hex?: string };
    if (parsed.hex) return parsed.hex;
  } catch { /* not JSON */ }
  return null;
}

export function resolveAliasColors(colorTokens: TokenRow[]): ResolvedColorToken[] {
  // 1. 모든 토큰을 (varName, mode) 키로 인덱싱
  const indexByVarMode = new Map<string, TokenRow>();
  const indexByVar = new Map<string, TokenRow>();
  for (const t of colorTokens) {
    const varName = toVarName(t.name, '');
    const modeKey = `${varName}|${t.mode ?? ''}`;
    indexByVarMode.set(modeKey, t);
    if (!indexByVar.has(varName)) indexByVar.set(varName, t);
  }

  // 2. 체인 해석
  function resolveChain(varName: string, mode: string, depth: number): { hex: string; target: string } | null {
    if (depth > 5) return null;
    const modeKey = `${varName}|${mode}`;
    const token = indexByVarMode.get(modeKey) ?? indexByVar.get(varName);
    if (!token) return null;

    const raw = token.raw ?? token.value;
    const hex = extractColorValue(raw);
    if (hex) return { hex, target: varName };

    const ref = extractVarRef(raw);
    if (!ref) return null;
    return resolveChain(ref, mode, depth + 1);
  }

  // 3. 각 토큰에 resolvedHex 추가
  return colorTokens.map((t) => {
    const raw = t.raw ?? t.value;
    const directHex = extractColorValue(raw);
    if (directHex) return t;

    const ref = extractVarRef(raw);
    if (!ref) return t;

    const result = resolveChain(ref, t.mode ?? '', 0);
    if (!result) return t;

    return { ...t, resolvedHex: result.hex, aliasTarget: ref };
  });
}
