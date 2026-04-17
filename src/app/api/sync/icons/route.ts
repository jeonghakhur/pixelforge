import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth/api-key';
import { ensureProject, upsertSyncPayload } from '@/lib/sync/upsert-payload';
import { CORS_HEADERS } from '@/lib/sync/cors';
import { generateIconFiles, type IconInput } from '@/lib/icons/generate';
import { db } from '@/lib/db';
import { appSettings, syncPayloads } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { ICON_OUTPUT_DEFAULT } from '@/lib/constants/icons';

interface IconPayload {
  name: string;
  svg: string;
  section?: string;
  [key: string]: unknown;
}

/** 기존 DB row에서 name → section 매핑을 추출 */
function buildSectionMap(projectId: string): Map<string, string> {
  const existing = db.select({ data: syncPayloads.data })
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), eq(syncPayloads.type, 'icons')))
    .orderBy(desc(syncPayloads.version))
    .limit(1)
    .get();

  if (!existing) return new Map();
  try {
    const icons = JSON.parse(existing.data) as IconPayload[];
    return new Map(
      icons.filter((i) => i.section).map((i) => [i.name, i.section!]),
    );
  } catch {
    return new Map();
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const apiKey = await validateApiKey(req);
  if (!apiKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { figmaFileKey, figmaFileName, icons } = await req.json() as {
    figmaFileKey: string;
    figmaFileName?: string;
    icons: IconPayload[];
  };

  if (!figmaFileKey || !icons) {
    return NextResponse.json({ error: 'figmaFileKey and icons are required' }, { status: 400 });
  }

  const project = await ensureProject(figmaFileKey, figmaFileName);

  // 플러그인이 section을 보내지 않을 경우 기존 DB 데이터에서 병합
  const needsMerge = icons.some((i) => !i.section);
  const enriched: IconPayload[] = needsMerge
    ? (() => {
        const sectionMap = buildSectionMap(project.id);
        return icons.map((i) => ({
          ...i,
          section: i.section ?? sectionMap.get(i.name),
        }));
      })()
    : icons;

  const { changed, version } = await upsertSyncPayload(project.id, 'icons', enriched);

  if (changed) {
    const row = db.select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, 'icon_output_path'))
      .get();
    const outputPath = row?.value ?? ICON_OUTPUT_DEFAULT;

    try {
      generateIconFiles(enriched as IconInput[], outputPath);
    } catch {
      // 파일 생성 실패는 DB 저장 결과에 영향 주지 않음
    }
  }

  return NextResponse.json({ success: true, changed, version, tokenCount: enriched.length }, { headers: CORS_HEADERS });
}
