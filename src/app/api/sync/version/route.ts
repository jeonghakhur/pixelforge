export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { tokenSnapshots } from '@/lib/db/schema';
import { getActiveProjectId } from '@/lib/db/active-project';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const projectId = getActiveProjectId();
  if (!projectId) {
    return Response.json({ version: null });
  }

  const latest = db
    .select({ version: tokenSnapshots.version })
    .from(tokenSnapshots)
    .where(eq(tokenSnapshots.projectId, projectId))
    .orderBy(desc(tokenSnapshots.version))
    .limit(1)
    .get();

  return Response.json({ version: latest?.version ?? null });
}
