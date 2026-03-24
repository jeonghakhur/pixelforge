import { db } from '@/lib/db';
import { tokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { TokenRow } from '@/lib/actions/tokens';

export function getAllTokensForProject(projectId: string): TokenRow[] {
  return db.select({
    id: tokens.id,
    name: tokens.name,
    type: tokens.type,
    value: tokens.value,
    raw: tokens.raw,
    source: tokens.source,
    mode: tokens.mode,
    collectionName: tokens.collectionName,
    alias: tokens.alias,
  })
    .from(tokens)
    .where(eq(tokens.projectId, projectId))
    .all() as TokenRow[];
}
