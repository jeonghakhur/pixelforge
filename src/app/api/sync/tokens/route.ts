import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { validateApiKey } from '@/lib/auth/api-key';
import { db } from '@/lib/db';
import { projects, tokenSnapshots } from '@/lib/db/schema';
import { CORS_HEADERS } from '@/lib/sync/cors';
import { eq, desc } from 'drizzle-orm';
import { parseVariablesPayload } from '@/lib/sync/parse-variables';
import { runTokenPipeline } from '@/lib/tokens/pipeline';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
  }

  const body = await req.json();
  const { figmaFileKey, figmaFileName, figmaVersion, tokens: tokenData } = body;

  if (!figmaFileKey || !tokenData) {
    return NextResponse.json(
      { error: 'figmaFileKey and tokens are required' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // 프로젝트 조회 또는 생성
  let project = await db.select().from(projects).where(eq(projects.figmaKey, figmaFileKey)).get();
  if (!project) {
    const id = crypto.randomUUID();
    await db.insert(projects).values({
      id,
      name: figmaFileName || figmaFileKey,
      figmaKey: figmaFileKey,
    });
    project = await db.select().from(projects).where(eq(projects.id, id)).get();
  }

  const projectId = project!.id;

  // 해시 비교 — 동일하면 저장 안 함
  const newHash = crypto.createHash('sha256').update(JSON.stringify(tokenData)).digest('hex');
  const latestSnapshot = await db
    .select()
    .from(tokenSnapshots)
    .where(eq(tokenSnapshots.projectId, projectId))
    .orderBy(desc(tokenSnapshots.version))
    .limit(1)
    .get();

  if (latestSnapshot?.tokensData) {
    const existingHash = crypto
      .createHash('sha256')
      .update(latestSnapshot.tokensData)
      .digest('hex');
    if (existingHash === newHash) {
      return NextResponse.json(
        { success: true, changed: false, version: latestSnapshot.version },
        { headers: CORS_HEADERS },
      );
    }
  }

  // 파싱 → 파이프라인 실행
  const normalizedTokens = parseVariablesPayload(tokenData);

  const result = await runTokenPipeline(projectId, normalizedTokens, {
    source: 'variables',
    figmaKey: figmaFileKey,
    figmaVersion: figmaVersion ?? undefined,
  });

  return NextResponse.json(
    {
      success: true,
      changed: true,
      version: result.version,
      tokenCount: normalizedTokens.length,
      tokenCounts: result.tokenCounts,
      diff: result.diff,
      screenshotQueued: result.screenshotQueued,
    },
    { headers: CORS_HEADERS },
  );
}
