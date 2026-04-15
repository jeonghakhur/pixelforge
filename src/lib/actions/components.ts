'use server';

import { db } from '@/lib/db';
import { components, componentFiles, componentNodeSnapshots, tokens, projects, histories } from '@/lib/db/schema';
import { getActiveProjectId } from '@/lib/db/active-project';
import { eq, asc, desc, and, ne } from 'drizzle-orm';
import crypto from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { writeComponentFiles } from '@/lib/component-generator/file-writer';
import type { ComponentOverrides } from '@/lib/component-generator/props-override';
import { componentOverridesSchema, validateUniqueNames } from '@/lib/component-generator/props-override';

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
  nodePayload?: string | null;
  propsOverrides?: string | null;
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
    nodePayload: components.nodePayload,
    propsOverrides: components.propsOverrides,
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
    nodePayload: components.nodePayload,
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

  const { getGeneratorConfig } = await import('@/lib/actions/generator-config');
  const { initGeneratorConfig } = await import('@/lib/generator-config-cache');
  initGeneratorConfig(await getGeneratorConfig());

  const { generateAllCssCode } = await import('@/lib/tokens/css-generator');
  return generateAllCssCode(rows as Parameters<typeof generateAllCssCode>[0]);
}

// ===========================
// CSS 변수 검증
// ===========================
export async function validateComponentCssVars(
  css: string | null,
): Promise<string[]> {
  if (!css) return [];

  const projectId = getActiveProjectId();
  if (!projectId) return [];

  // 생성된 CSS에서 var(--*) 참조 추출
  const varRefs = new Set<string>();
  const varRe = /var\(--([a-zA-Z0-9_-]+)\)/g;
  let m;
  while ((m = varRe.exec(css)) !== null) {
    varRefs.add(m[1]);
  }
  if (varRefs.size === 0) return [];

  // tokens.css 생성하여 정의된 변수 목록 추출
  const tokenRows = db.select({ type: tokens.type, name: tokens.name, value: tokens.value, raw: tokens.raw })
    .from(tokens)
    .where(eq(tokens.projectId, projectId))
    .all();

  if (tokenRows.length === 0) return [];

  const { generateAllCssCode } = await import('@/lib/tokens/css-generator');
  const tokensCss = generateAllCssCode(tokenRows as Parameters<typeof generateAllCssCode>[0]);

  // tokens.css에서 선언된 변수명 추출
  const definedVars = new Set<string>();
  const defRe = /--([\w-]+)\s*:/g;
  while ((m = defRe.exec(tokensCss)) !== null) {
    definedVars.add(m[1]);
  }

  // 누락 변수 찾기
  const missing: string[] = [];
  for (const ref of varRefs) {
    if (!definedVars.has(ref)) {
      missing.push(`--${ref}`);
    }
  }

  return missing;
}

// ===========================
// 삭제
// ===========================
export async function deleteComponent(id: string): Promise<void> {
  // 파일 삭제를 위해 Figma 원본 경로 조회
  const row = db.select({ name: components.name, nodePayload: components.nodePayload })
    .from(components).where(eq(components.id, id)).get();

  await db.delete(componentNodeSnapshots).where(eq(componentNodeSnapshots.componentId, id));
  await db.delete(componentFiles).where(eq(componentFiles.componentId, id));
  await db.delete(components).where(eq(components.id, id));

  // 생성된 파일 삭제 (Figma 경로 우선, 없으면 DB name)
  if (row) {
    let figmaPath: string | null = null;
    try {
      const payload = JSON.parse(row.nodePayload ?? '{}') as { name?: string };
      figmaPath = payload.name ?? null;
    } catch { /* ignore */ }

    const { deleteComponentFiles } = await import('@/lib/component-generator/file-writer');
    deleteComponentFiles(figmaPath ?? row.name);
  }
}

/**
 * 컴포넌트 삭제 후 목록 페이지로 리다이렉트.
 * 클라이언트에서 호출하면 server action이 redirect를 수행하여
 * 현재 페이지 재검증으로 인한 404 깜빡임 없이 이동한다.
 */
