import { test, expect } from '@playwright/test';

// @generated screen-dashboard — 수동 수정 시 @custom 블록 안에 작성
// 이 파일은 syncScreensAction() 실행 시 재생성됩니다

test.describe('홈 대시보드', () => {
  test('페이지 접근 및 렌더링', async ({ page }) => {
    await page.goto('/pages/home');
    await expect(page).toHaveURL('/pages/home');
    await page.screenshot({
      path: 'test-results/screens/pages-home.png',
      fullPage: true,
    });
  });

  test('기본 레이아웃 요소 존재', async ({ page }) => {
    await page.goto('/pages/home');
    await expect(page.locator('main')).toBeVisible();
  });

  test('페이지 타이틀 존재', async ({ page }) => {
    await page.goto('/pages/home');
    await expect(page).toHaveTitle(/.+/);
  });

  // @custom — 아래에 커스텀 테스트 추가 (재생성 시 보존됨)

  test('Figma 디자인 — 메인 헤딩 표시', async ({ page }) => {
    await page.goto('/pages/home');
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('디자인 시스템');
  });

  test('Figma 디자인 — 스텝 번호 01 표시', async ({ page }) => {
    await page.goto('/pages/home');
    await expect(page.getByText('01')).toBeVisible();
  });

  test('Figma 디자인 — 소제목 표시', async ({ page }) => {
    await page.goto('/pages/home');
    await expect(page.getByText('디자인 시스템과 라이브러리 알아보기')).toBeVisible();
  });

  test('Figma 디자인 — 스텝 타이틀 표시', async ({ page }) => {
    await page.goto('/pages/home');
    await expect(page.getByText('Figma mcp로 디자인 시스템 구성하기')).toBeVisible();
  });

  test('Figma 디자인 — 배경 이미지 렌더링', async ({ page }) => {
    await page.goto('/pages/home');
    const img = page.locator('img[alt="디자인 시스템 소개 배경"]');
    await expect(img).toBeVisible();
  });

  test('Figma 디자인 — 로고 표시', async ({ page }) => {
    await page.goto('/pages/home');
    await expect(page.getByText('Figma pedia')).toBeVisible();
  });
});
