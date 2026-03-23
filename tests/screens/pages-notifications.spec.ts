import { test, expect } from '@playwright/test';

// @generated screen-dashboard — 수동 수정 시 @custom 블록 안에 작성
// 이 파일은 syncScreensAction() 실행 시 재생성됩니다

test.describe('알림', () => {
  test('페이지 접근 및 렌더링', async ({ page }) => {
    await page.goto('/pages/notifications');
    await expect(page).toHaveURL('/pages/notifications');
    await page.screenshot({
      path: 'test-results/screens/pages-notifications.png',
      fullPage: true,
    });
  });

  test('기본 레이아웃 요소 존재', async ({ page }) => {
    await page.goto('/pages/notifications');
    await expect(page.locator('main')).toBeVisible();
  });

  test('페이지 타이틀 존재', async ({ page }) => {
    await page.goto('/pages/notifications');
    await expect(page).toHaveTitle(/.+/);
  });

  // @custom — 아래에 커스텀 테스트 추가 (재생성 시 보존됨)
});
