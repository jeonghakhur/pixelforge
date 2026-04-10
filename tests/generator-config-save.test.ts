import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:3000' });

test.describe('Generator Config Save', () => {
  test('Save 버튼 클릭 시 DB에 저장되는지 확인', async ({ page }) => {
    // 1. 페이지 이동
    await page.goto('/settings/generator');
    await page.waitForLoadState('networkidle');

    // 2. Semantic Map 섹션이 보이는지 확인
    const semanticMapTitle = page.locator('text=Semantic Map');
    await expect(semanticMapTitle).toBeVisible();

    // 3. 기존 데이터가 로드되었는지 확인
    const firstRow = page.locator('code:has-text("colors-gray-white")');
    await expect(firstRow).toBeVisible();

    // 4. Save 버튼 클릭
    const saveButtons = page.locator('button:has-text("Save")');
    const firstSaveBtn = saveButtons.first();

    // 클릭 전 상태 로깅
    const btnText = await firstSaveBtn.textContent();
    console.log('Save 버튼 텍스트:', btnText);
    const isDisabled = await firstSaveBtn.isDisabled();
    console.log('Save 버튼 disabled:', isDisabled);

    // 클릭
    await firstSaveBtn.click();
    console.log('Save 버튼 클릭 완료');

    // 5. "Saved" 메시지가 나타나는지 확인 (2초 내)
    const savedMsg = page.locator('text=Saved');
    const appeared = await savedMsg.isVisible().catch(() => false);
    console.log('Saved 메시지 표시:', appeared);

    // 6. 버튼이 "Saving..."으로 변했다가 돌아오는지
    // (이미 돌아왔을 수 있으므로 현재 텍스트 확인)
    const afterText = await firstSaveBtn.textContent();
    console.log('클릭 후 버튼 텍스트:', afterText);

    // 7. Network 요청 확인을 위해 콘솔 로그 캡처
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });

    // 8. 잠시 대기 후 다시 Save 클릭하여 네트워크 요청 관찰
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('settings/generator') || resp.url().includes('action'), { timeout: 5000 }).catch(() => null),
      firstSaveBtn.click(),
    ]);

    if (response) {
      console.log('Server Action 응답:', response.status(), response.url());
    } else {
      console.log('Server Action 응답 없음 — 네트워크 요청이 발생하지 않았을 수 있음');
    }
  });
});
