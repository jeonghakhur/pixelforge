'use server';

import crypto from 'crypto';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashApiKey } from '@/lib/auth/api-key';

export async function createApiKey(name: string) {
  if (!name?.trim()) return { error: '키 이름을 입력해주세요' };
  const rawKey = 'pf_' + crypto.randomBytes(32).toString('hex');
  const hash = hashApiKey(rawKey);
  await db.insert(apiKeys).values({
    id: crypto.randomUUID(),
    keyHash: hash,
    name: name.trim(),
  });
  return { key: rawKey };
}

export async function getApiKeys() {
  return db.select({ id: apiKeys.id, name: apiKeys.name, createdAt: apiKeys.createdAt, lastUsedAt: apiKeys.lastUsedAt })
    .from(apiKeys)
    .all();
}

export async function deleteApiKey(id: string) {
  await db.delete(apiKeys).where(eq(apiKeys.id, id));
  return { ok: true };
}
