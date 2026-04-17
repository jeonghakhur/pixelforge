'use server';

import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { db } from '@/lib/db';
import { syncPayloads } from '@/lib/db/schema';
import { and, eq, desc, like } from 'drizzle-orm';
import { getActiveProjectId } from '@/lib/db/active-project';
import { getIconOutputPath } from '@/lib/actions/settings';
import { removeIconFile, rebuildBarrelFromDisk, toComponentName, generateIconFiles, toPascalCase } from '@/lib/icons/generate';
import type { IconEntry } from '@/app/(main)/(ide)/icons/IconGrid';

// ── 섹션 타입 헬퍼 ──────────────────────────────────────────────────

const SECTION_PREFIX = 'icons:';
const FALLBACK_SECTION = '기타';

function sectionType(section: string): string {
  return `${SECTION_PREFIX}${section || FALLBACK_SECTION}`;
}

/** DB에서 모든 icons:* 섹션을 읽어 단일 배열로 병합 */
function loadAllIconsFromDb(projectId: string): IconEntry[] {
  const rows = db.select({ type: syncPayloads.type, data: syncPayloads.data, version: syncPayloads.version })
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), like(syncPayloads.type, `${SECTION_PREFIX}%`)))
    .all();

  // 섹션별 최신 버전만 유지
  const latestBySection = new Map<string, string>();
  const versionBySection = new Map<string, number>();
  for (const row of rows) {
    const prev = versionBySection.get(row.type) ?? -1;
    if (row.version > prev) {
      latestBySection.set(row.type, row.data);
      versionBySection.set(row.type, row.version);
    }
  }

  const all: IconEntry[] = [];
  for (const data of latestBySection.values()) {
    try { all.push(...(JSON.parse(data) as IconEntry[])); } catch { /* skip */ }
  }
  return all;
}

/** 섹션 단위로 최신 버전 row 조회 */
function getLatestSectionRow(projectId: string, section: string) {
  return db.select({ data: syncPayloads.data, version: syncPayloads.version })
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), eq(syncPayloads.type, sectionType(section))))
    .orderBy(desc(syncPayloads.version))
    .limit(1)
    .get();
}

/** 섹션 row 저장 (새 버전으로 insert) */
function saveSectionIcons(projectId: string, section: string, icons: IconEntry[]): void {
  const existing = getLatestSectionRow(projectId, section);
  const newVersion = (existing?.version ?? 0) + 1;
  const newHash = crypto.createHash('sha256').update(JSON.stringify(icons)).digest('hex');
  db.insert(syncPayloads).values({
    id: crypto.randomUUID(),
    projectId,
    type: sectionType(section),
    version: newVersion,
    contentHash: newHash,
    data: JSON.stringify(icons),
  }).run();
}

// ── 공개 액션 ───────────────────────────────────────────────────────

function resolvedComponentNameFromEntry(icon: IconEntry): string {
  if (icon.pascal) return toPascalCase(icon.pascal);
  return toComponentName(icon.name);
}


export async function getIconByComponentName(componentName: string): Promise<IconEntry | null> {
  const projectId = getActiveProjectId();
  if (!projectId) return null;

  const icons = loadAllIconsFromDb(projectId);

  // pascal 기반 그룹 우선 탐색
  const group = icons.filter((icon) => resolvedComponentNameFromEntry(icon) === componentName);
  if (!group.length) return null;

  // variant 통합 그룹 여부 판단 (generate.ts와 동일한 조건)
  const normalizedVariants = group.map((g) =>
    g.variants && g.variants.length === 1 ? g.variants[0].replace(/^type-/, '') : null,
  );
  const allUnique = new Set(normalizedVariants.filter(Boolean)).size === group.length;
  const isVariantGroup = group.length >= 2 && normalizedVariants.every((v) => v !== null) && allUnique;

  if (isVariantGroup) {
    // 통합 컴포넌트: 첫 번째(default) 아이콘에 variants 목록 주입
    const variantList = normalizedVariants.filter((v): v is string => v !== null);
    const defaultIcon = group.find((g) => g.variants?.[0]?.replace(/^type-/, '') === 'default') ?? group[0];
    return { ...defaultIcon, variants: variantList };
  }

  // 단일 컴포넌트: 기존 suffix 방식으로 매핑
  const nameCount = new Map<string, number>();
  for (const icon of icons) {
    const base = resolvedComponentNameFromEntry(icon);
    const count = nameCount.get(base) ?? 0;
    nameCount.set(base, count + 1);
    const resolved = count === 0 ? base : `${base}${count + 1}`;
    if (resolved === componentName) return icon;
  }
  return null;
}

export interface SvgIconInput {
  name: string;
  svg: string;
  section?: string;
}

