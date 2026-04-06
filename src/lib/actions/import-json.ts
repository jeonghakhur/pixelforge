'use server';

import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { parseVariablesPayload, type PluginTokenPayload } from '@/lib/sync/parse-variables';
import { runTokenPipeline } from '@/lib/tokens/pipeline';
import { setActiveProject } from '@/lib/actions/tokens';

// ===========================
// PixelForge JSON 파일 포맷 타입
// ===========================

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
      valuesByMode: Record<string, unknown>;
      collectionId: string;
      scopes?: string[];
    }>;
  };
  radius?: Array<{
    id: string;
    name: string;
    resolvedType: string;
    valuesByMode: Record<string, unknown>;
    collectionId: string;
    scopes?: string[];
  }>;
  spacing?: Array<{
    id: string;
    name: string;
    resolvedType: string;
    valuesByMode: Record<string, unknown>;
    collectionId: string;
    scopes?: string[];
  }>;
  styles?: {
    colors?: Array<{
      id: string;
      name: string;
      paints: Array<{ type: string; color?: { r: number; g: number; b: number; a?: number }; opacity?: number }>;
    }>;
    texts?: Array<{
      id: string;
      name: string;
      fontName: { family: string; style: string };
      fontSize: number;
      fontWeight: number;
      letterSpacing: { unit: string; value: number };
      lineHeight: { unit: string; value: number | string };
    }>;
    textStyles?: Array<{
      id: string;
      name: string;
      fontName: { family: string; style: string };
      fontSize: number;
      fontWeight: number;
      letterSpacing: { unit: string; value: number };
      lineHeight: { unit: string; value: number | string };
    }>;
    headings?: Array<{
      id: string;
      name: string;
      fontName: { family: string; style: string };
      fontSize: number;
      fontWeight: number;
      letterSpacing: { unit: string; value: number };
      lineHeight: { unit: string; value: number | string };
    }>;
    effects?: Array<{
      id: string;
      name: string;
      description?: string;
      effects: Array<{
        type: string;
        visible?: boolean;
        radius: number;
        color?: { r: number; g: number; b: number; a: number };
        offset?: { x: number; y: number };
        spread?: number;
        blendMode?: string;
      }>;
    }>;
    fonts?: Array<{
      family: string;
      cssVar: string;
      styles: string[];
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
// PixelForgeJson → PluginTokenPayload 형식 변환
// (parse-variables.ts의 단일 파서를 공유하기 위한 어댑터)
// ───────────────────────────────────────────────
function toPluginPayload(data: PixelForgeJson): PluginTokenPayload {
  return {
    variables: data.variables
      ? {
          // collections: defaultModeId 없음 → parse-variables에서 첫 모드를 기본으로 사용
          collections: data.variables.collections as PluginTokenPayload['variables'] extends infer V
            ? V extends { collections?: infer C } ? NonNullable<C> : never
            : never,
          variables: data.variables.variables as PluginTokenPayload['variables'] extends infer V
            ? V extends { variables?: infer Vs } ? NonNullable<Vs> : never
            : never,
        }
      : undefined,
    // radius / spacing 최상위 배열 — FigmaVariable과 구조 호환
    radius:  (data.radius  ?? []) as PluginTokenPayload['radius'],
    spacing: (data.spacing ?? []) as PluginTokenPayload['spacing'],
    styles: {
      colors:       data.styles?.colors,
      texts:        data.styles?.texts,
      textStyles:   data.styles?.textStyles,
      headings:     data.styles?.headings,
      effects:      data.styles?.effects,
      fontFamilies: data.styles?.fonts,
    },
  };
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

    // 2. PixelForgeJson → PluginTokenPayload 변환 후 공통 파서 실행
    const normalizedTokens = parseVariablesPayload(toPluginPayload(data));

    // 3. 공통 파이프라인 실행
    await runTokenPipeline(projectId, normalizedTokens, {
      source: 'variables',
      figmaKey: data.meta.figmaFileKey,
    });

    // 4. 임포트된 프로젝트를 활성 프로젝트로 설정 (대시보드에 즉시 반영)
    await setActiveProject(projectId);

    const colors    = normalizedTokens.filter((t) => t.type === 'color').length;
    const typography = normalizedTokens.filter((t) => t.type === 'typography').length;

    return { error: null, colors, typography, projectId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'JSON 임포트에 실패했습니다.';
    return { error: message, colors: 0, typography: 0, projectId: null };
  }
}
