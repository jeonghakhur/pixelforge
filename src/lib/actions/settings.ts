'use server';

import { getFigmaToken, setFigmaToken } from '@/lib/config';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { extractFileKey } from '@/lib/figma/api';
import { eq } from 'drizzle-orm';

interface SaveTokenResult {
  error: string | null;
  success: boolean;
}

export async function saveFigmaToken(token: string): Promise<SaveTokenResult> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { error: 'API 토큰을 입력해주세요.', success: false };
  }

  if (trimmed.length < 10) {
    return { error: '올바른 Figma API 토큰이 아닌 것 같습니다.', success: false };
  }

  try {
    setFigmaToken(trimmed);
    return { error: null, success: true };
  } catch {
    return { error: '토큰 저장 중 오류가 발생했습니다.', success: false };
  }
}

export async function saveProjectFigmaUrl(url: string): Promise<{ error: string | null }> {
  const trimmed = url.trim();
  if (!trimmed.includes('figma.com')) {
    return { error: '올바른 Figma 파일 URL이 아닙니다.' };
  }

  const fileKey = extractFileKey(trimmed);
  if (!fileKey) {
    return { error: 'Figma 파일 키를 찾을 수 없습니다. URL을 확인해주세요.' };
  }

  const project = db.select({ id: projects.id }).from(projects).limit(1).get();
  if (!project) {
    return { error: '프로젝트가 없습니다. 먼저 토큰을 한 번 추출해주세요.' };
  }

  db.update(projects)
    .set({ figmaUrl: trimmed, figmaKey: fileKey, updatedAt: new Date() })
    .where(eq(projects.id, project.id))
    .run();

  return { error: null };
}

export async function getProjectFigmaUrl(): Promise<{ url: string | null; fileKey: string | null }> {
  const project = db.select({ figmaUrl: projects.figmaUrl, figmaKey: projects.figmaKey })
    .from(projects).limit(1).get();
  return { url: project?.figmaUrl ?? null, fileKey: project?.figmaKey ?? null };
}

export async function checkFigmaToken(): Promise<{ hasToken: boolean; maskedToken: string | null }> {
  const token = getFigmaToken();
  if (!token) return { hasToken: false, maskedToken: null };

  const masked = token.slice(0, 6) + '...' + token.slice(-4);
  return { hasToken: true, maskedToken: masked };
}