export async function deleteComponentAndRedirect(id: string): Promise<never> {
  await deleteComponent(id);
  revalidatePath('/components');
  redirect('/components');
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
  const { getGeneratorConfig } = await import('@/lib/actions/generator-config');
  const { initGeneratorConfig } = await import('@/lib/generator-config-cache');
  const genConfig = await getGeneratorConfig();
  initGeneratorConfig(genConfig);

  // Figma nodeId 기반으로 기존 컴포넌트 조회 (propsOverrides 보존용)
  const dataMeta = d.meta as Record<string, unknown> | undefined;
  const existingByNode = dataMeta?.nodeId
    ? db.select({ id: components.id, propsOverrides: components.propsOverrides })
        .from(components).where(eq(components.figmaNodeId, dataMeta.nodeId as string)).get()
    : null;

  // 기존 오버라이드 보존 — 재전송 시에도 편집 내용이 유지됨
  const preservedOverrides = existingByNode?.propsOverrides
    ? JSON.parse(existingByNode.propsOverrides) as ComponentOverrides
    : undefined;

  const { runPipeline } = await import('@/lib/component-generator');
  const result = runPipeline(d, { overrides: preservedOverrides });
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

  // 파일 시스템에 TSX + CSS 파일 생성 (Figma 경로 구조 유지)
  if (result.output?.tsx && result.output?.css) {
    const figmaName = d.name as string;
    writeComponentFiles(figmaName, result.output.tsx, result.output.css);
  }

  return { error: null, component: row ?? null };
}

// ===========================
// Props 오버라이드 저장
// ===========================
export async function updatePropsOverrides(
  id: string,
  overrides: ComponentOverrides,
): Promise<{ error: string | null }> {
  // Zod 검증
  const parsed = componentOverridesSchema.safeParse(overrides);
  if (!parsed.success) return { error: parsed.error.issues.map(e => e.message).join(', ') };

  // prop 이름 중복 검증
  if (!validateUniqueNames(overrides.props)) {
    return { error: '같은 이름의 prop이 중복되어 있습니다' };
  }

  // 컴포넌트명 중복 검증
  if (overrides.name) {
    const duplicate = db
      .select({ id: components.id })
      .from(components)
      .where(and(eq(components.name, overrides.name), ne(components.id, id)))
      .get();
    if (duplicate) return { error: `이름 '${overrides.name}'은 이미 사용 중입니다` };
  }

  db.update(components)
    .set({ propsOverrides: JSON.stringify(overrides), updatedAt: new Date() })
    .where(eq(components.id, id))
    .run();

  return { error: null };
}

// ===========================
// 파일 재생성 (오버라이드 반영)
// ===========================
export async function regenerateComponentFiles(
  id: string,
): Promise<{ error: string | null; newName?: string }> {
  const row = db
    .select({
      id: components.id,
      name: components.name,
      nodePayload: components.nodePayload,
      propsOverrides: components.propsOverrides,
    })
    .from(components)
    .where(eq(components.id, id))
    .get();

  if (!row?.nodePayload) return { error: '원본 데이터 없음' };

  const overrides = row.propsOverrides
    ? (JSON.parse(row.propsOverrides) as ComponentOverrides)
    : undefined;

  const oldName = row.name;
  const newName = overrides?.name ?? oldName;
  const nameChanged = oldName !== newName;

  // 컴포넌트명 변경 시 중복 검증
  if (nameChanged) {
    const duplicate = db
      .select({ id: components.id })
      .from(components)
      .where(and(eq(components.name, newName), ne(components.id, id)))
      .get();
    if (duplicate) return { error: `이름 '${newName}'은 이미 사용 중입니다` };
  }

  // 파이프라인 설정 로드
  const { getGeneratorConfig } = await import('@/lib/actions/generator-config');
  const { initGeneratorConfig } = await import('@/lib/generator-config-cache');
  initGeneratorConfig(await getGeneratorConfig());

  const rawData = JSON.parse(row.nodePayload) as Record<string, unknown>;
  const { runPipeline } = await import('@/lib/component-generator');
  const result = runPipeline(rawData, { overrides });

  if (!result.success || !result.output) {
    return { error: result.error ?? '생성 실패' };
  }

  // DB 업데이트
  db.update(components)
    .set({
      name: newName,
      tsx: result.output.tsx,
      scss: result.output.css,
      updatedAt: new Date(),
    })
    .where(eq(components.id, id))
    .run();

  // 파일 시스템 업데이트
  const figmaPath = (rawData.name as string) ?? newName;

  if (nameChanged) {
    // 이전 파일 삭제 후 새 파일 생성
    const { deleteComponentFiles } = await import('@/lib/component-generator/file-writer');
    // figmaPath의 마지막 세그먼트를 oldName으로 교체하여 이전 경로 추정
    const segments = figmaPath.split('/');
    segments[segments.length - 1] = oldName;
    const oldFigmaPath = segments.join('/');
    deleteComponentFiles(oldFigmaPath);

    const newSegments = figmaPath.split('/');
    newSegments[newSegments.length - 1] = newName;
    const newFigmaPath = newSegments.join('/');
    writeComponentFiles(newFigmaPath, result.output.tsx, result.output.css);
  } else {
    writeComponentFiles(figmaPath, result.output.tsx, result.output.css);
  }

  return { error: null, newName: nameChanged ? newName : undefined };
}

