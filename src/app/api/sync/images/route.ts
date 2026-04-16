import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth/api-key';
import { ensureProject, upsertSyncPayload } from '@/lib/sync/upsert-payload';
import { CORS_HEADERS } from '@/lib/sync/cors';
import { getImageStoragePath } from '@/lib/actions/settings';
import { db } from '@/lib/db';
import { syncPayloads } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

interface PluginImage {
  name: string;
  fileName: string;
  mimeType: string;
  base64: string;
  scale?: number;
}

interface ImageMeta {
  name: string;
  fileName: string;
  mimeType: string;
  scale?: number;
  filePath: string;  // public/ 기준 상대 경로
  url: string;       // 브라우저 접근 URL
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { figmaFileKey, figmaFileName, images, outputPath } = await req.json() as {
    figmaFileKey: string;
    figmaFileName?: string;
    images: PluginImage[];
    outputPath?: string; // 플러그인에서 지정한 저장 경로 (예: "public/assets/images")
  };

  if (!figmaFileKey || !images) {
    return NextResponse.json({ error: 'figmaFileKey and images are required' }, { status: 400 });
  }

  const project = await ensureProject(figmaFileKey, figmaFileName);

  // ── 저장 경로 결정: 플러그인 지정 > DB 기본값 ─────────────────────
  const defaultStoragePath = await getImageStoragePath();
  // outputPath 지정 시에도 projectId 서브디렉토리 추가 (프로젝트 간 이미지 분리)
  const basePath = outputPath ?? defaultStoragePath;
  const effectivePath = `${basePath}/${project.id}`;
  const imageDir = path.resolve(process.cwd(), effectivePath);
  fs.mkdirSync(imageDir, { recursive: true });

  const metaList: ImageMeta[] = [];
  const errors: string[] = [];

  for (const img of images) {
    try {
      const buffer = Buffer.from(img.base64, 'base64');
      const filePath = path.join(imageDir, img.fileName);
      fs.writeFileSync(filePath, buffer);

      const relDir = effectivePath.replace(/^public\//, '').replace(/\/$/, '');
      metaList.push({
        name: img.name,
        fileName: img.fileName,
        mimeType: img.mimeType,
        scale: img.scale,
        filePath: `${relDir}/${img.fileName}`,
        url: `/${relDir}/${img.fileName}`,
      });
    } catch {
      errors.push(img.fileName);
    }
  }

  // ── 기존 메타데이터와 병합 (동일 fileName은 신규로 덮어씀) ─────────
  const existing = db
    .select({ data: syncPayloads.data })
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, project.id), eq(syncPayloads.type, 'images')))
    .orderBy(desc(syncPayloads.version))
    .limit(1)
    .get();

  let existingMeta: ImageMeta[] = [];
  if (existing) {
    try {
      const parsed = JSON.parse(existing.data) as ImageMeta[];
      // url 필드가 있는 신형 포맷만 병합 대상으로 사용
      if (parsed.length > 0 && 'url' in (parsed[0] as object)) {
        existingMeta = parsed;
      }
    } catch { /* 무시 */ }
  }

  const newFileNames = new Set(metaList.map((m) => m.fileName));
  const merged = [
    ...existingMeta.filter((m) => !newFileNames.has(m.fileName)), // 기존 중 신규와 겹치지 않는 것
    ...metaList,                                                   // 신규 (덮어씀 포함)
  ];

  // ── DB에는 메타데이터(경로)만 저장 ───────────────────────────────
  const { changed, version } = await upsertSyncPayload(project.id, 'images', merged);

  return NextResponse.json(
    {
      success: true,
      changed,
      version,
      tokenCount: merged.length,
      ...(errors.length > 0 && { errors }),
    },
    { headers: CORS_HEADERS },
  );
}
