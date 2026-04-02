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

// 플러그인이 보내는 스타일 포맷 (Variables 없을 때 폴백)
interface PluginStyleColor {
  id: string;
  name: string;
  paints: Array<{ type: string; color?: FigmaColor; opacity?: number }>;
}

interface PluginTextStyle {
  id: string;
  name: string;
  description?: string;
  fontName: { family: string; style: string };
  fontSize: number;
  fontWeight: number;
  letterSpacing: { unit: string; value: number };
  lineHeight: { unit: string; value: number };
  textCase?: string;
  textDecoration?: string;
  usageCount?: number;
}

interface PluginEffectItem {
  type: string;          // 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR'
  visible: boolean;
  radius: number;
  color?: FigmaColor;
  offset?: { x: number; y: number };
  spread?: number;
  blendMode?: string;
  showShadowBehindNode?: boolean;
  boundVariables?: Record<string, unknown>;
}

interface PluginEffectStyle {
  id: string;
  name: string;
  description?: string;
  effects: PluginEffectItem[];
  usageCount?: number;
}

export interface PluginTokenPayload {
  variables?: {
    // 플러그인은 variableCollections 또는 collections 키를 사용
    variableCollections?: Record<string, FigmaCollection> | FigmaCollection[];
    collections?: FigmaCollection[];
    variables?: FigmaVariable[];
  };
  // 플러그인이 타입별로 분류해서 보내는 Float 변수 배열
  spacing?: FigmaVariable[];
  radius?: FigmaVariable[];
  // 이펙트 스타일
  effects?: PluginEffectStyle[];
  // 플러그인 스타일 포맷 (Variables 없을 때 colors 폴백)
  styles?: {
    colors?: PluginStyleColor[];
    textStyles?: PluginTextStyle[];
    headings?: PluginTextStyle[];
    texts?: PluginTextStyle[];
    fonts?: PluginTextStyle[];
    effects?: PluginEffectStyle[];
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
  if (/resolution/.test(lower)) return 'resolution';
  if (/size/.test(lower)) return 'size';

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
// 타이포그래피 헬퍼
// ───────────────────────────────────────────────────────

function formatLineHeight(lh: { unit: string; value: number } | undefined): string {
  if (!lh) return 'normal';
  if (lh.unit === 'PIXELS') return `${lh.value}px`;
  if (lh.unit === 'PERCENT') return `${lh.value}%`;
  return 'normal'; // AUTO
}

function formatLetterSpacing(
  ls: { unit: string; value: number } | undefined,
): string {
  if (!ls || ls.value === 0) return '0';
  if (ls.unit === 'PIXELS') return `${ls.value}px`;
  // PERCENT: Figma uses % of font-size → convert to em (divide by 100)
  const em = Math.round((ls.value / 100) * 1000) / 1000;
  if (em === 0) return '0';
  return `${em}em`;
}

// ───────────────────────────────────────────────────────
// 메인 파서
// ───────────────────────────────────────────────────────
export function parseVariablesPayload(payload: PluginTokenPayload): NormalizedToken[] {
  const vars = payload.variables;

  // variables.variables[] + 타입별 배열(spacing, radius)을 합산
  const rawVars: FigmaVariable[] = [
    ...(Array.isArray(vars?.variables) ? vars.variables : []),
    ...(Array.isArray(payload.spacing) ? payload.spacing : []),
    ...(Array.isArray(payload.radius) ? payload.radius : []),
  ];

  // 중복 제거 (id 기준 — spacing/radius가 variables.variables와 겹칠 수 있음)
  const seen = new Set<string>();
  const uniqueVars = rawVars.filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });

  // variableCollections 또는 collections 키 모두 지원
  const collections = vars?.variableCollections ?? vars?.collections;
  const collectionMap = buildCollectionMap(collections);

  // ── 1차 패스: variableId → 실제값 맵 구축 (alias 해소용) ──
  const valueMap = new Map<string, { value: string; raw: string }>();
  for (const variable of uniqueVars) {
    const collection = variable.collectionId ? collectionMap.get(variable.collectionId) : undefined;
    const defaultModeId = collection?.defaultModeId ?? Object.keys(variable.valuesByMode)[0];
    const rawValue = variable.valuesByMode[defaultModeId];
    if (rawValue === undefined || isAlias(rawValue)) continue;

    switch (variable.resolvedType) {
      case 'COLOR': {
        if (!isColor(rawValue)) break;
        const hex = rgbaToHex(rawValue);
        valueMap.set(variable.id, { value: hex, raw: hex });
        break;
      }
      case 'FLOAT': {
        const floatVal = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
        valueMap.set(variable.id, { value: String(floatVal), raw: `${floatVal}px` });
        break;
      }
      case 'STRING': {
        const strVal = String(rawValue);
        valueMap.set(variable.id, { value: strVal, raw: strVal });
        break;
      }
      case 'BOOLEAN': {
        const boolVal = String(rawValue);
        valueMap.set(variable.id, { value: boolVal, raw: boolVal });
        break;
      }
    }
  }

