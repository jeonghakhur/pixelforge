import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { validateApiKey } from '@/lib/auth/api-key';
import { db } from '@/lib/db';
import { components, componentFiles, componentNodeSnapshots, projects } from '@/lib/db/schema';
import { CORS_HEADERS } from '@/lib/sync/cors';
import { ensureProject } from '@/lib/sync/upsert-payload';
import { eq, and } from 'drizzle-orm';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/sync/components?figmaFileKey=xxx
// 플러그인 탭 활성화 시 DB 상태 조회용
export async function GET(req: Request) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { searchParams } = new URL(req.url);
  const figmaFileKey = searchParams.get('figmaFileKey');
  if (!figmaFileKey) {
    return NextResponse.json({ error: 'figmaFileKey is required' }, { status: 400, headers: CORS_HEADERS });
  }

  const project = await db.select({ id: projects.id }).from(projects).where(eq(projects.figmaKey, figmaFileKey)).get();
  if (!project) {
    return NextResponse.json({ components: [] }, { headers: CORS_HEADERS });
  }

  const rows = await db
    .select({
      id: components.id,
      figmaNodeId: components.figmaNodeId,
      name: components.name,
      updatedAt: components.updatedAt,
    })
    .from(components)
    .where(eq(components.projectId, project.id))
    .all();

  return NextResponse.json({ components: rows }, { headers: CORS_HEADERS });
}

// POST /api/sync/components
// 컴포넌트 코드 생성 후 DB 저장/갱신
export async function POST(req: Request) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const body = await req.json();
  const { figmaFileKey, figmaFileName, component } = body;

  if (!component) {
    return NextResponse.json({ error: 'component is required' }, { status: 400, headers: CORS_HEADERS });
  }

  const { name, category, description, figmaNodeId, defaultStyleMode, files, nodeSnapshot } = component;

  if (!name || !category) {
    return NextResponse.json({ error: 'component.name and component.category are required' }, { status: 400, headers: CORS_HEADERS });
  }

  // figmaFileKey 없으면 'local-plugin' 폴백 (Figma 외 환경 또는 init-data 미수신 케이스)
  const resolvedFileKey = figmaFileKey || 'local-plugin';
  const project = await ensureProject(resolvedFileKey, figmaFileName || resolvedFileKey);
  const projectId = project.id;

  // 기존 컴포넌트 조회: figmaNodeId 기준 → name 기준 fallback
  let existing = figmaNodeId
    ? await db.select({ id: components.id }).from(components)
        .where(and(eq(components.projectId, projectId), eq(components.figmaNodeId, figmaNodeId)))
        .get()
    : null;

  if (!existing) {
    existing = await db.select({ id: components.id }).from(components)
      .where(and(eq(components.projectId, projectId), eq(components.name, name)))
      .get();
  }

  const now = new Date();
  let componentId: string;
  let changed: boolean;

  if (existing) {
    componentId = existing.id;
    await db.update(components).set({
      figmaNodeId: figmaNodeId ?? undefined,
      figmaFileKey: resolvedFileKey,
      description: description ?? undefined,
      defaultStyleMode: defaultStyleMode ?? 'css-modules',
      updatedAt: now,
    }).where(eq(components.id, componentId));
    changed = true;
  } else {
    componentId = crypto.randomUUID();
    const maxOrderRow = await db
      .select({ menuOrder: components.menuOrder })
      .from(components)
      .where(eq(components.projectId, projectId))
      .all();
    const nextOrder = maxOrderRow.length > 0
      ? Math.max(...maxOrderRow.map((r) => r.menuOrder)) + 1
      : 0;

    await db.insert(components).values({
      id: componentId,
      projectId,
      figmaNodeId: figmaNodeId ?? null,
      figmaFileKey: resolvedFileKey,
      name,
      category,
      description: description ?? null,
      defaultStyleMode: defaultStyleMode ?? 'css-modules',
      menuOrder: nextOrder,
      isVisible: true,
    });
    changed = true;
  }

  // component_files upsert (styleMode + fileType 기준)
  if (Array.isArray(files) && files.length > 0) {
    for (const file of files) {
      const { styleMode, fileType, fileName, content } = file;
      if (!styleMode || !fileType || !fileName || content === undefined) continue;

      const existingFile = await db
        .select({ id: componentFiles.id })
        .from(componentFiles)
        .where(and(
          eq(componentFiles.componentId, componentId),
          eq(componentFiles.styleMode, styleMode),
          eq(componentFiles.fileType, fileType),
        ))
        .get();

      if (existingFile) {
        await db.update(componentFiles).set({
          fileName,
          content,
          updatedAt: now,
        }).where(eq(componentFiles.id, existingFile.id));
      } else {
        await db.insert(componentFiles).values({
          id: crypto.randomUUID(),
          componentId,
          styleMode,
          fileType,
          fileName,
          content,
        });
      }
    }
  }

  // component_node_snapshots — 항상 새 스냅샷 추가
  if (nodeSnapshot && nodeSnapshot.figmaNodeData) {
    await db.insert(componentNodeSnapshots).values({
      id: crypto.randomUUID(),
      componentId,
      figmaNodeData: typeof nodeSnapshot.figmaNodeData === 'string'
        ? nodeSnapshot.figmaNodeData
        : JSON.stringify(nodeSnapshot.figmaNodeData),
      figmaVersion: nodeSnapshot.figmaVersion ?? null,
      trigger: nodeSnapshot.trigger ?? 'generate',
    });
  }

  return NextResponse.json({ success: true, componentId, changed }, { headers: CORS_HEADERS });
}
