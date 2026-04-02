'use server';

import { db } from '@/lib/db';
import { tokenTypeConfigs, tokens } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  label: z.string().min(1).max(40).optional(),
  icon:  z.string().min(1).optional(),
});

/** 라벨 또는 아이콘 수정 */
export async function updateTokenTypeConfigAction(
  id: string,
  data: { label?: string; icon?: string },
): Promise<{ error: string | null }> {
  const parsed = updateSchema.safeParse(data);
  if (!parsed.success) return { error: '입력값이 올바르지 않습니다.' };

  const updates: { label?: string; icon?: string; updatedAt: Date } = {
    ...parsed.data,
    updatedAt: new Date(),
  };

  await db.update(tokenTypeConfigs).set(updates).where(eq(tokenTypeConfigs.id, id));
  return { error: null };
}

/** 표시 여부 토글 */
export async function toggleTokenTypeVisibilityAction(
  id: string,
): Promise<{ error: string | null }> {
  const row = await db
    .select({ isVisible: tokenTypeConfigs.isVisible })
    .from(tokenTypeConfigs)
    .where(eq(tokenTypeConfigs.id, id))
    .get();

  if (!row) return { error: '해당 타입을 찾을 수 없습니다.' };

  await db
    .update(tokenTypeConfigs)
    .set({ isVisible: !row.isVisible, updatedAt: new Date() })
    .where(eq(tokenTypeConfigs.id, id));

  return { error: null };
}

/** 순서 변경 — orderedIds 배열 순서대로 menuOrder 재설정 (트랜잭션) */
export async function reorderTokenTypeConfigsAction(
  orderedIds: string[],
): Promise<{ error: string | null }> {
  if (orderedIds.length === 0) return { error: null };

  db.transaction((tx) => {
    const now = new Date();
    orderedIds.forEach((id, i) => {
      tx.update(tokenTypeConfigs)
        .set({ menuOrder: i, updatedAt: now })
        .where(eq(tokenTypeConfigs.id, id))
        .run();
    });
  });
  return { error: null };
}

/** 삭제 — tokens 테이블에 해당 type 데이터가 없을 때만 허용 */
export async function deleteTokenTypeConfigAction(
  id: string,
): Promise<{ error: string | null }> {
  const row = await db
    .select({ projectId: tokenTypeConfigs.projectId, type: tokenTypeConfigs.type })
    .from(tokenTypeConfigs)
    .where(eq(tokenTypeConfigs.id, id))
    .get();

  if (!row) return { error: '해당 타입을 찾을 수 없습니다.' };

  const tokenCount = await db
    .select({ cnt: count() })
    .from(tokens)
    .where(and(eq(tokens.projectId, row.projectId), eq(tokens.type, row.type)))
    .get();

  if ((tokenCount?.cnt ?? 0) > 0) {
    return { error: `토큰 데이터가 남아 있어 삭제할 수 없습니다. (${tokenCount?.cnt}개)` };
  }

  await db.delete(tokenTypeConfigs).where(eq(tokenTypeConfigs.id, id));
  return { error: null };
}
