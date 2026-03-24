'use server';

import { db } from '@/lib/db';
import { components, tokens, projects, histories } from '@/lib/db/schema';
import { generateComponents, buildTokenContext } from '@/lib/generators/react';
import { eq, asc, desc } from 'drizzle-orm';
import crypto from 'crypto';

function generateId(): string {
  return crypto.randomUUID();
}

export interface ComponentRow {
  id: string;
  name: string;
  category: string;
  tsx: string | null;
  scss: string | null;
  description: string | null;
  menuOrder: number;
}

// ===========================
// 생성
// ===========================
export async function generateComponentsAction(
  componentIds: string[],
): Promise<{ error: string | null; generated: string[] }> {
  if (componentIds.length === 0) {
    return { error: '생성할 컴포넌트를 선택해주세요.', generated: [] };
  }

  const project = db.select({ id: projects.id }).from(projects).orderBy(desc(projects.updatedAt)).limit(1).get();
  if (!project) {
    return {
      error: 'Figma 토큰을 먼저 추출해주세요. 프로젝트 정보가 없습니다.',
      generated: [],
    };
  }

  const allTokens = db.select({
    type: tokens.type,
    name: tokens.name,
    value: tokens.value,
  }).from(tokens).where(eq(tokens.projectId, project.id)).all();

  const ctx = buildTokenContext(allTokens);
  const generated = generateComponents(componentIds, ctx);

  const names: string[] = [];

  for (const comp of generated) {
    const existing = db.select({ id: components.id })
      .from(components)
      .where(eq(components.name, comp.name))
      .get();

    if (existing) {
      db.update(components)
        .set({
          tsx: comp.tsx,
          scss: comp.scss,
          description: comp.description,
          updatedAt: new Date(),
        })
        .where(eq(components.id, existing.id))
        .run();
    } else {
      const maxOrder = db.select({ menuOrder: components.menuOrder })
        .from(components)
        .orderBy(asc(components.menuOrder))
        .all();
      const nextOrder = maxOrder.length > 0
        ? Math.max(...maxOrder.map((r) => r.menuOrder)) + 1
        : 0;

      db.insert(components).values({
        id: generateId(),
        projectId: project.id,
        name: comp.name,
        category: comp.category,
        tsx: comp.tsx,
        scss: comp.scss,
        description: comp.description,
        menuOrder: nextOrder,
        isVisible: true,
      }).run();
    }

    names.push(comp.name);
  }

  if (names.length > 0) {
    db.insert(histories).values({
      id: generateId(),
      projectId: project.id,
      action: 'generate_component',
      summary: `컴포넌트 생성: ${names.join(', ')}`,
      metadata: JSON.stringify({ components: names }),
    }).run();
  }

  return { error: null, generated: names };
}

// ===========================
// 조회
// ===========================
export async function getComponentByName(name: string): Promise<ComponentRow | null> {
  const normalizedName = name.charAt(0).toUpperCase() + name.slice(1).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

  const row = db.select({
    id: components.id,
    name: components.name,
    category: components.category,
    tsx: components.tsx,
    scss: components.scss,
    description: components.description,
    menuOrder: components.menuOrder,
  })
    .from(components)
    .where(eq(components.name, normalizedName))
    .get();

  return row ?? null;
}

export async function getComponentsByProject(): Promise<ComponentRow[]> {
  const project = db.select({ id: projects.id }).from(projects).orderBy(desc(projects.updatedAt)).limit(1).get();
  if (!project) return [];

  return db.select({
    id: components.id,
    name: components.name,
    category: components.category,
    tsx: components.tsx,
    scss: components.scss,
    description: components.description,
    menuOrder: components.menuOrder,
  })
    .from(components)
    .where(eq(components.projectId, project.id))
    .orderBy(asc(components.menuOrder))
    .all();
}

export async function deleteComponent(id: string): Promise<void> {
  db.delete(components).where(eq(components.id, id)).run();
}
