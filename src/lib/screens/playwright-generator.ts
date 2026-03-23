import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { ScreenMeta } from './comment-parser';

/** /settings → settings, /tokens/[type] → tokens-type */
export function routeToSlug(route: string): string {
  return route
    .replace(/^\//, '')        // 앞 슬래시 제거
    .replace(/\[([^\]]+)\]/g, '$1')  // [type] → type
    .replace(/\//g, '-')       // / → -
    || 'index';
}

function getSpecPath(route: string): string {
  const slug = routeToSlug(route);
  return path.join(process.cwd(), 'tests', 'screens', `${slug}.spec.ts`);
}

function generateSpecContent(screen: ScreenMeta): string {
  const slug = routeToSlug(screen.route);
  return `import { test, expect } from '@playwright/test';

// @generated screen-dashboard — 수동 수정 시 @custom 블록 안에 작성
// 이 파일은 syncScreensAction() 실행 시 재생성됩니다

test.describe('${screen.name}', () => {
  test('페이지 접근 및 렌더링', async ({ page }) => {
    await page.goto('${screen.route}');
    await expect(page).toHaveURL('${screen.route}');
    await page.screenshot({
      path: 'test-results/screens/${slug}.png',
      fullPage: true,
    });
  });

  test('기본 레이아웃 요소 존재', async ({ page }) => {
    await page.goto('${screen.route}');
    await expect(page.locator('main')).toBeVisible();
  });

  test('페이지 타이틀 존재', async ({ page }) => {
    await page.goto('${screen.route}');
    await expect(page).toHaveTitle(/.+/);
  });

  // @custom — 아래에 커스텀 테스트 추가 (재생성 시 보존됨)
});
`;
}

/**
 * spec 파일을 생성한다.
 * 이미 존재하고 @custom 블록이 있으면 그 이후 내용을 보존한다.
 */
export async function writeSpecFile(screen: ScreenMeta): Promise<void> {
  const specPath = getSpecPath(screen.route);
  const specDir = path.dirname(specPath);

  await mkdir(specDir, { recursive: true });

  if (existsSync(specPath)) {
    const existing = await readFile(specPath, 'utf-8');
    const customMarker = '  // @custom';
    const customIdx = existing.indexOf(customMarker);
    if (customIdx !== -1) {
      const customBlock = existing.slice(customIdx);
      const generated = generateSpecContent(screen);
      const baseIdx = generated.indexOf(customMarker);
      const merged = generated.slice(0, baseIdx) + customBlock;
      await writeFile(specPath, merged, 'utf-8');
      return;
    }
  }

  await writeFile(specPath, generateSpecContent(screen), 'utf-8');
}

/**
 * ScreenMeta 배열 전체에 대해 spec 파일을 생성한다.
 */
export async function generateAllSpecs(screens: ScreenMeta[]): Promise<{ generated: number }> {
  await Promise.all(screens.map(writeSpecFile));
  return { generated: screens.length };
}
