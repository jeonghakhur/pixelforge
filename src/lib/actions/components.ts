'use server';

import { db } from '@/lib/db';
import { components, componentFiles, componentNodeSnapshots, tokens, projects, histories } from '@/lib/db/schema';
import { getActiveProjectId } from '@/lib/db/active-project';
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
  css: string | null;
  description: string | null;
  menuOrder: number;
  detectedType?: string | null;
  radixProps?: string | null;
  version?: number | null;
}

// ===========================
// 조회
// ===========================
export async function getComponentByName(name: string): Promise<ComponentRow | null> {
  const row = db.select({
    id: components.id,
    name: components.name,
    category: components.category,
    tsx: components.tsx,
    css: components.scss,
    description: components.description,
    menuOrder: components.menuOrder,
    detectedType: components.detectedType,
    radixProps: components.radixProps,
    version: components.version,
  })
    .from(components)
    .where(eq(components.name, name))
    .get();

  return row ?? null;
}

export async function getComponentsByProject(): Promise<ComponentRow[]> {
  const activeId = getActiveProjectId();
  const project = activeId
    ? db.select({ id: projects.id }).from(projects).where(eq(projects.id, activeId)).get()
    : db.select({ id: projects.id }).from(projects).orderBy(desc(projects.updatedAt)).limit(1).get();
  if (!project) return [];

  return db.select({
    id: components.id,
    name: components.name,
    category: components.category,
    tsx: components.tsx,
    css: components.scss,
    description: components.description,
    menuOrder: components.menuOrder,
  })
    .from(components)
    .where(eq(components.projectId, project.id))
    .orderBy(asc(components.menuOrder))
    .all();
}

// ===========================
// Sandbox용 토큰 CSS
// ===========================
export async function getSandboxTokensCss(): Promise<string> {
  const projectId = getActiveProjectId();
  if (!projectId) return '';

  const rows = db.select({ type: tokens.type, name: tokens.name, value: tokens.value, raw: tokens.raw })
    .from(tokens)
    .where(eq(tokens.projectId, projectId))
    .all();

  if (rows.length === 0) return '';

  const { generateAllCssCode } = await import('@/lib/tokens/css-generator');
  return generateAllCssCode(rows as Parameters<typeof generateAllCssCode>[0]);
}

// ===========================
// 삭제
// ===========================
export async function deleteComponent(id: string): Promise<void> {
  await db.delete(componentNodeSnapshots).where(eq(componentNodeSnapshots.componentId, id));
  await db.delete(componentFiles).where(eq(componentFiles.componentId, id));
  await db.delete(components).where(eq(components.id, id));
}

// ===========================
// JSON 임포트
// ===========================
export async function importComponentFromJson(
  rawJson: string,
): Promise<{ error: string | null; component: ComponentRow | null }> {
  // 파싱
  let payload: unknown;
  try {
    payload = JSON.parse(rawJson);
  } catch {
    return { error: 'JSON 파싱 실패: 올바른 JSON 형식인지 확인해주세요.', component: null };
  }

  // 플러그인 envelope { meta, data } 또는 직접 payload 모두 허용
  const data = (payload as Record<string, unknown>)?.data ?? payload;

  if (typeof data !== 'object' || data === null) {
    return { error: 'JSON 구조가 올바르지 않습니다.', component: null };
  }

  const d = data as Record<string, unknown>;
  if (typeof d.name !== 'string' || !d.name.trim()) {
    return { error: 'name 필드가 없거나 비어 있습니다.', component: null };
  }

  const project = db.select({ id: projects.id }).from(projects).orderBy(desc(projects.updatedAt)).limit(1).get();
  if (!project) return { error: 'Figma 토큰을 먼저 추출해주세요. 프로젝트 정보가 없습니다.', component: null };

  // 파이프라인: normalize → detect → generate
  const { runPipeline } = await import('@/lib/component-generator');
  const result = runPipeline(d);
  const componentName = result.output?.name ?? d.name as string;

  // 이름 중복 확인 — 있으면 버전 업
  const existing = db.select({ id: components.id, version: components.version })
    .from(components).where(eq(components.name, componentName)).get();

  const rawPayload = JSON.stringify(d);
  const contentHash = crypto.createHash('sha256').update(rawPayload).digest('hex');
  const now = new Date();

  let componentId: string;
  let version: number;

  if (existing) {
    componentId = existing.id;
    version = (existing.version ?? 0) + 1;
    db.update(components).set({
      tsx: result.output?.tsx ?? null,
      scss: result.output?.css ?? null,
      detectedType: result.resolvedType,
      radixProps: JSON.stringify((d as Record<string, unknown>).radixProps ?? {}),
      contentHash,
      version,
      updatedAt: now,
    }).where(eq(components.id, componentId)).run();
  } else {
    componentId = generateId();
    version = 1;
    const allOrders = db.select({ menuOrder: components.menuOrder })
      .from(components).where(eq(components.projectId, project.id)).all();
    const nextOrder = allOrders.length > 0 ? Math.max(...allOrders.map((r) => r.menuOrder)) + 1 : 0;

    const category = result.output?.category ?? 'action';
    db.insert(components).values({
      id: componentId,
      projectId: project.id,
      name: componentName,
      category,
      tsx: result.output?.tsx ?? null,
      scss: result.output?.css ?? null,
      nodePayload: rawPayload,
      detectedType: result.resolvedType,
      radixProps: JSON.stringify((d as Record<string, unknown>).radixProps ?? {}),
      contentHash,
      version,
      menuOrder: nextOrder,
      isVisible: true,
    }).run();
  }

  const row = db.select({
    id: components.id,
    name: components.name,
    category: components.category,
    tsx: components.tsx,
    css: components.scss,
    description: components.description,
    menuOrder: components.menuOrder,
    detectedType: components.detectedType,
    radixProps: components.radixProps,
    version: components.version,
  }).from(components).where(eq(components.id, componentId)).get();

  return { error: null, component: row ?? null };
}
