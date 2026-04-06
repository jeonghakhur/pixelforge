/**
 * Plugin payload / JSON 파일 → NormalizedToken[]
 *
 * 플러그인(POST /api/sync/tokens)과 JSON 파일 임포트 모두 이 파서를 사용한다.
 * import-json.ts는 PixelForgeJson → PluginTokenPayload 형식 변환 후 이 함수를 호출한다.
 */

export interface NormalizedToken {
  type: string;         // 'color' | 'spacing' | 'radius' | 'typography' | 'text-style' | 'heading' | 'shadow' | 'blur' | 'font' | ...
  name: string;         // 'Color/Brand/Primary'
  value: string;        // '#0066ff' or '16' or 'var(--color-neutral-900)'
  raw: string | null;   // 원본 값 문자열
  mode: string | null;  // 'Light' | 'Dark' | null
  collectionName: string | null;
  alias: string | null; // alias 참조 시 원본 variable id
  sortOrder: number;    // Figma Variables 배열 원본 인덱스 (정렬용)
}

import { toVarName } from '@/lib/tokens/css-generator';

// ───────────────────────────────────────────────────────
// Figma Variables API 응답 타입 (플러그인 전송 포맷)
// ───────────────────────────────────────────────────────
interface FigmaColor { r: number; g: number; b: number; a?: number }
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
  defaultModeId?: string; // 플러그인은 제공, JSON 파일은 없을 수 있음
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
  lineHeight: { unit: string; value: number | string };
  textCase?: string;
  textDecoration?: string;
  usageCount?: number;
}

