'use server';

import type { FigmaTokenForCompare } from '@/lib/tokens/drift-detector';

// ===========================
// Plugin JSON 포맷 타입
// ===========================

/**
 * PixelForge 자체 포맷 (커스텀 플러그인에서 내보내기)
 * figma.variables.getLocalVariables() 결과를 가공한 형태
 */
export interface PixelForgePluginToken {
  name: string;
  type: 'color' | 'typography' | 'spacing' | 'radius';
  value: Record<string, unknown>;
  raw?: string;
  mode?: string;
  collection?: string;
}

export interface PixelForgePluginExport {
  format: 'pixelforge';
  version: number;
  exportedAt: string;
  tokens: PixelForgePluginToken[];
}

/**
 * Tokens Studio JSON 포맷 (커뮤니티 표준)
 * { "colors": { "primary": { "value": "#2563eb", "type": "color" }, ... } }
 */
interface TokensStudioValue {
  value: string | number | Record<string, unknown>;
  type: string;
  description?: string;
}

interface TokensStudioGroup {
  [key: string]: TokensStudioValue | TokensStudioGroup;
}

// ===========================
// 포맷 감지
// ===========================

type DetectedFormat = 'pixelforge' | 'tokens-studio' | 'unknown';

function detectFormat(json: unknown): DetectedFormat {
  if (typeof json !== 'object' || json === null) return 'unknown';

  const obj = json as Record<string, unknown>;

  // PixelForge 자체 포맷
  if (obj.format === 'pixelforge' && Array.isArray(obj.tokens)) {
    return 'pixelforge';
  }

  // Tokens Studio: 최상위에 그룹(object)들이 있고, 내부에 value+type 쌍
  const keys = Object.keys(obj);
  if (keys.length > 0 && keys.every((k) => typeof obj[k] === 'object')) {
    // 아무 leaf에서 value+type 구조 확인
    for (const key of keys) {
      const group = obj[key];
      if (typeof group === 'object' && group !== null) {
        const gObj = group as Record<string, unknown>;
        if ('value' in gObj && 'type' in gObj) return 'tokens-studio';
        // 중첩 그룹 탐색
        for (const inner of Object.values(gObj)) {
          if (typeof inner === 'object' && inner !== null && 'value' in inner && 'type' in inner) {
            return 'tokens-studio';
          }
        }
      }
    }
  }

  return 'unknown';
}

// ===========================
// PixelForge 포맷 파싱
// ===========================

function parsePixelForgeFormat(data: PixelForgePluginExport): FigmaTokenForCompare[] {
  return data.tokens.map((token) => ({
    type: token.type,
    name: token.name,
    value: JSON.stringify(token.value),
    raw: token.raw ?? null,
    mode: token.mode ?? null,
  }));
}

// ===========================
// Tokens Studio 포맷 파싱
// ===========================

function isTokenValue(obj: unknown): obj is TokensStudioValue {
  return typeof obj === 'object' && obj !== null && 'value' in obj && 'type' in obj;
}

function inferTokenType(studioType: string): string | null {
  const t = studioType.toLowerCase();
  if (t === 'color') return 'color';
  if (t === 'fontfamilies' || t === 'fontsizes' || t === 'fontweights' || t === 'lineheights' || t === 'letterspacing' || t === 'typography') return 'typography';
  if (t === 'spacing') return 'spacing';
  if (t === 'borderradius') return 'radius';
  if (t === 'borderwidth') return 'border';
  if (t === 'opacity') return 'opacity';
  if (t === 'boxshadow') return 'shadow';
  if (t === 'dimension' || t === 'sizing') return 'spacing';
  return null;
}

function serializeTokenValue(type: string, value: unknown): { serialized: string; raw: string } {
  if (type === 'color' && typeof value === 'string') {
    // hex → JSON 형식으로 변환
    const hex = value.startsWith('#') ? value : `#${value}`;
    return {
      serialized: JSON.stringify({ hex }),
      raw: hex,
    };
  }

  if (typeof value === 'number') {
    return {
      serialized: JSON.stringify({ value }),
      raw: `${value}`,
    };
  }

  if (typeof value === 'string') {
    return {
      serialized: JSON.stringify({ value }),
      raw: value,
    };
  }

  if (typeof value === 'object' && value !== null) {
    return {
      serialized: JSON.stringify(value),
      raw: JSON.stringify(value),
    };
  }

  return { serialized: JSON.stringify({ value }), raw: String(value) };
}

function flattenTokensStudio(
  group: TokensStudioGroup,
  prefix: string,
  result: FigmaTokenForCompare[],
): void {
  for (const [key, val] of Object.entries(group)) {
    const path = prefix ? `${prefix}/${key}` : key;

    if (isTokenValue(val)) {
      const tokenType = inferTokenType(val.type);
      if (tokenType) {
        const { serialized, raw } = serializeTokenValue(tokenType, val.value);
        result.push({
          type: tokenType,
          name: path,
          value: serialized,
          raw,
          mode: null,
        });
      }
    } else if (typeof val === 'object' && val !== null) {
      flattenTokensStudio(val as TokensStudioGroup, path, result);
    }
  }
}

function parseTokensStudioFormat(data: TokensStudioGroup): FigmaTokenForCompare[] {
  const result: FigmaTokenForCompare[] = [];
  flattenTokensStudio(data, '', result);
  return result;
}

// ===========================
// 메인 파싱 함수
// ===========================

export interface PluginImportResult {
  error: string | null;
  format: DetectedFormat;
  tokens: FigmaTokenForCompare[];
  tokenCount: number;
}

export function parsePluginJson(jsonString: string): PluginImportResult {
  try {
    const parsed = JSON.parse(jsonString);
    const format = detectFormat(parsed);

    if (format === 'unknown') {
      return {
        error: '지원하지 않는 JSON 형식입니다. PixelForge 플러그인 또는 Tokens Studio 형식만 지원합니다.',
        format: 'unknown',
        tokens: [],
        tokenCount: 0,
      };
    }

    let tokens: FigmaTokenForCompare[];

    if (format === 'pixelforge') {
      tokens = parsePixelForgeFormat(parsed as PixelForgePluginExport);
    } else {
      tokens = parseTokensStudioFormat(parsed as TokensStudioGroup);
    }

    if (tokens.length === 0) {
      return {
        error: 'JSON에서 토큰을 찾을 수 없습니다. 파일 내용을 확인해주세요.',
        format,
        tokens: [],
        tokenCount: 0,
      };
    }

    return { error: null, format, tokens, tokenCount: tokens.length };
  } catch {
    return {
      error: '유효하지 않은 JSON 파일입니다.',
      format: 'unknown',
      tokens: [],
      tokenCount: 0,
    };
  }
}