// ===========================
// Text 컴포넌트 생성 (토큰 기반 예외 경로)
// ===========================

/**
 * DB Typography 토큰 → Text 컴포넌트 생성/재생성.
 *
 * 플러그인 JSON 임포트(importComponentFromJson)와 독립적인 별도 플로우.
 * Text는 Figma에 COMPONENT_SET이 없으므로 DB 토큰에서 직접 생성한다.
 */
export async function generateTextComponentAction(): Promise<{
  error: string | null;
  component: ComponentRow | null;
  regenerated: boolean;
}> {
  const project = db
    .select({ id: projects.id })
    .from(projects)
    .orderBy(desc(projects.updatedAt))
    .limit(1)
    .get();

  if (!project) {
    return { error: '프로젝트 정보가 없습니다. Figma 토큰을 먼저 추출해주세요.', component: null, regenerated: false };
  }

  const { resolveTypographyPayload } = await import(
    '@/lib/component-generator/generators/text/token-resolver'
  );
  const { generateText } = await import('@/lib/component-generator/generators/text');

  const typographyPayload = await resolveTypographyPayload();

  if (typographyPayload.sizes.length === 0) {
    return { error: 'Typography 토큰이 없습니다. 먼저 Font size 토큰을 동기화해주세요.', component: null, regenerated: false };
  }

  const result = generateText(typographyPayload);

  // 기존 Text 컴포넌트 여부 확인
  const existing = db
    .select({ id: components.id, version: components.version })
    .from(components)
    .where(eq(components.name, 'Text'))
    .get();

  const now = new Date();
  let componentId: string;

  if (existing) {
    componentId = existing.id;
    db.update(components)
      .set({
        tsx: result.tsx,
        scss: result.css,
        version: (existing.version ?? 0) + 1,
        updatedAt: now,
      })
      .where(eq(components.id, existing.id))
      .run();
  } else {
    componentId = generateId();
    const allOrders = db
      .select({ menuOrder: components.menuOrder })
      .from(components)
      .where(eq(components.projectId, project.id))
      .all();
    const nextOrder = allOrders.length > 0
      ? Math.max(...allOrders.map((r) => r.menuOrder)) + 1
      : 0;

    db.insert(components).values({
      id: componentId,
      projectId: project.id,
      name: 'Text',
      category: 'feedback',
      tsx: result.tsx,
      scss: result.css,
      detectedType: 'text',
      contentHash: null,
      version: 1,
      menuOrder: nextOrder,
      isVisible: true,
    }).run();
  }

  // 파일 쓰기
  const { writeComponentFiles } = await import('@/lib/component-generator/file-writer');
  writeComponentFiles('Text', result.tsx, result.css);

  revalidatePath('/components');

  const row = db
    .select({
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
    .where(eq(components.id, componentId))
    .get();

  return { error: null, component: row ?? null, regenerated: !!existing };
}
