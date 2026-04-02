'use server';

import { db } from '@/lib/db';
import { tokenTypeConfigs, tokens } from '@/lib/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { getActiveProjectId } from '@/lib/db/active-project';

export interface TokenMenuEntry {
  id: string;
  type: string;
  label: string;
  icon: string;
  menuOrder: number;
}

export interface TokenMenuAdminEntry extends TokenMenuEntry {
  isVisible: boolean;
  tokenCount: number;
}

/**
 * Sidebar용 — isVisible=true인 토큰 타입 목록 (menuOrder 순)
 */
export async function getTokenMenuAction(): Promise<TokenMenuEntry[]> {
  const projectId = getActiveProjectId();
  if (!projectId) return [];

  return db
    .select({
      id: tokenTypeConfigs.id,
      type: tokenTypeConfigs.type,
      label: tokenTypeConfigs.label,
      icon: tokenTypeConfigs.icon,
      menuOrder: tokenTypeConfigs.menuOrder,
    })
    .from(tokenTypeConfigs)
    .where(
      and(
        eq(tokenTypeConfigs.projectId, projectId),
        eq(tokenTypeConfigs.isVisible, true),
      ),
    )
    .orderBy(asc(tokenTypeConfigs.menuOrder))
    .all();
}

/**
 * Admin용 — 전체 토큰 타입 목록 (tokenCount 포함)
 */
export async function getTokenMenuAdminAction(): Promise<TokenMenuAdminEntry[]> {
  const projectId = getActiveProjectId();
  if (!projectId) return [];

  const rows = db
    .select({
      id: tokenTypeConfigs.id,
      type: tokenTypeConfigs.type,
      label: tokenTypeConfigs.label,
      icon: tokenTypeConfigs.icon,
      menuOrder: tokenTypeConfigs.menuOrder,
      isVisible: tokenTypeConfigs.isVisible,
      tokenCount: sql<number>`COUNT(${tokens.id})`,
    })
    .from(tokenTypeConfigs)
    .leftJoin(
      tokens,
      and(
        eq(tokens.projectId, tokenTypeConfigs.projectId),
        eq(tokens.type, tokenTypeConfigs.type),
      ),
    )
    .where(eq(tokenTypeConfigs.projectId, projectId))
    .groupBy(tokenTypeConfigs.id)
    .orderBy(asc(tokenTypeConfigs.menuOrder))
    .all();

  return rows as TokenMenuAdminEntry[];
}
