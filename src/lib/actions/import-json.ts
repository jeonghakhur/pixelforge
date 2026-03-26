'use server';

import { db } from '@/lib/db';
import { projects, tokens, histories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// ===========================
// PixelForge JSON 포맷 타입
// ===========================
interface JsonColor { r: number; g: number; b: number; a?: number }
interface JsonVariableAlias { type: string; id: string }

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
    }>;
  };
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

function generateId(): string {
  return crypto.randomUUID();
}

function toHex(v: number): string {
  return Math.round(v * 255).toString(16).padStart(2, '0');
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function isAlias(v: JsonColor | JsonVariableAlias): v is JsonVariableAlias {
  return 'type' in v;
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

    // ── 1. json-import 프로젝트 찾기 또는 생성
    const existing = db.select().from(projects).where(eq(projects.figmaKey, JSON_PROJECT_KEY)).get();
    let projectId: string;

    if (existing) {
      projectId = existing.id;
      db.update(projects)
        .set({ name: fileName, updatedAt: new Date() })
        .where(eq(projects.id, projectId))
        .run();
    } else {
      projectId = generateId();
      db.insert(projects).values({
        id: projectId,
        name: fileName,
        figmaKey: JSON_PROJECT_KEY,
        figmaUrl: null,
      }).run();
    }

    type TokenRow = {
      id: string; projectId: string; version: number; type: string;
      name: string; value: string; raw: string;
      source: 'variables' | 'styles-api';
      mode: string | null; collectionName: string | null; alias: string | null;
    };

    const colorTokens: TokenRow[] = [];
    const typoTokens: TokenRow[] = [];

    // ── 2. variables → color 토큰 (VARIABLE_ALIAS 제외)
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
        if (variable.resolvedType !== 'COLOR') continue;
        if (!collectionMap.has(variable.collectionId)) continue;

        for (const [modeId, rawValue] of Object.entries(variable.valuesByMode)) {
          if (isAlias(rawValue)) continue; // VARIABLE_ALIAS 건너뜀

          const { r, g, b, a } = rawValue as JsonColor;
          const hex = rgbToHex(r, g, b);
          const rgba = { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: a ?? 1 };
          const modeInfo = modeMap.get(modeId);

          colorTokens.push({
            id: generateId(), projectId, version: 1, type: 'color',
            name: variable.name,
            value: JSON.stringify({ hex, rgba }),
            raw: hex,
            source: 'variables',
            mode: modeInfo?.modeName ?? null,
            collectionName: modeInfo?.collectionName ?? null,
            alias: null,
          });
        }
      }
    }

    // variables에서 색상을 못 얻었으면 styles.colors로 폴백
    if (colorTokens.length === 0 && data.styles?.colors) {
      for (const style of data.styles.colors) {
        const paint = style.paints.find((p) => p.type === 'SOLID' && p.color);
        if (!paint?.color) continue;

        const { r, g, b } = paint.color;
        const hex = rgbToHex(r, g, b);
        const rgba = { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: paint.opacity ?? 1 };

        colorTokens.push({
          id: generateId(), projectId, version: 1, type: 'color',
          name: style.name,
          value: JSON.stringify({ hex, rgba }),
          raw: hex,
          source: 'styles-api',
          mode: null, collectionName: null, alias: null,
        });
      }
    }

    // ── 3. styles.texts → typography 토큰
    if (data.styles?.texts) {
      for (const text of data.styles.texts) {
        const fontFamily = text.fontName?.family ?? '';
        const fontSize = text.fontSize ?? 0;
        const fontWeight = text.fontWeight ?? 400;
        const lineHeight = text.lineHeight?.value ?? undefined;
        const letterSpacing = text.letterSpacing?.value ?? undefined;

        typoTokens.push({
          id: generateId(), projectId, version: 1, type: 'typography',
          name: text.name,
          value: JSON.stringify({ fontFamily, fontSize, fontWeight, lineHeight, letterSpacing }),
          raw: `${fontFamily} ${fontSize}px`,
          source: 'styles-api',
          mode: null, collectionName: null, alias: null,
        });
      }
    }

    // ── 4. 기존 토큰 삭제 후 삽입
    db.delete(tokens).where(eq(tokens.projectId, projectId)).run();

    for (const token of [...colorTokens, ...typoTokens]) {
      db.insert(tokens).values(token).run();
    }

    // ── 5. 히스토리 기록
    db.insert(histories).values({
      id: generateId(),
      projectId,
      action: 'extract_tokens',
      summary: `JSON 임포트: 색상 ${colorTokens.length}개, 타이포그래피 ${typoTokens.length}개`,
      metadata: JSON.stringify({ source: 'json-import', fileName }),
    }).run();

    return { error: null, colors: colorTokens.length, typography: typoTokens.length, projectId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'JSON 임포트에 실패했습니다.';
    return { error: message, colors: 0, typography: 0, projectId: null };
  }
}
