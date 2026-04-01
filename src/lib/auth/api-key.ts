import crypto from 'crypto';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function validateApiKey(req: Request) {
  const key = req.headers.get('X-API-Key');
  if (!key) return null;
  const hash = hashApiKey(key);
  const row = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash)).get();
  if (!row) return null;
  // Update lastUsedAt (fire-and-forget)
  db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).run();
  return row;
}
