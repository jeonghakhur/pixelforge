import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { validateApiKey } from '@/lib/auth/api-key';
import { db, sqlite } from '@/lib/db';
import { components, componentNodeSnapshots, projects, histories } from '@/lib/db/schema';
import { CORS_HEADERS } from '@/lib/sync/cors';
import { ensureProject } from '@/lib/sync/upsert-payload';
import { eq, and } from 'drizzle-orm';
import { runComponentEngine } from '@/lib/component-generator';
import type { PluginComponentPayload } from '@/lib/component-generator';
import { normalizePluginPayload } from '@/lib/component-generator/normalize-payload';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/sync/components?figmaFileKey=xxx
export async function GET(req: Request) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { searchParams } = new URL(req.url);
  const figmaFileKey = searchParams.get('figmaFileKey');
  if (!figmaFileKey) {
    return NextResponse.json({ error: 'figmaFileKey is required' }, { status: 400, headers: CORS_HEADERS });
  }

  const project = db.select({ id: projects.id }).from(projects).where(eq(projects.figmaKey, figmaFileKey)).get();
  if (!project) {
    return NextResponse.json({ components: [] }, { headers: CORS_HEADERS });
  }

  const rows = db
    .select({ id: components.id, figmaNodeId: components.figmaNodeId, name: components.name, updatedAt: components.updatedAt })
    .from(components)
    .where(eq(components.projectId, project.id))
    .all();

  return NextResponse.json({ components: rows }, { headers: CORS_HEADERS });
}

// POST /api/sync/components
// Body: { figmaFileKey?, figmaFileName?, meta: null, data: PluginComponentPayload }
export async function POST(req: Request) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const body = await req.json() as {
    figmaFileKey?: string;
    figmaFileName?: string;
    meta: null;
    data: PluginComponentPayload;
  };

  const { figmaFileKey, figmaFileName } = body;
  const data = normalizePluginPayload(body.data as unknown as Record<string, unknown>);

  if (!data?.name || !data?.meta?.nodeId) {
    return NextResponse.json({ error: 'data.name and data.meta.nodeId are required' }, { status: 400, headers: CORS_HEADERS });
  }

  const resolvedFileKey = figmaFileKey || data.meta.figmaFileId || 'local-plugin';
  const project = await ensureProject(resolvedFileKey, figmaFileName || resolvedFileKey);
  const projectId = project.id;

  // 변경 감지
  const rawPayload = JSON.stringify(data);
  const contentHash = crypto.createHash('sha256').update(rawPayload).digest('hex');

  const existing = db
    .select({ id: components.id, contentHash: components.contentHash, version: components.version })
    .from(components)
    .where(and(eq(components.projectId, projectId), eq(components.figmaNodeId, data.meta.nodeId)))
    .get();

  if (existing?.contentHash === contentHash) {
    return NextResponse.json(
      { success: true, changed: false, componentId: existing.id, version: existing.version },
      { headers: CORS_HEADERS },
    );
  }

  // 코드 생성
  const result = runComponentEngine(data);
  const now = new Date();
  let componentId: string;
  let version: number;

  if (existing) {
    componentId = existing.id;
    version = (existing.version ?? 0) + 1;
    sqlite.prepare(`
      UPDATE components
      SET tsx=?, scss=?, node_payload=?, detected_type=?, radix_props=?,
          content_hash=?, version=?, updated_at=?
      WHERE id=?
    `).run(
      result.output?.tsx ?? null,
      result.output?.css ?? null,
      rawPayload,
      data.detectedType,
      JSON.stringify(data.radixProps ?? {}),
      contentHash,
      version,
      now.getTime(),
      componentId,
    );
  } else {
    componentId = crypto.randomUUID();
    version = 1;
    const allOrders = db.select({ menuOrder: components.menuOrder }).from(components).where(eq(components.projectId, projectId)).all();
    const nextOrder = allOrders.length > 0 ? Math.max(...allOrders.map((r) => r.menuOrder)) + 1 : 0;

    sqlite.prepare(`
      INSERT INTO components
        (id, project_id, figma_node_id, figma_file_key, name, category,
         tsx, scss, node_payload, detected_type, radix_props,
         content_hash, version, menu_order, is_visible)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
    `).run(
      componentId,
      projectId,
      data.meta.nodeId,
      resolvedFileKey,
      data.name,
      result.output?.category ?? 'action',
      result.output?.tsx ?? null,
      result.output?.css ?? null,
      rawPayload,
      data.detectedType,
      JSON.stringify(data.radixProps ?? {}),
      contentHash,
      version,
      nextOrder,
    );
  }

  // 스냅샷 이력
  db.insert(componentNodeSnapshots).values({
    id: crypto.randomUUID(),
    componentId,
    figmaNodeData: rawPayload,
    trigger: existing ? 'update' : 'generate',
  }).run();

  // 활동 이력
  if (result.output) {
    db.insert(histories).values({
      id: crypto.randomUUID(),
      projectId,
      action: 'generate_component',
      summary: `${data.name} 컴포넌트 ${existing ? '업데이트' : '생성'} (${data.detectedType}, v${version})`,
      metadata: JSON.stringify({ name: data.name, detectedType: data.detectedType, version }),
    }).run();
  }

  return NextResponse.json(
    { success: result.success, changed: true, componentId, version, warnings: result.warnings, error: result.error },
    { headers: CORS_HEADERS },
  );
}
