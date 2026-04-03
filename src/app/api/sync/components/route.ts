import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { validateApiKey } from '@/lib/auth/api-key';
import { db, sqlite } from '@/lib/db';
import { components, componentFiles, componentNodeSnapshots, projects, histories } from '@/lib/db/schema';
import { CORS_HEADERS } from '@/lib/sync/cors';
import { ensureProject } from '@/lib/sync/upsert-payload';
import { eq, and, desc } from 'drizzle-orm';
import { runComponentEngine } from '@/lib/component-generator';
import type { PluginComponentPayload } from '@/lib/component-generator';

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
// 컴포넌트 수신 + 코드 생성 + DB 저장
//
// Format A (플러그인 신규): component 객체에 meta 필드가 있는 경우
//   { figmaFileKey, figmaFileName, component: PluginComponentPayload }
// Format B (레거시): component 객체에 category 필드가 있는 경우
//   { figmaFileKey, figmaFileName, component: { name, category, files, ... } }
export async function POST(req: Request) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const body = await req.json() as Record<string, unknown>;
  const { figmaFileKey, figmaFileName, component } = body as {
    figmaFileKey?: string;
    figmaFileName?: string;
    component?: Record<string, unknown>;
  };

  if (!component) {
    return NextResponse.json({ error: 'component is required' }, { status: 400, headers: CORS_HEADERS });
  }

  // ── Format A: 플러그인 신규 payload (meta 필드 존재) ──────────────
  if (component['meta'] && typeof component['meta'] === 'object') {
    const payload = component as unknown as PluginComponentPayload;
    const resolvedFileKey = figmaFileKey ?? 'local-plugin';
    const project = await ensureProject(resolvedFileKey, figmaFileName ?? resolvedFileKey);
    const projectId = project.id;

    // 변경 감지 (content_hash)
    const rawPayload = JSON.stringify(payload);
    const contentHash = crypto.createHash('sha256').update(rawPayload).digest('hex');

    const existing = await db
      .select({ id: components.id, contentHash: components.contentHash, version: components.version })
      .from(components)
      .where(and(eq(components.projectId, projectId), eq(components.figmaNodeId, payload.meta.nodeId)))
      .get();

    if (existing?.contentHash === contentHash) {
      return NextResponse.json(
        { success: true, changed: false, componentId: existing.id, version: existing.version },
        { headers: CORS_HEADERS },
      );
    }

    // 코드 생성
    const result = runComponentEngine(payload);

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
        result.output?.scss ?? null,
        rawPayload,
        payload.detectedType,
        JSON.stringify(payload.radixProps),
        contentHash,
        version,
        now.getTime(),
        componentId,
      );
    } else {
      componentId = crypto.randomUUID();
      version = 1;
      const allOrders = await db
        .select({ menuOrder: components.menuOrder })
        .from(components)
        .where(eq(components.projectId, projectId))
        .all();
      const nextOrder = allOrders.length > 0
        ? Math.max(...allOrders.map((r) => r.menuOrder)) + 1
        : 0;

      sqlite.prepare(`
        INSERT INTO components
          (id, project_id, figma_node_id, figma_file_key, name, category,
           tsx, scss, node_payload, detected_type, radix_props,
           content_hash, version, menu_order, is_visible)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
      `).run(
        componentId,
        projectId,
        payload.meta.nodeId,
        resolvedFileKey,
        payload.name,
        result.output?.category ?? 'action',
        result.output?.tsx ?? null,
        result.output?.scss ?? null,
        rawPayload,
        payload.detectedType,
        JSON.stringify(payload.radixProps),
        contentHash,
        version,
        nextOrder,
      );
    }

    // node snapshot 저장 (이력)
    await db.insert(componentNodeSnapshots).values({
      id: crypto.randomUUID(),
      componentId,
      figmaNodeData: rawPayload,
      trigger: existing ? 'update' : 'generate',
    });

    // 활동 이력
    if (result.output) {
      await db.insert(histories).values({
        id: crypto.randomUUID(),
        projectId,
        action: 'generate_component',
        summary: `${payload.name} 컴포넌트 생성 (${payload.detectedType}, v${version})`,
        metadata: JSON.stringify({ name: payload.name, detectedType: payload.detectedType, version }),
      });
    }

    return NextResponse.json(
      {
        success: result.success,
        changed: true,
        componentId,
        version,
        generated: result.success,
        warnings: result.warnings,
        error: result.error,
      },
      { headers: CORS_HEADERS },
    );
  }

  // ── Format B: 레거시 payload ──────────────────────────────────────
  const { name, category, description, figmaNodeId, defaultStyleMode, files, nodeSnapshot } = component as {
    name?: string;
    category?: 'action' | 'form' | 'navigation' | 'feedback';
    description?: string;
    figmaNodeId?: string;
    defaultStyleMode?: 'css-modules' | 'styled' | 'html';
    files?: Array<{ styleMode: 'css-modules' | 'styled' | 'html'; fileType: 'tsx' | 'css' | 'html'; fileName: string; content: string }>;
    nodeSnapshot?: { figmaNodeData?: unknown; figmaVersion?: string; trigger?: 'generate' | 'update' };
  };

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

    // nodeSnapshot 안에 PluginComponentPayload가 있으면 코드 생성
    try {
      const rawNodeData = typeof nodeSnapshot.figmaNodeData === 'string'
        ? nodeSnapshot.figmaNodeData
        : JSON.stringify(nodeSnapshot.figmaNodeData);
      const nodeData = JSON.parse(rawNodeData) as Record<string, unknown>;

      if (nodeData['detectedType'] && typeof nodeData['detectedType'] === 'string') {
        const payload = nodeData as unknown as PluginComponentPayload;
        const contentHash = crypto.createHash('sha256').update(rawNodeData).digest('hex');
        const result = runComponentEngine(payload);

        sqlite.prepare(`
          UPDATE components
          SET tsx=?, scss=?, node_payload=?, detected_type=?, radix_props=?,
              content_hash=?, updated_at=?
          WHERE id=?
        `).run(
          result.output?.tsx ?? null,
          result.output?.scss ?? null,
          rawNodeData,
          payload.detectedType,
          JSON.stringify(payload.radixProps ?? {}),
          contentHash,
          Date.now(),
          componentId,
        );
      }
    } catch (e) {
      console.error('[Format B engine error]', e);
    }
  }

  return NextResponse.json({ success: true, componentId, changed }, { headers: CORS_HEADERS });
}
