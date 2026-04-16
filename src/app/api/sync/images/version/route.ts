export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { syncPayloads } from '@/lib/db/schema';
import { getActiveProjectId } from '@/lib/db/active-project';
import { eq, and, desc } from 'drizzle-orm';

export async function GET() {
  const projectId = getActiveProjectId();
  if (!projectId) {
    return Response.json({ version: null, count: null });
  }

  const latest = db
    .select({ version: syncPayloads.version, data: syncPayloads.data })
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), eq(syncPayloads.type, 'images')))
    .orderBy(desc(syncPayloads.version))
    .limit(1)
    .get();

  if (!latest) {
    return Response.json({ version: null, count: null });
  }

  let count: number | null = null;
  try {
    const parsed = JSON.parse(latest.data) as unknown[];
    count = parsed.length;
  } catch { /* 무시 */ }

  return Response.json({ version: latest.version, count });
}
