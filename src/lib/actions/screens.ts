'use server';

import { db } from '@/lib/db';
import { screens } from '@/lib/db/schema';
import { eq, ne } from 'drizzle-orm';
import { scanPageFiles } from '@/lib/screens/file-scanner';
import { existsSync } from 'fs';
import { generateAllSpecs } from '@/lib/screens/playwright-generator';
import { getFileGitDates, getFileGitLog, getCommitSource, getCommitDiff, getCommitParentDiff } from '@/lib/screens/git-history';
import type { GitCommit } from '@/lib/screens/git-history';
import { getSession } from '@/lib/auth/session';
import { FigmaClient, extractFileKey, extractNodeId } from '@/lib/figma/api';
import { getFigmaToken } from '@/lib/config/index';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// ===========================
// 공개 타입 (UI에서 import)
// ===========================
export type ScreenStatus = 'wip' | 'dev-done' | 'qa-ready' | 'qa-done';

export interface ScreenListItem {
  id: string;
  route: string;
  name: string;
  description: string | null;
  authors: string[];
  category: string | null;
  status: ScreenStatus;
  sinceDate: string | null;
  updatedDate: string | null;
  figmaUrl: string | null;
  figmaScreenshot: string | null;
  implScreenshot: string | null;
  visible: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;     // ISO date string (표시용)
  playwrightStatus: 'pending' | 'pass' | 'fail' | 'skip';
  playwrightScore: number | null;
  displayOrder: string | null;
  updatedAt: Date;
}

export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  total: number;
}

export interface FigmaCaptureResult {
  screenshotPath: string;
}

export interface AvailableRoute {
  route: string;
  filePath: string;
  suggestedName: string | null;
  suggestedDescription: string | null;
  suggestedAuthors: string[];
  suggestedCategory: string | null;
  suggestedStatus: ScreenStatus;
}

// ===========================
// 내부 헬퍼
// ===========================
function rowToListItem(row: typeof screens.$inferSelect): ScreenListItem {
  return {
    id: row.id,
    route: row.route,
    name: row.name,
    description: row.description ?? null,
    authors: row.authors ? (JSON.parse(row.authors) as string[]) : [],
    category: row.category ?? null,
    status: row.status as ScreenStatus,
    sinceDate: row.sinceDate ?? null,
    updatedDate: row.updatedDate ?? null,
    figmaUrl: row.figmaUrl ?? null,
    figmaScreenshot: row.figmaScreenshot ?? null,
    implScreenshot: row.implScreenshot ?? null,
    visible: row.visible ?? true,
    reviewedBy: row.reviewedBy ?? null,
    reviewedAt: row.reviewedAt
      ? (row.reviewedAt instanceof Date ? row.reviewedAt : new Date(row.reviewedAt as number * 1000))
          .toISOString().slice(0, 10)
      : null,
    playwrightStatus: (row.playwrightStatus ?? 'pending') as ScreenListItem['playwrightStatus'],
    playwrightScore: row.playwrightScore ?? null,
    displayOrder: row.displayOrderKey ?? null,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
  };
}

// ===========================
// Server Actions
// ===========================

/**
 * 파일 시스템에 존재하지만 아직 DB에 등록되지 않은 라우트 목록을 반환한다.
 * AddScreenModal에서 라우트 선택 드롭다운에 사용.
 */
export async function getAvailableRoutesAction(): Promise<AvailableRoute[]> {
  const metas = await scanPageFiles();
  const existing = await db.select({ route: screens.route }).from(screens);
  const registeredRoutes = new Set(existing.map((r) => r.route));

  return metas
    .filter((m) => !registeredRoutes.has(m.route))
    .map((m) => ({
      route: m.route,
      filePath: m.filePath,
      suggestedName: m.name || null,
      suggestedDescription: m.description,
      suggestedAuthors: m.authors,
      suggestedCategory: m.category,
      suggestedStatus: m.status,
    }));
}

/**
 * UI에서 직접 화면을 등록한다.
 */
