'use server';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { syncPayloads } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getActiveProjectId } from '@/lib/db/active-project';

interface ImageMeta {
  name: string;
  fileName: string;
  mimeType: string;
  scale?: number;
  url: string;
  filePath: string;
}

export async function deleteImageAction(fileName: string): Promise<{ error: string | null }> {
  const projectId = getActiveProjectId();
  if (!projectId) return { error: '활성 프로젝트가 없습니다.' };

  // ── DB 메타데이터에서 파일 경로 조회 ─────────────────────────────
  const payload = db
    .select({ id: syncPayloads.id, data: syncPayloads.data, version: syncPayloads.version })
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), eq(syncPayloads.type, 'images')))
    .orderBy(desc(syncPayloads.version))
    .limit(1)
    .get();

  if (!payload) return { error: '이미지 데이터가 없습니다.' };

  let images: ImageMeta[] = [];
  try {
    images = JSON.parse(payload.data) as ImageMeta[];
  } catch {
    return { error: '메타데이터 파싱 실패' };
  }

  const target = images.find((img) => img.fileName === fileName);

  // ── 파일 시스템에서 삭제 ──────────────────────────────────────────
  let absPath: string | null = null;

  if (target?.filePath) {
    // 신형 포맷: DB에 filePath 있음
    absPath = path.join(process.cwd(), 'public', target.filePath.replace(/^public\//, ''));
  } else {
    // 구형 포맷: filePath 없음 → storagePath/{projectId}/{fileName} 으로 추정
    const { getImageStoragePath } = await import('@/lib/actions/settings');
    const storagePath = await getImageStoragePath();
    const candidate = path.join(process.cwd(), storagePath, projectId, fileName);
    if (fs.existsSync(candidate)) absPath = candidate;
  }

  if (absPath) {
    try {
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    } catch {
      return { error: '파일 삭제 실패' };
    }
  }

  // 구형 포맷에서 target이 없으면 DB 업데이트 없이 파일만 삭제하고 종료
  if (!target) return { error: null };

  // ── DB 메타데이터 업데이트 (해당 항목 제거, contentHash도 갱신) ────
  const updated = images.filter((img) => img.fileName !== fileName);
  const updatedData = JSON.stringify(updated);
  const updatedHash = crypto.createHash('sha256').update(updatedData).digest('hex');
  db.update(syncPayloads)
    .set({ data: updatedData, contentHash: updatedHash })
    .where(eq(syncPayloads.id, payload.id))
    .run();

  return { error: null };
}

export async function deleteAllImagesAction(): Promise<{ error: string | null; deleted: number }> {
  const projectId = getActiveProjectId();
  if (!projectId) return { error: '활성 프로젝트가 없습니다.', deleted: 0 };

  const payload = db
    .select({ id: syncPayloads.id, data: syncPayloads.data })
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), eq(syncPayloads.type, 'images')))
    .orderBy(desc(syncPayloads.version))
    .limit(1)
    .get();

  let images: ImageMeta[] = [];
  if (payload) {
    try {
      const parsed = JSON.parse(payload.data) as ImageMeta[];
      if (parsed.length > 0 && 'url' in (parsed[0] as object)) {
        images = parsed;
      }
    } catch { /* 무시 */ }
  }

  // ── 파일 시스템에서 전체 삭제 + 빈 디렉토리 제거 ────────────────
  let deleted = 0;
  const dirs = new Set<string>();

  for (const img of images) {
    if (!img.filePath) continue;
    const absPath = path.join(process.cwd(), 'public', img.filePath.replace(/^public\//, ''));
    try {
      if (fs.existsSync(absPath)) {
        fs.unlinkSync(absPath);
        deleted++;
        dirs.add(path.dirname(absPath));
      }
    } catch { /* 개별 실패 무시 */ }
  }

  // 파일 삭제 후 빈 디렉토리 제거
  for (const dir of dirs) {
    try {
      const remaining = fs.readdirSync(dir);
      if (remaining.length === 0) fs.rmdirSync(dir);
    } catch { /* 무시 */ }
  }

  // ── DB 메타데이터 초기화 (contentHash도 갱신해야 재전송 시 hash 충돌 방지) ──
  if (payload) {
    const emptyData = JSON.stringify([]);
    const emptyHash = crypto.createHash('sha256').update(emptyData).digest('hex');
    db.update(syncPayloads)
      .set({ data: emptyData, contentHash: emptyHash })
      .where(eq(syncPayloads.id, payload.id))
      .run();
  }

  return { error: null, deleted };
}
