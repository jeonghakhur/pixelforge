'use server';

import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import type { NormalizedToken } from '@/lib/sync/parse-variables';
import { runTokenPipeline } from '@/lib/tokens/pipeline';

// ===========================
// PixelForge JSON 포맷 타입
// ===========================
interface JsonColor { r: number; g: number; b: number; a?: number }
interface JsonVariableAlias { type: string; id: string }

// 최상위 배열 토큰 항목 (radius, spacing 등 플러그인 직접 출력)
interface TopLevelTokenItem {
  id: string;
  name: string;
  resolvedType: string;
  valuesByMode: Record<string, number>;
  collectionId: string;
  usageCount?: number;
}

export interface PixelForgeJson {
  variables?: {
    collections: Array<{
      id: string;
      name: string;
      modes: Array<{ modeId: string; name: string }>;
      variableIds: string[];
    }>;
    variables: Array<{
      id: string;
      name: string;
      resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
      valuesByMode: Record<string, JsonColor | JsonVariableAlias>;
      collectionId: string;
      scopes?: string[];
    }>;
  };
  // 플러그인이 최상위에 직접 배출하는 타입별 배열
  radius?: TopLevelTokenItem[];
  spacing?: TopLevelTokenItem[];
  styles?: {
    colors: Array<{
      id: string;
      name: string;
      paints: Array<{
        type: string;
        color?: JsonColor;
        opacity?: number;
      }>;
    }>;
    texts: Array<{
      id: string;
      name: string;
      fontName: { family: string; style: string };
      fontSize: number;
      fontWeight: number;
      letterSpacing: { unit: string; value: number };
      lineHeight: { unit: string; value: number };
    }>;
  };
  meta: {
    figmaFileKey: string;
    fileName: string;
    extractedAt?: string;
    sourceMode?: string;
    totalNodes?: number;
  };
}

export interface ImportJsonResult {
  error: string | null;
  colors: number;
  typography: number;
  projectId: string | null;
}

// JSON 임포트 전용 프로젝트 식별 키
const JSON_PROJECT_KEY = 'json-import';

// ───────────────────────────────────────────────
// 파서 유틸리티
// ───────────────────────────────────────────────

function toHex(v: number): string {
  return Math.round(v * 255).toString(16).padStart(2, '0');
}

function rgbToHex(r: number, g: number, b: number, a?: number): string {
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a !== undefined && a < 1) {
    return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${Math.round(a * 100) / 100})`;
  }
  return hex;
}

function isAlias(v: JsonColor | JsonVariableAlias): v is JsonVariableAlias {
  return 'type' in v && (v as JsonVariableAlias).type === 'VARIABLE_ALIAS';
}

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

// ───────────────────────────────────────────────
// JSON → NormalizedToken[] 변환
// ───────────────────────────────────────────────

function parseJsonToNormalizedTokens(data: PixelForgeJson): NormalizedToken[] {
  const result: NormalizedToken[] = [];

  if (data.variables) {
    const collectionMap = new Map(data.variables.collections.map((c) => [c.id, c]));

    // modeId → { modeName, collectionName }
    const modeMap = new Map<string, { modeName: string; collectionName: string }>();
    for (const col of data.variables.collections) {
      for (const mode of col.modes) {
        modeMap.set(mode.modeId, { modeName: mode.name, collectionName: col.name });
      }
    }

    for (const variable of data.variables.variables) {
      const collection = collectionMap.get(variable.collectionId);
      // defaultModeId 없으면 첫 번째 mode 사용
      const defaultModeId = collection?.modes[0]?.modeId ?? Object.keys(variable.valuesByMode)[0];
      if (!defaultModeId) continue;

      const rawValue = variable.valuesByMode[defaultModeId];
      if (rawValue === undefined) continue;

      const modeInfo = modeMap.get(defaultModeId);

      const base: Omit<NormalizedToken, 'type' | 'value' | 'raw'> = {
        name: variable.name,
        mode: modeInfo?.modeName ?? null,
        collectionName: modeInfo?.collectionName ?? null,
        alias: isAlias(rawValue) ? rawValue.id : null,
      };

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
          const c = rawValue as JsonColor;
          const hex = rgbToHex(c.r, c.g, c.b, c.a);
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
  }

  // variables에서 색상을 못 얻었으면 styles.colors로 폴백
  const hasColors = result.some((t) => t.type === 'color');
  if (!hasColors && data.styles?.colors) {
    for (const style of data.styles.colors) {
      const paint = style.paints.find((p) => p.type === 'SOLID' && p.color);
      if (!paint?.color) continue;
      const { r, g, b } = paint.color;
      const hex = rgbToHex(r, g, b, paint.opacity);
      result.push({ type: 'color', name: style.name, value: hex, raw: hex, mode: null, collectionName: null, alias: null });
    }
  }

  // styles.texts → typography 토큰
  if (data.styles?.texts) {
    for (const text of data.styles.texts) {
      const fontFamily = text.fontName?.family ?? '';
      const fontSize = text.fontSize ?? 0;
      result.push({
        type: 'typography',
        name: text.name,
        value: `${fontFamily} ${fontSize}px`,
        raw: `${fontFamily} ${fontSize}px`,
        mode: null,
        collectionName: null,
        alias: null,
      });
    }
  }

  // ── 최상위 배열 토큰 파싱 (radius, spacing)
  const TOP_LEVEL_TYPES: Array<{ key: keyof PixelForgeJson; type: string }> = [
    { key: 'radius', type: 'radius' },
    { key: 'spacing', type: 'spacing' },
  ];

  for (const { key, type } of TOP_LEVEL_TYPES) {
    const arr = data[key] as TopLevelTokenItem[] | undefined;
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const modeId = Object.keys(item.valuesByMode)[0];
      if (modeId === undefined) continue;
      const val = item.valuesByMode[modeId];
      if (typeof val !== 'number') continue;
      result.push({
        type,
        name: item.name,
        value: String(val),
        raw: `${val}px`,
        mode: null,
        collectionName: null,
        alias: null,
      });
    }
  }

  return result;
}

// ===========================
// 메인 액션
// ===========================
export async function importFromJsonAction(data: PixelForgeJson): Promise<ImportJsonResult> {
  try {
    if (!data.meta) {
      return { error: '올바른 PixelForge JSON 파일이 아닙니다.', colors: 0, typography: 0, projectId: null };
    }

    const fileName = data.meta.fileName || 'JSON Import';

    // 1. json-import 프로젝트 찾기 또는 생성
    const existing = db.select().from(projects).where(eq(projects.figmaKey, JSON_PROJECT_KEY)).get();
    let projectId: string;

    if (existing) {
      projectId = existing.id;
      await db.update(projects)
        .set({ name: fileName, updatedAt: new Date() })
        .where(eq(projects.id, projectId));
    } else {
      projectId = crypto.randomUUID();
      await db.insert(projects).values({
        id: projectId,
        name: fileName,
        figmaKey: JSON_PROJECT_KEY,
        figmaUrl: null,
      });
    }

    // 2. JSON → NormalizedToken[] 변환
    const normalizedTokens = parseJsonToNormalizedTokens(data);

    // 3. 공통 파이프라인 실행
    await runTokenPipeline(projectId, normalizedTokens, {
      source: 'variables',
      figmaKey: data.meta.figmaFileKey,
    });

    const colors = normalizedTokens.filter((t) => t.type === 'color').length;
    const typography = normalizedTokens.filter((t) => t.type === 'typography').length;

    return { error: null, colors, typography, projectId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'JSON 임포트에 실패했습니다.';
    return { error: message, colors: 0, typography: 0, projectId: null };
  }
}
