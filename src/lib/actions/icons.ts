'use server';

import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { db } from '@/lib/db';
import { syncPayloads } from '@/lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { getActiveProjectId } from '@/lib/db/active-project';
import { getIconOutputPath } from '@/lib/actions/settings';
import { removeIconFile, rebuildBarrelFromDisk } from '@/lib/icons/generate';
import type { IconEntry } from '@/app/(main)/(ide)/icons/IconGrid';

export async function deleteAllIcons(): Promise<{ error: string | null }> {
  const projectId = getActiveProjectId();
  if (!projectId) return { error: '활성 프로젝트가 없습니다.' };

  db.delete(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), eq(syncPayloads.type, 'icons')))
    .run();

  const outputPath = await getIconOutputPath();
  const absPath = path.resolve(process.cwd(), outputPath);
  try {
    if (fs.existsSync(absPath)) {
      // Icon* 폴더만 삭제 — index.ts(barrel)는 빈 채로 유지해야 import가 깨지지 않음
      for (const entry of fs.readdirSync(absPath)) {
        if (entry.startsWith('Icon')) {
          fs.rmSync(path.join(absPath, entry), { recursive: true, force: true });
        }
      }
    } else {
      fs.mkdirSync(absPath, { recursive: true });
    }
    fs.writeFileSync(
      path.join(absPath, 'index.ts'),
      '// Auto-generated — do not edit manually\nexport {};\n',
      'utf-8',
    );
  } catch {
    // 파일 삭제 실패는 non-blocking
  }

  return { error: null };
}

export async function deleteIcon(figmaName: string, componentName: string): Promise<{ error: string | null }> {
  const projectId = getActiveProjectId();
  if (!projectId) return { error: '활성 프로젝트가 없습니다.' };

  const payload = db.select({ data: syncPayloads.data, version: syncPayloads.version })
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), eq(syncPayloads.type, 'icons')))
    .orderBy(desc(syncPayloads.version))
    .limit(1)
    .get();

  if (!payload) return { error: '아이콘 데이터가 없습니다.' };

  let icons: IconEntry[] = [];
  try {
    icons = JSON.parse(payload.data) as IconEntry[];
  } catch {
    return { error: '아이콘 데이터 파싱 실패' };
  }

  const filtered = icons.filter((icon) => icon.name !== figmaName);
  if (filtered.length === icons.length) return { error: '해당 아이콘을 찾을 수 없습니다.' };

  const newHash = crypto.createHash('sha256').update(JSON.stringify(filtered)).digest('hex');
  db.insert(syncPayloads).values({
    id: crypto.randomUUID(),
    projectId,
    type: 'icons',
    version: payload.version + 1,
    contentHash: newHash,
    data: JSON.stringify(filtered),
  }).run();

  const outputPath = await getIconOutputPath();
  const absPath = path.resolve(process.cwd(), outputPath);
  removeIconFile(componentName, absPath);
  rebuildBarrelFromDisk(absPath);

  return { error: null };
}
