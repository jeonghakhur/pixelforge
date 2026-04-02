'use server';

import { db } from '@/lib/db';
import { projects, tokenSnapshots, syncPayloads } from '@/lib/db/schema';
import { eq, isNotNull, desc, and } from 'drizzle-orm';
import { deleteSnapshotAction } from './snapshots';

export interface SnapshotEntry {
  id: string;
  version: number;
  createdAt: Date;
  totalCount: number;
  counts: Record<string, number>;
}

export interface OtherSync {
  type: string;
  version: number;
  syncedAt: Date;
}

export interface ProjectSyncHistory {
  id: string;
  name: string;
  figmaKey: string;
  snapshots: SnapshotEntry[];
  otherSyncs: OtherSync[];
}

const OTHER_SYNC_TYPES = ['icons', 'images', 'themes', 'components'] as const;

export async function getPluginSyncHistoryAction(): Promise<ProjectSyncHistory[]> {
  const rows = await db
    .select({ id: projects.id, name: projects.name, figmaKey: projects.figmaKey })
    .from(projects)
    .where(isNotNull(projects.figmaKey))
    .all();

  const result = await Promise.all(
    rows.map(async (p) => {
      const snapshotRows = await db
        .select({
          id: tokenSnapshots.id,
          version: tokenSnapshots.version,
          tokenCounts: tokenSnapshots.tokenCounts,
          createdAt: tokenSnapshots.createdAt,
        })
        .from(tokenSnapshots)
        .where(eq(tokenSnapshots.projectId, p.id))
        .orderBy(desc(tokenSnapshots.version))
        .all();

      const snapshots: SnapshotEntry[] = snapshotRows.map((s) => {
        let counts: Record<string, number> = {};
        let totalCount = 0;
        try {
          const parsed = JSON.parse(s.tokenCounts) as Record<string, number>;
          const { total, ...rest } = parsed;
          counts = rest;
          totalCount = total ?? (Object.values(rest) as number[]).reduce((a, b) => a + b, 0);
        } catch {}
        return {
          id: s.id,
          version: s.version,
          createdAt: s.createdAt!,
          totalCount,
          counts,
        };
      });

      const otherSyncs: OtherSync[] = [];
      await Promise.all(
        OTHER_SYNC_TYPES.map(async (type) => {
          const latest = await db
            .select({ version: syncPayloads.version, createdAt: syncPayloads.createdAt })
            .from(syncPayloads)
            .where(and(eq(syncPayloads.projectId, p.id), eq(syncPayloads.type, type)))
            .orderBy(desc(syncPayloads.version))
            .limit(1)
            .get();
          if (latest) {
            otherSyncs.push({ type, version: latest.version, syncedAt: latest.createdAt! });
          }
        })
      );

      return { id: p.id, name: p.name, figmaKey: p.figmaKey!, snapshots, otherSyncs };
    })
  );

  return result.filter((p) => p.snapshots.length > 0 || p.otherSyncs.length > 0);
}

export { deleteSnapshotAction };
