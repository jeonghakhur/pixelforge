import { readFile } from 'fs/promises';
import fg from 'fast-glob';
import path from 'path';
import { parsePageComment, type ScreenMeta } from './comment-parser';

/**
 * Next.js App Router 파일 경로 → 라우트 문자열 변환
 *
 * 변환 규칙:
 *   src/app/(ide)/settings/page.tsx  →  /settings
 *   src/app/(ide)/page.tsx           →  /
 *   src/app/(auth)/login/page.tsx    →  /login
 *   src/app/viewer/page.tsx          →  /viewer
 *   src/app/(ide)/tokens/[type]/page.tsx  →  /tokens/[type]
 */
export function extractRoute(filePath: string): string {
  // 정규화: 백슬래시 → 슬래시
  const normalized = filePath.replace(/\\/g, '/');

  // src/app/ 이후 부분 추출
  const match = normalized.match(/src\/app\/(.+)\/page\.tsx$/);
  if (!match) return '/';

  let routePath = match[1];

  // Route Group (xxx) 제거: (ide)/ (auth)/ 등
  routePath = routePath.replace(/\([^)]+\)\//g, '');

  // 남은 경로가 비어있으면 루트
  if (!routePath) return '/';

  return `/${routePath}`;
}

/**
 * src/app 하위 모든 page.tsx를 스캔하여 ScreenMeta 목록 반환.
 * @page 주석이 없는 파일은 제외한다.
 */
export async function scanPageFiles(): Promise<ScreenMeta[]> {
  const cwd = process.cwd();

  // (ide)/pages/ 하위 실제 작업 페이지만 스캔
  // src/app/(ide)/pages/page.tsx 자체(목록 UI)는 제외
  const files = await fg(
    ['src/app/\\(ide\\)/pages/**/page.tsx', '!src/app/\\(ide\\)/pages/page.tsx'],
    { cwd, onlyFiles: true },
  );

  const results: ScreenMeta[] = [];

  await Promise.all(
    files.map(async (relPath: string) => {
      const absPath = path.join(cwd, relPath);
      try {
        const content = await readFile(absPath, 'utf-8');
        const meta = parsePageComment(relPath, content);
        if (!meta) return;

        meta.route = extractRoute(relPath);
        meta.filePath = relPath;
        results.push(meta);
      } catch {
        // 읽기 실패 파일 스킵
      }
    }),
  );

  // route 기준 정렬
  results.sort((a, b) => a.route.localeCompare(b.route));
  return results;
}
