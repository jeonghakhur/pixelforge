'use server';

import { db } from '@/lib/db';
import { projects, syncPayloads, tokenSnapshots } from '@/lib/db/schema';
import { eq, isNotNull, desc, and } from 'drizzle-orm';

const SYNC_TYPES = ['icons', 'images', 'themes', 'components'] as const;
type SyncType = (typeof SYNC_TYPES)[number];

export interface SyncItem {
  type: 'tokens' | SyncType;
  version: number;
  syncedAt: Date;
  count?: number;
}

export interface SyncProjectStatus {
  id: string;
  name: string;
  figmaKey: string;
  syncs: SyncItem[];
}

export async function getSyncStatus(): Promise<SyncProjectStatus[]> {
  const pluginProjects = await db
    .select({ id: projects.id, name: projects.name, figmaKey: projects.figmaKey })
    .from(projects)
    .where(isNotNull(projects.figmaKey))
    .all();

  const result = await Promise.all(
    pluginProjects.map(async (p) => {
      const syncs: SyncItem[] = [];

      // 토큰 스냅샷 최신 버전
      const latestToken = await db
        .select({ version: tokenSnapshots.version, createdAt: tokenSnapshots.createdAt, tokenCounts: tokenSnapshots.tokenCounts })
        .from(tokenSnapshots)
        .where(eq(tokenSnapshots.projectId, p.id))
        .orderBy(desc(tokenSnapshots.version))
        .limit(1)
        .get();

      if (latestToken) {
        let count = 0;
        try {
          const counts = JSON.parse(latestToken.tokenCounts);
          count = counts.total ?? (Object.values(counts) as number[]).reduce((a, b) => a + b, 0);
        } catch {}
        syncs.push({ type: 'tokens', version: latestToken.version, syncedAt: latestToken.createdAt!, count });
      }

      // icons / images / themes / components 최신 버전
      await Promise.all(
        SYNC_TYPES.map(async (type) => {
          const latest = await db
            .select({ version: syncPayloads.version, createdAt: syncPayloads.createdAt })
            .from(syncPayloads)
            .where(and(eq(syncPayloads.projectId, p.id), eq(syncPayloads.type, type)))
            .orderBy(desc(syncPayloads.version))
            .limit(1)
            .get();
          if (latest) {
            syncs.push({ type, version: latest.version, syncedAt: latest.createdAt! });
          }
        })
      );

      return { ...p, figmaKey: p.figmaKey!, syncs };
    })
  );

  return result.filter((p) => p.syncs.length > 0);
}