export async function createScreenAction(input: {
  name: string;
  description?: string;
  route: string;
  filePath: string;
  authors?: string[];
  category?: string;
  status: ScreenStatus;
  figmaUrl?: string;
  visible: boolean;
}): Promise<ScreenListItem> {
  // 실제 파일 존재 여부 검증
  const absPath = path.join(process.cwd(), input.filePath);
  if (!existsSync(absPath)) {
    throw new Error(`파일이 존재하지 않습니다: ${input.filePath}`);
  }

  const now = new Date();
  const id = crypto.randomUUID();
  await db.insert(screens).values({
    id,
    route: input.route,
    filePath: input.filePath,
    name: input.name,
    description: input.description ?? undefined,
    authors: JSON.stringify(input.authors ?? []),
    category: input.category ?? undefined,
    status: input.status,
    figmaUrl: input.figmaUrl ?? undefined,
    visible: input.visible,
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db.select().from(screens).where(eq(screens.id, id));
  return rowToListItem(rows[0]);
}

/**
 * 파일 시스템 스캔 후 DB upsert + 스캔에서 사라진 항목 삭제.
 * route 기준으로 기존 레코드는 업데이트, 신규는 insert, 파일이 없어진 건 delete.
 */
export async function syncScreensAction(): Promise<SyncResult> {
  const metas = await scanPageFiles();
  const existing = await db.select({ id: screens.id, route: screens.route }).from(screens);
  const routeMap = new Map(existing.map((r) => [r.route, r.id]));

  let added = 0;
  let updated = 0;
  let removed = 0;

  // 스캔 결과에 없는 기존 레코드 삭제
  const scannedRoutes = new Set(metas.map((m) => m.route));
  for (const [route, id] of routeMap) {
    if (!scannedRoutes.has(route)) {
      await db.delete(screens).where(eq(screens.id, id));
      removed++;
    }
  }

  for (const meta of metas) {
    const existingId = routeMap.get(meta.route);
    const now = new Date();

    // git에서 날짜 가져오기 (없으면 @since/@updated 태그 fallback)
    const gitDates = getFileGitDates(meta.filePath);
    const sinceDate   = gitDates.sinceDate   ?? meta.sinceDate   ?? undefined;
    const updatedDate = gitDates.updatedDate ?? meta.updatedDate ?? undefined;

    if (existingId) {
      await db.update(screens)
        .set({
          name: meta.name,
          description: meta.description ?? undefined,
          authors: JSON.stringify(meta.authors),
          category: meta.category ?? undefined,
          status: meta.status,
          sinceDate,
          updatedDate,
          figmaUrl: meta.figmaUrl ?? undefined,
          filePath: meta.filePath,
          updatedAt: now,
        })
        .where(eq(screens.id, existingId));
      updated++;
    } else {
      await db.insert(screens).values({
        id: crypto.randomUUID(),
        route: meta.route,
        filePath: meta.filePath,
        name: meta.name,
        description: meta.description ?? undefined,
        authors: JSON.stringify(meta.authors),
        category: meta.category ?? undefined,
        status: meta.status,
        sinceDate,
        updatedDate,
        figmaUrl: meta.figmaUrl ?? undefined,
        visible: meta.visible,   // 코드 @visible 태그가 초기값 결정
        createdAt: now,
        updatedAt: now,
      });
      added++;
    }
  }

  // spec 파일 자동 생성 (커스텀 블록 보존)
  await generateAllSpecs(metas);

  return { added, updated, removed, total: metas.length };
}

/**
 * 전체 화면 목록 조회.
 */
export async function getScreenListAction(filters?: {
  status?: ScreenStatus | 'all';
  category?: string | 'all';
}): Promise<ScreenListItem[]> {
  const rows = await db.select().from(screens);
  let items = rows.map(rowToListItem);

  if (filters?.status && filters.status !== 'all') {
    items = items.filter((s) => s.status === filters.status);
  }
  if (filters?.category && filters.category !== 'all') {
    items = items.filter((s) => s.category === filters.category);
  }

  // displayOrder 키 ASC (null은 맨 뒤), 같으면 route 알파벳 순
  // 포맷: "N" 또는 "N-M" — 숫자 파싱으로 정렬
  function parseKey(k: string): [number, number] {
    const [major, sub = '0'] = k.split('-');
    return [parseInt(major, 10), parseInt(sub, 10)];
  }
  return items.sort((a, b) => {
    if (a.displayOrder !== null && b.displayOrder !== null) {
      const [aM, aS] = parseKey(a.displayOrder);
      const [bM, bS] = parseKey(b.displayOrder);
      if (aM !== bM) return aM - bM;
      return aS - bS;
    }
    if (a.displayOrder !== null) return -1;
    if (b.displayOrder !== null) return 1;
    return a.route.localeCompare(b.route);
  });
}

/**
 * 화면 노출 순위 키를 저장한다.
 * 입력 포맷: "N" 또는 "N-M" (예: "2", "2-1")
 * 중복 발생 시 "N-1", "N-2" ... 순으로 자동 배정.
 * 반환값: 실제 저장된 키 (자동 조정됐을 수 있음)
 */
export async function updateScreenOrderAction(
  id: string,
  orderKey: string | null,
): Promise<{ assigned: string | null }> {
  if (!orderKey) {
    await db.update(screens)
      .set({ displayOrderKey: null, updatedAt: new Date() })
      .where(eq(screens.id, id));
    return { assigned: null };
  }

  // 포맷 검증: "N" 또는 "N-M"
  const match = orderKey.trim().match(/^(\d+)(?:-(\d+))?$/);
  if (!match) throw new Error('올바른 형식이 아닙니다 (예: 2 또는 2-1)');

  const major = parseInt(match[1], 10);
  const explicitSub = match[2] !== undefined ? parseInt(match[2], 10) : null;

  // 다른 화면들의 순위 키 수집
  const others = await db
    .select({ displayOrderKey: screens.displayOrderKey })
    .from(screens)
    .where(ne(screens.id, id));
  const takenKeys = new Set(
    others.map((r) => r.displayOrderKey).filter((k): k is string => k !== null),
  );

  let assigned: string;

  if (explicitSub !== null) {
    // "N-M" 명시적 입력 — 충돌 시 M+1, M+2 ...
    let sub = explicitSub;
    while (takenKeys.has(`${major}-${sub}`)) sub++;
    assigned = `${major}-${sub}`;
  } else {
    // "N" 입력 — "N"이 비어있으면 그대로, 아니면 "N-1", "N-2" ...
    if (!takenKeys.has(`${major}`)) {
      assigned = `${major}`;
    } else {
      let sub = 1;
      while (takenKeys.has(`${major}-${sub}`)) sub++;
      assigned = `${major}-${sub}`;
    }
  }

  await db.update(screens)
    .set({ displayOrderKey: assigned, updatedAt: new Date() })
    .where(eq(screens.id, id));

  return { assigned };
}

/**
 * 모든 화면의 git 날짜(sinceDate / updatedDate)만 갱신한다.
 * 전체 syncScreensAction보다 훨씬 가볍고, 화면 목록 진입 시 자동 호출된다.
 */
export async function refreshScreenDatesAction(): Promise<void> {
  const rows = await db
    .select({ id: screens.id, filePath: screens.filePath })
    .from(screens);

  for (const row of rows) {
    const { sinceDate, updatedDate } = getFileGitDates(row.filePath);
    if (sinceDate || updatedDate) {
      await db.update(screens)
        .set({
          ...(sinceDate   ? { sinceDate }   : {}),
          ...(updatedDate ? { updatedDate } : {}),
        })
        .where(eq(screens.id, row.id));
    }
  }
}

/**
 * 단건 화면 상세 조회.
 */
export async function getScreenDetailAction(id: string): Promise<ScreenListItem | null> {
  const rows = await db.select().from(screens).where(eq(screens.id, id));
  return rows[0] ? rowToListItem(rows[0]) : null;
}

/**
 * Figma URL을 DB에 저장한다.
 */
export async function updateFigmaUrlAction(id: string, figmaUrl: string): Promise<void> {
  await db.update(screens)
    .set({ figmaUrl: figmaUrl || null, updatedAt: new Date() })
    .where(eq(screens.id, id));
}

/**
 * Figma URL로 스크린샷을 캡처하여 public/screens/ 저장 후 DB 업데이트.
 */
export async function captureFigmaScreenshotAction(
  id: string,
  figmaUrl: string,
): Promise<FigmaCaptureResult> {
  const token = getFigmaToken();
  if (!token) throw new Error('Figma 토큰이 설정되지 않았습니다');

  const fileKey = extractFileKey(figmaUrl);
  const nodeId = extractNodeId(figmaUrl);
  if (!fileKey) throw new Error('Figma URL에서 파일 키를 추출할 수 없습니다');
  if (!nodeId) throw new Error('Figma URL에 node-id가 없습니다. 특정 프레임 URL을 사용해주세요 (?node-id=...)');

  const client = new FigmaClient(token);
  const imagesRes = await client.getImages(fileKey, [nodeId], 'png');
  const imageUrl = imagesRes.images[nodeId];
  if (!imageUrl) throw new Error('Figma 이미지를 가져올 수 없습니다');

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`이미지 다운로드 실패: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  const screensDir = path.join(process.cwd(), 'public', 'screens');
  await mkdir(screensDir, { recursive: true });

  const fileName = `${id}-figma.png`;
  await writeFile(path.join(screensDir, fileName), buffer);

  const screenshotPath = `/screens/${fileName}`;
  await db.update(screens)
    .set({ figmaScreenshot: screenshotPath, updatedAt: new Date() })
    .where(eq(screens.id, id));

  return { screenshotPath };
}

/**
 * Playwright 결과를 DB에 저장.
 */
export async function updatePlaywrightResultAction(
  id: string,
  result: { status: 'pass' | 'fail'; score: number; report: object },
): Promise<void> {
  await db.update(screens)
    .set({
      playwrightStatus: result.status,
      playwrightScore: result.score,
      playwrightReport: JSON.stringify(result.report),
      updatedAt: new Date(),
    })
    .where(eq(screens.id, id));
}

/**
 * 현재 로그인한 사용자 정보를 반환한다.
 */
export async function getCurrentUserAction(): Promise<{
  userId: string;
  email: string;
  role: 'admin' | 'member';
} | null> {
  const session = await getSession();
  if (!session.isLoggedIn) return null;
  return { userId: session.userId, email: session.email, role: session.role };
}

/**
 * 화면 상태(status)를 수동으로 변경.
 * 로그인 사용자를 검수자로 자동 등록한다.
 */
export async function updateScreenStatusAction(
  id: string,
  status: ScreenStatus,
): Promise<void> {
  const session = await getSession();
  const now = new Date();
  await db.update(screens)
    .set({
      status,
      reviewedBy: session.isLoggedIn ? session.email : undefined,
      reviewedAt: session.isLoggedIn ? now : undefined,
      updatedAt: now,
    })
    .where(eq(screens.id, id));
}

/**
 * 노출(visible=true) 화면 목록만 반환. 일반 사용자 / 공유용 뷰에 사용.
 */
export async function getPublicScreenListAction(filters?: {
  status?: ScreenStatus | 'all';
}): Promise<ScreenListItem[]> {
  const rows = await db.select().from(screens).where(eq(screens.visible, true));
  let items = rows.map(rowToListItem);
  if (filters?.status && filters.status !== 'all') {
    items = items.filter((s) => s.status === filters.status);
  }
  return items.sort((a, b) => a.route.localeCompare(b.route));
}

/**
 * 화면 노출 여부를 수동으로 변경 (관리자 전용).
 */
export async function updateScreenVisibilityAction(
  id: string,
  visible: boolean,
): Promise<void> {
  await db.update(screens)
    .set({ visible, updatedAt: new Date() })
    .where(eq(screens.id, id));
}

/**
 * 파일의 git 커밋 이력을 반환한다 (최신 10건).
 */
export async function getFileGitLogAction(id: string): Promise<GitCommit[]> {
  const rows = await db
    .select({ filePath: screens.filePath })
    .from(screens)
    .where(eq(screens.id, id));
  if (!rows[0]) return [];
  return getFileGitLog(rows[0].filePath);
}

const LANG_MAP: Record<string, string> = {
  tsx: 'typescript', ts: 'typescript',
  jsx: 'javascript', js: 'javascript',
  scss: 'scss', css: 'css',
  json: 'json', md: 'markdown',
};

/**
 * 특정 커밋 시점의 파일 소스를 반환한다.
 */
export async function getCommitSourceAction(
  screenId: string,
  hash: string,
): Promise<{ source: string; language: string }> {
  const rows = await db
    .select({ filePath: screens.filePath })
    .from(screens)
    .where(eq(screens.id, screenId));
  if (!rows[0]) throw new Error('화면을 찾을 수 없습니다');
  const source = getCommitSource(rows[0].filePath, hash);
  const ext = rows[0].filePath.split('.').pop() ?? 'tsx';
  return { source, language: LANG_MAP[ext] ?? 'typescript' };
}

/**
 * 해당 커밋이 부모 대비 변경한 diff를 반환한다. (GitHub 커밋 뷰)
 */
export async function getCommitParentDiffAction(
  screenId: string,
  hash: string,
): Promise<string> {
  const rows = await db
    .select({ filePath: screens.filePath })
    .from(screens)
    .where(eq(screens.id, screenId));
  if (!rows[0]) throw new Error('화면을 찾을 수 없습니다');
  return getCommitParentDiff(rows[0].filePath, hash);
}

/**
 * 두 커밋 사이의 unified diff를 반환한다.
 */
export async function getCommitDiffAction(
  screenId: string,
  hashA: string,
  hashB: string,
): Promise<string> {
  const rows = await db
    .select({ filePath: screens.filePath })
    .from(screens)
    .where(eq(screens.id, screenId));
  if (!rows[0]) throw new Error('화면을 찾을 수 없습니다');
  return getCommitDiff(rows[0].filePath, hashA, hashB);
}