export async function importIconsFromSvg(
  inputs: SvgIconInput[],
): Promise<{ error: string | null; added: number }> {
  if (!inputs.length) return { error: '추가할 아이콘이 없습니다.', added: 0 };

  const projectId = getActiveProjectId();
  if (!projectId) return { error: '활성 프로젝트가 없습니다.', added: 0 };

  // 섹션별로 그룹
  const bySection = new Map<string, IconEntry[]>();
  for (const input of inputs) {
    const sec = input.section?.trim() || FALLBACK_SECTION;
    if (!bySection.has(sec)) bySection.set(sec, []);
    bySection.get(sec)!.push({ name: input.name, svg: input.svg, section: sec });
  }

  for (const [section, newIcons] of bySection) {
    // 기존 섹션 데이터 로드 후 병합 (같은 name은 덮어쓰기)
    const existing = getLatestSectionRow(projectId, section);
    let current: IconEntry[] = [];
    if (existing) {
      try { current = JSON.parse(existing.data) as IconEntry[]; } catch { current = []; }
    }
    const map = new Map(current.map((e) => [e.name, e]));
    for (const icon of newIcons) map.set(icon.name, icon);
    saveSectionIcons(projectId, section, [...map.values()]);
  }

  // 전체 아이콘 목록으로 파일 재생성
  const all = loadAllIconsFromDb(projectId);
  const outputPath = await getIconOutputPath();
  const absPath = path.resolve(process.cwd(), outputPath);
  generateIconFiles(all as { name: string; svg: string }[], absPath);

  return { error: null, added: inputs.length };
}

export async function deleteAllIcons(): Promise<{ error: string | null }> {
  const projectId = getActiveProjectId();
  if (!projectId) return { error: '활성 프로젝트가 없습니다.' };

  // 모든 icons:* 섹션 삭제
  const rows = db.select({ id: syncPayloads.id })
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), like(syncPayloads.type, `${SECTION_PREFIX}%`)))
    .all();

  for (const row of rows) {
    db.delete(syncPayloads).where(eq(syncPayloads.id, row.id)).run();
  }

  const outputPath = await getIconOutputPath();
  const absPath = path.resolve(process.cwd(), outputPath);
  try {
    if (fs.existsSync(absPath)) {
      for (const entry of fs.readdirSync(absPath)) {
        if (entry.startsWith('Icon')) {
          fs.rmSync(path.join(absPath, entry), { recursive: true, force: true });
        }
      }
    } else {
      fs.mkdirSync(absPath, { recursive: true });
    }
    fs.writeFileSync(
      path.join(absPath, 'index.ts'),
      '// Auto-generated — do not edit manually\nexport {};\n',
      'utf-8',
    );
  } catch { /* non-blocking */ }

  return { error: null };
}

export async function deleteIcon(figmaName: string, componentName: string): Promise<{ error: string | null }> {
  const projectId = getActiveProjectId();
  if (!projectId) return { error: '활성 프로젝트가 없습니다.' };

  // 해당 아이콘이 속한 섹션 row 찾기
  const rows = db.select({ type: syncPayloads.type, data: syncPayloads.data, version: syncPayloads.version })
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), like(syncPayloads.type, `${SECTION_PREFIX}%`)))
    .all();

  // 섹션별 최신 버전
  const latestMap = new Map<string, { data: string; version: number }>();
  for (const row of rows) {
    const prev = latestMap.get(row.type);
    if (!prev || row.version > prev.version) latestMap.set(row.type, { data: row.data, version: row.version });
  }

  let found = false;
  for (const [sectionType, { data, version }] of latestMap) {
    let icons: IconEntry[] = [];
    try { icons = JSON.parse(data) as IconEntry[]; } catch { continue; }

    const filtered = icons.filter((i) => i.name !== figmaName);
    if (filtered.length === icons.length) continue;

    found = true;
    const section = sectionType.slice(SECTION_PREFIX.length);
    const newHash = crypto.createHash('sha256').update(JSON.stringify(filtered)).digest('hex');
    db.insert(syncPayloads).values({
      id: crypto.randomUUID(),
      projectId,
      type: sectionType,
      version: version + 1,
      contentHash: newHash,
      data: JSON.stringify(filtered),
    }).run();

    const outputPath = await getIconOutputPath();
    const absPath = path.resolve(process.cwd(), outputPath);
    removeIconFile(componentName, absPath);
    rebuildBarrelFromDisk(absPath);

    void section;
    break;
  }

  if (!found) return { error: '해당 아이콘을 찾을 수 없습니다.' };
  return { error: null };
}

/** 페이지 서버 컴포넌트에서 전체 아이콘 목록 조회 */
export async function getAllIcons(): Promise<{ icons: IconEntry[]; syncedAt: Date | null }> {
  const projectId = getActiveProjectId();
  if (!projectId) return { icons: [], syncedAt: null };

  const rows = db.select({ type: syncPayloads.type, data: syncPayloads.data, version: syncPayloads.version, createdAt: syncPayloads.createdAt })
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), like(syncPayloads.type, `${SECTION_PREFIX}%`)))
    .all();

  if (!rows.length) return { icons: [], syncedAt: null };

  const latestMap = new Map<string, { data: string; version: number; createdAt: unknown }>();
  for (const row of rows) {
    const prev = latestMap.get(row.type as string);
    if (!prev || row.version > prev.version) latestMap.set(row.type as string, row);
  }

  const all: IconEntry[] = [];
  let latestDate: Date | null = null;
  for (const row of latestMap.values()) {
    try { all.push(...(JSON.parse(row.data) as IconEntry[])); } catch { /* skip */ }
    const d = row.createdAt ? new Date((row.createdAt as number) * 1000) : null;
    if (d && (!latestDate || d > latestDate)) latestDate = d;
  }

  return { icons: all, syncedAt: latestDate };
}
