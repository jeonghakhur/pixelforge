'use server';

import { db } from '@/lib/db';
import { tokens, projects, histories } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export interface TokenRow {
  id: string;
  name: string;
  type: string;
  value: string;
  raw: string | null;
}

export async function getTokensByType(type: 'color' | 'typography' | 'spacing' | 'radius'): Promise<TokenRow[]> {
  const rows = db.select({
    id: tokens.id,
    name: tokens.name,
    type: tokens.type,
    value: tokens.value,
    raw: tokens.raw,
  })
    .from(tokens)
    .where(eq(tokens.type, type))
    .all();

  return rows;
}

export interface TokenSummary {
  colors: number;
  typography: number;
  spacing: number;
  radius: number;
  lastExtracted: string | null;
}

export async function getTokenSummary(): Promise<TokenSummary> {
  const counts = db.select({
    type: tokens.type,
    count: sql<number>`count(*)`,
  })
    .from(tokens)
    .groupBy(tokens.type)
    .all();

  const countMap: Record<string, number> = {};
  for (const row of counts) {
    countMap[row.type] = row.count;
  }

  const lastHistory = db.select({
    createdAt: histories.createdAt,
  })
    .from(histories)
    .where(eq(histories.action, 'extract_tokens'))
    .orderBy(desc(histories.createdAt))
    .limit(1)
    .get();

  let lastExtracted: string | null = null;
  if (lastHistory?.createdAt) {
    const d = lastHistory.createdAt;
    lastExtracted = d instanceof Date ? d.toISOString() : new Date(d as number * 1000).toISOString();
  }

  return {
    colors: countMap['color'] ?? 0,
    typography: countMap['typography'] ?? 0,
    spacing: countMap['spacing'] ?? 0,
    radius: countMap['radius'] ?? 0,
    lastExtracted,
  };
}

export async function getProjectInfo(): Promise<{ name: string; figmaUrl: string } | null> {
  const project = db.select({
    name: projects.name,
    figmaUrl: projects.figmaUrl,
  })
    .from(projects)
    .limit(1)
    .get();

  if (!project || !project.figmaUrl) return null;
  return { name: project.name, figmaUrl: project.figmaUrl };
}
