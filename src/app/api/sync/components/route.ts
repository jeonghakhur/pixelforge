import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { validateApiKey } from '@/lib/auth/api-key';
import { db, sqlite } from '@/lib/db';
import { components, componentNodeSnapshots, projects, histories } from '@/lib/db/schema';
import { CORS_HEADERS } from '@/lib/sync/cors';
import { ensureProject } from '@/lib/sync/upsert-payload';
import { eq, and } from 'drizzle-orm';
import { runPipeline } from '@/lib/component-generator';
import type { PluginPayload } from '@/lib/component-generator';
import { notifySyncUpdated } from '@/lib/sync/sse-hub';
import { setActiveProject } from '@/lib/actions/tokens';
import { writeComponentFiles } from '@/lib/component-generator/file-writer';

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
    data: PluginPayload;
  };

  const { figmaFileKey, figmaFileName } = body;
  const rawData = body.data as unknown as Record<string, unknown>;
  const dataMeta = (rawData.meta ?? {}) as Record<string, string>;
  const dataName = (rawData.name as string) ?? '';

  if (!dataName.trim() || !dataMeta.nodeId) {
    return NextResponse.json({ error: 'data.name and data.meta.nodeId are required' }, { status: 400, headers: CORS_HEADERS });
  }

  const resolvedFileKey = figmaFileKey || dataMeta.figmaFileKey || 'local-plugin';
  const project = await ensureProject(resolvedFileKey, figmaFileName || resolvedFileKey);
  const projectId = project.id;

  // 컴포넌트 수신 시에도 활성 프로젝트 설정
  await setActiveProject(projectId);

  // 변경 감지
  const rawPayload = JSON.stringify(rawData);
  const contentHash = crypto.createHash('sha256').update(rawPayload).digest('hex');

  const existing = db
    .select({ id: components.id, contentHash: components.contentHash, version: components.version, tsx: components.tsx })
    .from(components)
    .where(and(eq(components.projectId, projectId), eq(components.figmaNodeId, dataMeta.nodeId)))
    .get();

  // 해시 동일 + tsx가 이미 존재하면 스킵 (코드가 null이면 재생성 필요)
  if (existing?.contentHash === contentHash && existing.tsx) {
    return NextResponse.json(
      { success: true, changed: false, componentId: existing.id, version: existing.version },
      { headers: CORS_HEADERS },
    );
  }

  // 파이프라인: normalize → detect → generate
  console.log('[component-sync] ─────────────────────────────');
  console.log('[component-sync] rawName:', JSON.stringify(dataName));
  console.log('[component-sync] nodeName:', JSON.stringify(dataMeta.nodeName));
  const result = runPipeline(rawData);
  const componentName = result.output?.name ?? dataName;
  console.log('[component-sync] resolved:', componentName, '(DB name)');
  console.log('[component-sync] figmaPath:', dataName, '(file path)');
  console.log('[component-sync] ─────────────────────────────');
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
      result.resolvedType,
      JSON.stringify((rawData.radixProps as Record<string, string>) ?? {}),
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
      dataMeta.nodeId,
      resolvedFileKey,
      componentName,
      result.output?.category ?? 'action',
      result.output?.tsx ?? null,
      result.output?.css ?? null,
      rawPayload,
      result.resolvedType,
      JSON.stringify((rawData.radixProps as Record<string, string>) ?? {}),
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

  // 파일 시스템에 TSX + CSS 파일 생성 (Figma 경로 구조 유지)
  if (result.output?.tsx && result.output?.css) {
    writeComponentFiles(dataName, result.output.tsx, result.output.css);
  }

  // 활동 이력
  if (result.output) {
    db.insert(histories).values({
      id: crypto.randomUUID(),
      projectId,
      action: 'generate_component',
      summary: `${componentName} 컴포넌트 ${existing ? '업데이트' : '생성'} (${result.resolvedType}, v${version})`,
      metadata: JSON.stringify({ name: componentName, detectedType: result.resolvedType, version }),
    }).run();
  }

  // SSE 알림
  notifySyncUpdated({
    type: 'component',
    changed: true,
    name: componentName,
    version,
    action: existing ? 'update' : 'create',
  });

  return NextResponse.json(
    { success: result.success, changed: true, componentId, version, warnings: result.warnings, error: result.error },
    { headers: CORS_HEADERS },
  );
}
