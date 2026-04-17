import { NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth/api-key';
import { ensureProject } from '@/lib/sync/upsert-payload';
import { CORS_HEADERS } from '@/lib/sync/cors';
import { generateIconFiles, type IconInput } from '@/lib/icons/generate';
import { db } from '@/lib/db';
import { appSettings, syncPayloads } from '@/lib/db/schema';
import { eq, and, like, desc } from 'drizzle-orm';
import { ICON_OUTPUT_DEFAULT } from '@/lib/constants/icons';
import crypto from 'crypto';

const SECTION_PREFIX = 'icons:';
const FALLBACK_SECTION = '기타';

interface IconPayload {
  name: string;
  svg: string;
  section?: string;
  [key: string]: unknown;
}

/** 기존 DB의 모든 icons:* 섹션에서 name → section 매핑 추출 */
function buildSectionMap(projectId: string): Map<string, string> {
  const rows = db.select({ type: syncPayloads.type, data: syncPayloads.data, version: syncPayloads.version })
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), like(syncPayloads.type, `${SECTION_PREFIX}%`)))
    .all();

  const latestMap = new Map<string, { data: string; version: number }>();
  for (const row of rows) {
    const prev = latestMap.get(row.type);
    if (!prev || row.version > prev.version) latestMap.set(row.type, { data: row.data, version: row.version });
  }

  const result = new Map<string, string>();
  for (const [sectionType, { data }] of latestMap) {
    const section = sectionType.slice(SECTION_PREFIX.length);
    try {
      const icons = JSON.parse(data) as IconPayload[];
      for (const icon of icons) result.set(icon.name, section);
    } catch { /* skip */ }
  }
  return result;
}

/** 섹션별 아이콘을 sync_payloads에 upsert. 변경된 섹션 수 반환 */
function upsertSectionPayloads(projectId: string, bySection: Map<string, IconPayload[]>): number {
  let changed = 0;
  for (const [section, icons] of bySection) {
    const sectionType = `${SECTION_PREFIX}${section}`;
    const hash = crypto.createHash('sha256').update(JSON.stringify(icons)).digest('hex');

    const existing = db.select({ version: syncPayloads.version, contentHash: syncPayloads.contentHash })
      .from(syncPayloads)
      .where(and(eq(syncPayloads.projectId, projectId), eq(syncPayloads.type, sectionType)))
      .orderBy(desc(syncPayloads.version))
      .limit(1)
      .get();

    if (existing?.contentHash === hash) continue;

    const nextVersion = (existing?.version ?? 0) + 1;
    db.insert(syncPayloads).values({
      id: crypto.randomUUID(),
      projectId,
      type: sectionType,
      version: nextVersion,
      contentHash: hash,
      data: JSON.stringify(icons),
    }).run();
    changed++;
  }
  return changed;
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
          section: i.section ?? sectionMap.get(i.name) ?? FALLBACK_SECTION,
        }));
      })()
    : icons.map((i) => ({ ...i, section: i.section ?? FALLBACK_SECTION }));

  // 섹션별 그룹화 후 upsert
  const bySection = new Map<string, IconPayload[]>();
  for (const icon of enriched) {
    const sec = (icon.section as string) || FALLBACK_SECTION;
    if (!bySection.has(sec)) bySection.set(sec, []);
    bySection.get(sec)!.push(icon);
  }

  const changedCount = upsertSectionPayloads(project.id, bySection);

  if (changedCount > 0) {
    const row = db.select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, 'icon_output_path'))
      .get();
    const outputPath = row?.value ?? ICON_OUTPUT_DEFAULT;

    // 섹션별 최신 버전만 유지하여 전체 아이콘 병합 — JSON 임포트 데이터도 포함
    const allRows = db.select({ type: syncPayloads.type, data: syncPayloads.data, version: syncPayloads.version })
      .from(syncPayloads)
      .where(and(eq(syncPayloads.projectId, project.id), like(syncPayloads.type, `${SECTION_PREFIX}%`)))
      .all();

    const latestMap = new Map<string, { data: string; version: number }>();
    for (const r of allRows) {
      const prev = latestMap.get(r.type);
      if (!prev || r.version > prev.version) latestMap.set(r.type, { data: r.data, version: r.version });
    }

    const allIcons: IconPayload[] = [];
    for (const { data } of latestMap.values()) {
      try { allIcons.push(...(JSON.parse(data) as IconPayload[])); } catch { /* skip */ }
    }

    try {
      generateIconFiles(allIcons as IconInput[], outputPath);
    } catch {
      // 파일 생성 실패는 DB 저장 결과에 영향 주지 않음
    }
  }

  return NextResponse.json(
    { success: true, changed: changedCount > 0, sections: bySection.size, tokenCount: enriched.length },
    { headers: CORS_HEADERS },
  );
}