  // ── 2차 패스: 토큰 생성 (alias는 valueMap에서 해소) ──
  const result: NormalizedToken[] = [];

  for (const variable of uniqueVars) {
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

    if (isAlias(rawValue)) {
      const resolved = valueMap.get(rawValue.id);
      const type = variable.resolvedType === 'COLOR' ? 'color' : inferFloatType(variable.name, variable.scopes);
      result.push({
        ...base,
        type,
        value: resolved?.value ?? '',
        raw: resolved?.raw ?? rawValue.id,
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

  // styles.textStyles / styles.headings / styles.texts / styles.fonts → typography
  const textStyleArrays = [
    ...(payload.styles?.textStyles ?? []),
    ...(payload.styles?.headings ?? []),
    ...(payload.styles?.texts ?? []),
    ...(payload.styles?.fonts ?? []),
  ];
  const seenTextIds = new Set<string>();
  for (const ts of textStyleArrays) {
    if (seenTextIds.has(ts.id)) continue;
    seenTextIds.add(ts.id);

    const lineHeight = formatLineHeight(ts.lineHeight);
    const letterSpacing = formatLetterSpacing(ts.letterSpacing);
    const raw = [
      `${ts.fontWeight} ${ts.fontSize}px/${lineHeight} '${ts.fontName.family}'`,
      letterSpacing !== '0' ? `ls:${letterSpacing}` : '',
    ].filter(Boolean).join(' ');

    result.push({
      type: 'typography',
      name: ts.name,
      value: JSON.stringify({
        fontFamily: ts.fontName.family,
        fontStyle: ts.fontName.style,
        fontSize: ts.fontSize,
        fontWeight: ts.fontWeight,
        lineHeight,
        letterSpacing,
      }),
      raw,
      mode: null,
      collectionName: null,
      alias: null,
    });
  }

  // effects / styles.effects → elevation
  const effectStyles: PluginEffectStyle[] = [
    ...(payload.effects ?? []),
    ...(payload.styles?.effects ?? []),
  ];
  const seenEffectIds = new Set<string>();
  for (const es of effectStyles) {
    if (seenEffectIds.has(es.id)) continue;
    seenEffectIds.add(es.id);

    const visibleEffects = es.effects.filter((e) => e.visible !== false);
    const shadows = visibleEffects
      .filter((e) => e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW')
      .map((e) => {
        const color = e.color
          ? rgbaToHex({ r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a })
          : 'transparent';
        const x = e.offset?.x ?? 0;
        const y = e.offset?.y ?? 0;
        const inset = e.type === 'INNER_SHADOW' ? 'inset ' : '';
        return `${inset}${x}px ${y}px ${e.radius}px ${e.spread ?? 0}px ${color}`;
      });

    const raw = shadows.length > 0 ? shadows.join(', ') : 'none';

    const effectType = /shadow/i.test(es.name) ? 'shadow' : 'elevation';

    result.push({
      type: effectType,
      name: es.name,
      value: JSON.stringify({
        effects: visibleEffects.map((e) => ({
          type: e.type,
          radius: e.radius,
          spread: e.spread ?? 0,
          color: e.color ?? null,
          offset: e.offset ?? { x: 0, y: 0 },
          blendMode: e.blendMode ?? 'NORMAL',
        })),
        cssBoxShadow: raw,
      }),
      raw,
      mode: null,
      collectionName: null,
      alias: null,
    });
  }

  // styles.colors 폴백 — variables에 색상이 없을 때
  const hasColors = result.some((t) => t.type === 'color');
  if (!hasColors && payload.styles?.colors) {
    for (const style of payload.styles.colors) {
      const paint = style.paints.find((p) => p.type === 'SOLID' && p.color);
      if (!paint?.color) continue;
      const hex = rgbaToHex({ ...paint.color, a: paint.opacity ?? 1 });
      result.push({
        type: 'color',
        name: style.name,
        value: hex,
        raw: hex,
        mode: null,
        collectionName: null,
        alias: null,
      });
    }
  }

  return result;
}
