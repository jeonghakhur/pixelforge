import crypto from 'crypto';
import { db } from '@/lib/db';
import { projects, syncPayloads } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

type SyncType = string;

export async function ensureProject(figmaFileKey: string, figmaFileName?: string) {
  let project = await db.select().from(projects).where(eq(projects.figmaKey, figmaFileKey)).get();
  if (!project) {
    const id = crypto.randomUUID();
    await db.insert(projects).values({ id, name: figmaFileName || figmaFileKey, figmaKey: figmaFileKey });
    project = await db.select().from(projects).where(eq(projects.id, id)).get();
  }
  return project!;
}

export async function upsertSyncPayload(
  projectId: string,
  type: SyncType,
  data: unknown
): Promise<{ changed: boolean; version: number }> {
  const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

  const existing = await db
    .select()
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), eq(syncPayloads.type, type)))
    .orderBy(syncPayloads.version)
    .all()
    .at(-1);

  if (existing && existing.contentHash === hash) {
    return { changed: false, version: existing.version };
  }

  const nextVersion = (existing?.version ?? 0) + 1;
  await db.insert(syncPayloads).values({
    id: crypto.randomUUID(),
    projectId,
    type,
    version: nextVersion,
    contentHash: hash,
    data: JSON.stringify(data),
  });

  return { changed: true, version: nextVersion };
}
