import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth/api-key';
import { ensureProject, upsertSyncPayload } from '@/lib/sync/upsert-payload';
import { CORS_HEADERS } from '@/lib/sync/cors';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { figmaFileKey, figmaFileName, images } = await req.json();
  if (!figmaFileKey || !images) {
    return NextResponse.json({ error: 'figmaFileKey and images are required' }, { status: 400 });
  }

  const project = await ensureProject(figmaFileKey, figmaFileName);
  const { changed, version } = await upsertSyncPayload(project.id, 'images', images);

  return NextResponse.json({ success: true, changed, version, tokenCount: images.length }, { headers: CORS_HEADERS });
}