interface PluginEffectItem {
  type: string;          // 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR'
  visible?: boolean;
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

/** PixelForge JSON 파일의 fonts 배열 포맷 */
interface PluginFontFamily {
  family: string;
  cssVar: string;
  styles: string[];
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
  // 이펙트 스타일 (최상위)
  effects?: PluginEffectStyle[];
  // 플러그인 스타일 포맷
  styles?: {
    colors?: PluginStyleColor[];
    textStyles?: PluginTextStyle[];
    headings?: PluginTextStyle[];
    texts?: PluginTextStyle[];
    effects?: PluginEffectStyle[];
    /** PixelForge JSON 파일의 fonts 배열 (font family 정보) */
    fontFamilies?: PluginFontFamily[];
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
  const alpha = c.a ?? 1;
  if (alpha < 1) {
    return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${Math.round(alpha * 100) / 100})`;
  }
  return hex;
}

function isColor(v: FigmaValue): v is FigmaColor {
  return typeof v === 'object' && v !== null && 'r' in v && !('type' in v);
}

function isAlias(v: FigmaValue): v is FigmaAlias {
  return typeof v === 'object' && v !== null && (v as FigmaAlias).type === 'VARIABLE_ALIAS';
}

/** CSS 변수 이름 생성 (css-generator.ts의 toVarName과 동일 로직) */
/** alias ID → CSS var() 참조 변환 */
function resolveAliasToVar(
  aliasId: string,
  varById: Map<string, { name: string; resolvedType: string; scopes?: string[] }>,
): string {
  const target = varById.get(aliasId);
  if (!target) return '';
  // COLOR는 prefix 없음(toVarName의 빈 prefix 경로 사용), FLOAT 등은 타입 추론
  const prefix = target.resolvedType === 'COLOR' ? '' : inferFloatType(target.name, target.scopes ?? []);
  return `var(${toVarName(target.name, prefix)})`;
}

/**
 * spacing 이름 패턴이지만 이 값 이상이면 layout-spacing으로 분류한다.
 * (컴포넌트 패딩/갭 vs 레이아웃 너비·섹션 높이 경계)
 * Figma 파일에서 scopes가 설정되지 않을 때 값으로 구분하는 폴백 전략.
 */
const LAYOUT_SPACING_THRESHOLD_PX = 256;

/** FLOAT variable을 scopes + 이름 패턴 + 값으로 타입 분류 */
function inferFloatType(name: string, scopes: string[] = [], value?: number): string {
  if (scopes.includes('CORNER_RADIUS')) return 'radius';
  if (scopes.includes('GAP') || scopes.includes('WIDTH_HEIGHT')) return 'spacing';
  if (scopes.includes('FONT_SIZE') || scopes.includes('LINE_HEIGHT') || scopes.includes('LETTER_SPACING')) return 'typography';

  const lower = name.toLowerCase();
  if (/radius|corner|rounded/.test(lower)) return 'radius';
  // container/width는 spacing 보다 먼저 매칭 (width 키워드 충돌 방지)
  if (/^container/.test(lower) || /paragraph.?max.?width/.test(lower)) return 'container';
  if (/^width-/.test(lower)) return 'width';
  // typography 체크를 spacing보다 먼저 — "line height/..."이 height 키워드에 걸리지 않도록
  if (/font.?size|font.?weight|line.?height|letter.?spacing/.test(lower)) return 'typography';
  if (/spacing|gap|padding|margin|width|height/.test(lower)) {
    // 값이 임계값 초과면 레이아웃 스케일 spacing으로 분리
    if (value !== undefined && value > LAYOUT_SPACING_THRESHOLD_PX) return 'layout-spacing';
    return 'spacing';
  }
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

function formatLineHeight(lh: { unit: string; value: number | string } | undefined): string {
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
// 메인 파서 (플러그인 sync + JSON 임포트 공통)
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

  // variableId → 메타 맵 (alias → CSS var() 변환용)
  const varById = new Map(
    uniqueVars.map((v) => [v.id, { name: v.name, resolvedType: v.resolvedType, scopes: v.scopes }]),
  );

  const result: NormalizedToken[] = [];

  // 모든 모드를 순회하여 모드별 별도 토큰 생성 (다크/라이트 CSS 분리 지원)
  for (let varIdx = 0; varIdx < uniqueVars.length; varIdx++) {
    const variable = uniqueVars[varIdx];
    const collection = variable.collectionId ? collectionMap.get(variable.collectionId) : undefined;
    const modes = collection?.modes ?? [];
    const modeEntries = modes.length > 0
      ? modes.map((m) => ({ modeId: m.modeId, modeName: m.name }))
      : Object.keys(variable.valuesByMode).map((modeId) => ({ modeId, modeName: null }));

    for (const { modeId, modeName } of modeEntries) {
      const rawValue = variable.valuesByMode[modeId];
      if (rawValue === undefined) continue;

      const base: Omit<NormalizedToken, 'type' | 'value' | 'raw'> = {
        name: variable.name,
        mode: modeName,
        collectionName: collection?.name ?? null,
        alias: isAlias(rawValue) ? (rawValue as FigmaAlias).id : null,
        sortOrder: varIdx,
      };

      if (isAlias(rawValue)) {
        // alias → CSS var() 참조로 변환
        const aliasId = (rawValue as FigmaAlias).id;
        const cssVar = resolveAliasToVar(aliasId, varById);
        let type: string;
        if (variable.resolvedType === 'COLOR') {
          type = 'color';
        } else {
          // alias target의 실제 값을 조회해 임계값 분류에 사용
          const targetVar = uniqueVars.find((v) => v.id === aliasId);
          const targetVal = targetVar
            ? (() => { const v = Object.values(targetVar.valuesByMode)[0]; return typeof v === 'number' ? v : undefined; })()
            : undefined;
          type = inferFloatType(variable.name, variable.scopes, targetVal);
        }
        result.push({ ...base, type, value: cssVar, raw: cssVar || aliasId });
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
          const type = inferFloatType(variable.name, variable.scopes, floatVal);
          result.push({ ...base, type, value: String(floatVal), raw: `${floatVal}px` });
          break;
        }
        case 'STRING': {
          const strVal = String(rawValue);
          const lower = variable.name.toLowerCase();
          const strType = /font.?(family|size|weight)|line.?height|letter.?spacing/.test(lower)
            ? 'typography'
            : 'string';
          result.push({ ...base, type: strType, value: strVal, raw: strVal });
          break;
        }
        case 'BOOLEAN': {
          const boolVal = String(rawValue);
          result.push({ ...base, type: 'boolean', value: boolVal, raw: boolVal });
          break;
        }
      }
    }
  }

  // styles 섹션의 sortOrder 기준점 (variables 다음 순서)
  let styleOrder = uniqueVars.length;

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
        sortOrder: styleOrder++,
      });
    }
  }

  // 텍스트 스타일 — 각 배열을 별도 타입으로 저장
  const textStyleGroups: Array<{ items: PluginTextStyle[]; type: string }> = [
    { items: payload.styles?.textStyles ?? [], type: 'text-style' },
    { items: payload.styles?.headings   ?? [], type: 'heading'    },
    { items: payload.styles?.texts      ?? [], type: 'typography' },
  ];
  const seenTextIds = new Set<string>();

  for (const { items, type } of textStyleGroups) {
    for (const ts of items) {
      if (seenTextIds.has(ts.id)) continue;
      seenTextIds.add(ts.id);

      const lineHeight = formatLineHeight(ts.lineHeight);
      const letterSpacing = formatLetterSpacing(ts.letterSpacing);
      const raw = [
        `${ts.fontWeight} ${ts.fontSize}px/${lineHeight} '${ts.fontName.family}'`,
        letterSpacing !== '0' ? `ls:${letterSpacing}` : '',
      ].filter(Boolean).join(' ');

      result.push({
        type,
        name: ts.name,
        value: JSON.stringify({
          fontFamily: ts.fontName.family,
          fontStyle:  ts.fontName.style,
          fontSize:   ts.fontSize,
          fontWeight: ts.fontWeight,
          lineHeight,
          letterSpacing,
        }),
        raw,
        mode: null,
        collectionName: null,
        alias: null,
        sortOrder: styleOrder++,
      });
    }
  }

  // 이펙트 스타일 → shadow / blur
  const effectStyles: PluginEffectStyle[] = [
    ...(payload.effects        ?? []),
    ...(payload.styles?.effects ?? []),
  ];
  const seenEffectIds = new Set<string>();

  for (const es of effectStyles) {
    if (seenEffectIds.has(es.id)) continue;
    seenEffectIds.add(es.id);

    const visibleEffects = es.effects.filter((e) => e.visible !== false);

    // BACKGROUND_BLUR → blur 타입 (color 없음)
    const blurLayers = visibleEffects.filter((e) => e.type === 'BACKGROUND_BLUR');
    if (blurLayers.length > 0) {
      result.push({
        type: 'blur',
        name: es.name,
        value: String(blurLayers[0].radius),
        raw: `blur(${blurLayers[0].radius}px)`,
        mode: null,
        collectionName: null,
        alias: null,
        sortOrder: styleOrder++,
      });
      continue;
    }

    // DROP_SHADOW / INNER_SHADOW → shadow 타입
    const shadowLayers = visibleEffects.filter(
      (e) => (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') && e.color != null,
    );
    if (shadowLayers.length === 0) continue;

    const cssBoxShadow = shadowLayers.map((e) => {
      const color = e.color
        ? rgbaToHex({ r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a })
        : 'transparent';
      const x = e.offset?.x ?? 0;
      const y = e.offset?.y ?? 0;
      const inset = e.type === 'INNER_SHADOW' ? 'inset ' : '';
      return `${inset}${x}px ${y}px ${e.radius}px ${e.spread ?? 0}px ${color}`;
    }).join(', ');

    result.push({
      type: 'shadow',
      name: es.name,
      value: JSON.stringify(shadowLayers.map((e) => ({
        type:    e.type,
        offsetX: e.offset?.x ?? 0,
        offsetY: e.offset?.y ?? 0,
        radius:  e.radius,
        spread:  e.spread ?? 0,
        color:   e.color ?? null,
      }))),
      raw: cssBoxShadow,
      mode: null,
      collectionName: null,
      alias: null,
      sortOrder: styleOrder++,
    });
  }

  // font families (PixelForge JSON 파일 포맷)
  for (const f of payload.styles?.fontFamilies ?? []) {
    result.push({
      type: 'font',
      name: f.family,
      value: JSON.stringify({ family: f.family, cssVar: f.cssVar, styles: f.styles }),
      raw: f.family,
      mode: null,
      collectionName: null,
      alias: null,
      sortOrder: styleOrder++,
    });
  }

  return result;
}
