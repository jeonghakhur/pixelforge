'use server';

import { db } from '@/lib/db';
import { projects, tokens, histories } from '@/lib/db/schema';
import { FigmaClient, extractFileKey } from '@/lib/figma/api';
import { extractTokens as extractFromNode } from '@/lib/tokens/extractor';
import type { ColorToken, TypographyToken, SpacingToken, RadiusToken } from '@/lib/tokens/extractor';
import { getFigmaToken } from '@/lib/config';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

interface ExtractResult {
  error: string | null;
  colors: number;
  typography: number;
  spacing: number;
  radii: number;
  projectId: string | null;
}

function generateId(): string {
  return crypto.randomUUID();
}

function serializeColorValue(token: ColorToken): string {
  return JSON.stringify({ hex: token.hex, rgba: token.rgba });
}

function serializeTypographyValue(token: TypographyToken): string {
  return JSON.stringify({
    fontFamily: token.fontFamily,
    fontSize: token.fontSize,
    fontWeight: token.fontWeight,
    lineHeight: token.lineHeight,
    letterSpacing: token.letterSpacing,
  });
}

function serializeSpacingValue(token: SpacingToken): string {
  return JSON.stringify({
    paddingTop: token.paddingTop,
    paddingRight: token.paddingRight,
    paddingBottom: token.paddingBottom,
    paddingLeft: token.paddingLeft,
    gap: token.gap,
  });
}

function serializeRadiusValue(token: RadiusToken): string {
  return JSON.stringify({ value: token.value, corners: token.corners });
}

export async function extractTokensAction(figmaUrl: string): Promise<ExtractResult> {
  const figmaToken = getFigmaToken();
  if (!figmaToken) {
    return { error: 'Figma API 토큰이 설정되지 않았습니다. 설정 페이지에서 토큰을 입력해주세요.', colors: 0, typography: 0, spacing: 0, radii: 0, projectId: null };
  }

  const fileKey = extractFileKey(figmaUrl);
  if (!fileKey) {
    return { error: '올바른 Figma URL이 아닙니다. figma.com/file/ 또는 figma.com/design/ 형식이어야 합니다.', colors: 0, typography: 0, spacing: 0, radii: 0, projectId: null };
  }

  try {
    const client = new FigmaClient(figmaToken);
    const file = await client.getFile(fileKey);

    const extracted = extractFromNode(file.document);

    // 기존 프로젝트 찾기 또는 생성
    const existing = db.select().from(projects).where(eq(projects.figmaKey, fileKey)).get();
    let projectId: string;

    if (existing) {
      projectId = existing.id;
      db.update(projects)
        .set({ updatedAt: new Date(), figmaUrl, name: file.name })
        .where(eq(projects.id, projectId))
        .run();

      // 기존 토큰 삭제 (새 버전으로 교체)
      db.delete(tokens).where(eq(tokens.projectId, projectId)).run();
    } else {
      projectId = generateId();
      db.insert(projects).values({
        id: projectId,
        name: file.name,
        figmaUrl,
        figmaKey: fileKey,
      }).run();
    }

    // 토큰 저장
    const version = existing ? (existing.updatedAt ? 2 : 1) : 1;

    for (const color of extracted.colors) {
      db.insert(tokens).values({
        id: generateId(),
        projectId,
        version,
        type: 'color',
        name: color.name,
        value: serializeColorValue(color),
        raw: color.hex,
      }).run();
    }

    for (const typo of extracted.typography) {
      db.insert(tokens).values({
        id: generateId(),
        projectId,
        version,
        type: 'typography',
        name: typo.name,
        value: serializeTypographyValue(typo),
        raw: `${typo.fontFamily} ${typo.fontSize}px`,
      }).run();
    }

    for (const sp of extracted.spacing) {
      db.insert(tokens).values({
        id: generateId(),
        projectId,
        version,
        type: 'spacing',
        name: sp.name,
        value: serializeSpacingValue(sp),
        raw: `${sp.paddingTop ?? 0}/${sp.paddingRight ?? 0}/${sp.paddingBottom ?? 0}/${sp.paddingLeft ?? 0} gap:${sp.gap ?? 0}`,
      }).run();
    }

    for (const rad of extracted.radius) {
      db.insert(tokens).values({
        id: generateId(),
        projectId,
        version,
        type: 'radius',
        name: rad.name,
        value: serializeRadiusValue(rad),
        raw: `${rad.value}px`,
      }).run();
    }

    // 히스토리 기록
    db.insert(histories).values({
      id: generateId(),
      projectId,
      action: 'extract_tokens',
      summary: `${file.name}에서 토큰 추출: 색상 ${extracted.colors.length}개, 타이포 ${extracted.typography.length}개, 간격 ${extracted.spacing.length}개, 반경 ${extracted.radius.length}개`,
      metadata: JSON.stringify({
        colors: extracted.colors.length,
        typography: extracted.typography.length,
        spacing: extracted.spacing.length,
        radius: extracted.radius.length,
      }),
    }).run();

    return {
      error: null,
      colors: extracted.colors.length,
      typography: extracted.typography.length,
      spacing: extracted.spacing.length,
      radii: extracted.radius.length,
      projectId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
    return { error: message, colors: 0, typography: 0, spacing: 0, radii: 0, projectId: null };
  }
}
