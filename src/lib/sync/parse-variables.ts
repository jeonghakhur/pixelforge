/**
 * Plugin payload (Figma Variables API 응답) → NormalizedToken[]
 *
 * 플러그인이 POST /api/sync/tokens 로 보내는 body.tokens 를 받아
 * 공통 파이프라인이 처리할 수 있는 NormalizedToken 배열로 변환한다.
 */

export interface NormalizedToken {
  type: string;         // 'color' | 'spacing' | 'radius' | 'typography' | 'float' | 'boolean' | 'string'
  name: string;         // 'Color/Brand/Primary'
  value: string;        // '#0066ff' or '16' or 'Inter'
  raw: string | null;   // 원본 값 문자열
  mode: string | null;  // 'Light' | 'Dark' | null
  collectionName: string | null;
  alias: string | null; // alias 참조 시 원본 variable id
}

// ───────────────────────────────────────────────────────
// Figma Variables API 응답 타입 (플러그인 전송 포맷)
// ───────────────────────────────────────────────────────
interface FigmaColor { r: number; g: number; b: number; a: number }
interface FigmaAlias { type: 'VARIABLE_ALIAS'; id: string }
type FigmaValue = FigmaColor | FigmaAlias | number | string | boolean;

interface FigmaVariable {
  id: string;
  name: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  valuesByMode: Record<string, FigmaValue>;
  scopes?: string[];
  collectionId?: string;
}

interface FigmaCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  defaultModeId: string;
}

export interface PluginTokenPayload {
  variables?: {
    variables?: FigmaVariable[];
    variableCollections?: Record<string, FigmaCollection> | FigmaCollection[];
  };
}

// ───────────────────────────────────────────────────────
// 유틸리티
// ───────────────────────────────────────────────────────

function toHex(n: number): string {
  return Math.round(n * 255).toString(16).padStart(2, '0');
}

function rgbaToHex(c: FigmaColor): string {
  const hex = `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
  if (c.a < 1) {
    return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${Math.round(c.a * 100) / 100})`;
  }
  return hex;
}

function isColor(v: FigmaValue): v is FigmaColor {
  return typeof v === 'object' && v !== null && 'r' in v && !('type' in v);
}

function isAlias(v: FigmaValue): v is FigmaAlias {
  return typeof v === 'object' && v !== null && (v as FigmaAlias).type === 'VARIABLE_ALIAS';
}

/** FLOAT variable을 scopes + 이름 패턴으로 타입 분류 */
function inferFloatType(name: string, scopes: string[] = []): string {
  if (scopes.includes('CORNER_RADIUS')) return 'radius';
  if (scopes.includes('GAP') || scopes.includes('WIDTH_HEIGHT')) return 'spacing';
  if (scopes.includes('FONT_SIZE') || scopes.includes('LINE_HEIGHT') || scopes.includes('LETTER_SPACING')) return 'typography';

  const lower = name.toLowerCase();
  if (/radius|corner|rounded/.test(lower)) return 'radius';
  if (/spacing|gap|padding|margin|width|height/.test(lower)) return 'spacing';
  if (/font.?size|font.?weight|line.?height|letter.?spacing/.test(lower)) return 'typography';

  return 'float';
}

// ───────────────────────────────────────────────────────
// 컬렉션 맵 빌드
// ───────────────────────────────────────────────────────
function buildCollectionMap(
  collections: Record<string, FigmaCollection> | FigmaCollection[] | undefined,
): Map<string, FigmaCollection> {
  const map = new Map<string, FigmaCollection>();
  if (!collections) return map;

  if (Array.isArray(collections)) {
    for (const c of collections) map.set(c.id, c);
  } else {
    for (const [id, c] of Object.entries(collections)) map.set(id, c);
  }
  return map;
}

// ───────────────────────────────────────────────────────
// 메인 파서
// ───────────────────────────────────────────────────────
export function parseVariablesPayload(payload: PluginTokenPayload): NormalizedToken[] {
  const vars = payload.variables;
  if (!vars) return [];

  const rawVars: FigmaVariable[] = Array.isArray(vars.variables) ? vars.variables : [];
  const collectionMap = buildCollectionMap(vars.variableCollections);
  const result: NormalizedToken[] = [];

  for (const variable of rawVars) {
    const collection = variable.collectionId ? collectionMap.get(variable.collectionId) : undefined;
    const defaultModeId = collection?.defaultModeId ?? Object.keys(variable.valuesByMode)[0];
    const modeName = collection?.modes.find((m) => m.modeId === defaultModeId)?.name ?? null;
    const rawValue = variable.valuesByMode[defaultModeId];

    if (rawValue === undefined) continue;

    const base: Omit<NormalizedToken, 'type' | 'value' | 'raw'> = {
      name: variable.name,
      mode: modeName,
      collectionName: collection?.name ?? null,
      alias: isAlias(rawValue) ? rawValue.id : null,
    };

    // Alias — value는 빈 문자열로, alias 컬럼에 id 저장
    if (isAlias(rawValue)) {
      result.push({
        ...base,
        type: variable.resolvedType === 'COLOR' ? 'color' : inferFloatType(variable.name, variable.scopes),
        value: '',
        raw: rawValue.id,
      });
      continue;
    }

    switch (variable.resolvedType) {
      case 'COLOR': {
        if (!isColor(rawValue)) break;
        const hex = rgbaToHex(rawValue);
        result.push({ ...base, type: 'color', value: hex, raw: hex });
        break;
      }
      case 'FLOAT': {
        const floatVal = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
        const type = inferFloatType(variable.name, variable.scopes);
        result.push({ ...base, type, value: String(floatVal), raw: `${floatVal}px` });
        break;
      }
      case 'STRING': {
        const strVal = String(rawValue);
        result.push({ ...base, type: 'string', value: strVal, raw: strVal });
        break;
      }
      case 'BOOLEAN': {
        const boolVal = String(rawValue);
        result.push({ ...base, type: 'boolean', value: boolVal, raw: boolVal });
        break;
      }
    }
  }

  return result;
}
