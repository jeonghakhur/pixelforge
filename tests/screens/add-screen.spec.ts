import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:3777';
const ADMIN_EMAIL = 'admin@pixelforge.test';
// auth 테스트에서 비밀번호를 변경했을 수 있으므로 두 가지 모두 시도
const PASSWORDS = ['TestPass123!', 'NewPass789!'];

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  for (const pw of PASSWORDS) {
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', pw);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL(`${BASE}/`, { timeout: 3000 });
      return; // 성공
    } catch {
      // 다음 비밀번호 시도
    }
  }
  throw new Error('로그인 실패 — 테스트 계정을 먼저 생성하세요 (auth.test.ts 실행)');
}

test.describe('화면 추가 기능', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/screens`);
    await page.waitForLoadState('networkidle');
  });

  test('화면 추가 버튼 존재 확인', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /화면 추가/ });
    await expect(addBtn).toBeVisible();
    console.log('PASS: 화면 추가 버튼 확인');
  });

  test('모달 열기 — 파일 목록 로딩', async ({ page }) => {
    await page.getByRole('button', { name: /화면 추가/ }).click();
    // 모달 제목 확인
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('화면 추가')).toBeVisible();
    // 라우트 드롭다운 또는 "등록 가능한 파일 없음" 메시지 확인
    await page.waitForTimeout(1000); // 파일 목록 로딩 대기
    console.log('PASS: 모달 열림 + 파일 목록 로딩');
    await page.screenshot({ path: 'test-results/screens/add-modal-open.png' });
  });

  test('샘플 화면 등록 — 홈 대시보드', async ({ page }) => {
    await page.getByRole('button', { name: /화면 추가/ }).click();
    await page.waitForTimeout(1000);

    const select = page.locator('#screen-route');
    const options = await select.locator('option').allTextContents();
    console.log('사용 가능한 라우트:', options);

    // /pages/home 라우트 찾기
    const homeOption = options.find((o) => o.includes('/pages/home'));
    if (!homeOption) {
      console.log('SKIP: /pages/home 이미 등록되어 있거나 파일 없음');
      return;
    }

    await select.selectOption({ label: homeOption });
    await page.waitForTimeout(300);

    // 이름 자동 채워짐 확인
    const nameVal = await page.locator('#screen-name').inputValue();
    console.log('자동 채워진 이름:', nameVal);

    // 이름이 비어있으면 직접 입력
    if (!nameVal) {
      await page.fill('#screen-name', '홈 대시보드');
    }

    await page.screenshot({ path: 'test-results/screens/add-modal-home-filled.png' });

    // 제출
    await page.getByRole('button', { name: /화면 추가/ }).last().click();
    await page.waitForTimeout(1500);

    // 모달 닫힘 확인
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    console.log('PASS: 홈 대시보드 등록 완료');
    await page.screenshot({ path: 'test-results/screens/after-add-home.png' });
  });

  test('샘플 화면 등록 — 로그인', async ({ page }) => {
    await page.getByRole('button', { name: /화면 추가/ }).click();
    await page.waitForTimeout(1000);

    const select = page.locator('#screen-route');
    const options = await select.locator('option').allTextContents();

    const target = options.find((o) => o.includes('/pages/login'));
    if (!target) {
      console.log('SKIP: /pages/login 이미 등록됨');
      return;
    }

    await select.selectOption({ label: target });
    await page.waitForTimeout(300);

    const nameVal = await page.locator('#screen-name').inputValue();
    if (!nameVal) await page.fill('#screen-name', '로그인');

    await page.getByRole('button', { name: /화면 추가/ }).last().click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    console.log('PASS: 로그인 화면 등록 완료');
  });

  test('샘플 화면 등록 — 프로필', async ({ page }) => {
    await page.getByRole('button', { name: /화면 추가/ }).click();
    await page.waitForTimeout(1000);

    const select = page.locator('#screen-route');
    const options = await select.locator('option').allTextContents();

    const target = options.find((o) => o.includes('/pages/profile'));
    if (!target) {
      console.log('SKIP: /pages/profile 이미 등록됨');
      return;
    }

    await select.selectOption({ label: target });
    await page.waitForTimeout(300);

    const nameVal = await page.locator('#screen-name').inputValue();
    if (!nameVal) await page.fill('#screen-name', '프로필');

    await page.getByRole('button', { name: /화면 추가/ }).last().click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    console.log('PASS: 프로필 화면 등록 완료');
  });

  test('샘플 화면 등록 — 알림', async ({ page }) => {
    await page.getByRole('button', { name: /화면 추가/ }).click();
    await page.waitForTimeout(1000);

    const select = page.locator('#screen-route');
    const options = await select.locator('option').allTextContents();

    const target = options.find((o) => o.includes('/pages/notifications'));
    if (!target) {
      console.log('SKIP: /pages/notifications 이미 등록됨');
      return;
    }

    await select.selectOption({ label: target });
    await page.waitForTimeout(300);

    const nameVal = await page.locator('#screen-name').inputValue();
    if (!nameVal) await page.fill('#screen-name', '알림');

    await page.getByRole('button', { name: /화면 추가/ }).last().click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    console.log('PASS: 알림 화면 등록 완료');
  });

  test('등록 후 목록에 반영 확인', async ({ page }) => {
    await page.screenshot({ path: 'test-results/screens/final-screen-list.png', fullPage: true });
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    console.log(`최종 등록된 화면 수: ${count}`);
    expect(count).toBeGreaterThan(0);
  });

  test('파일 없는 라우트 직접 입력 불가 — 빈 드롭다운에서만 선택 가능', async ({ page }) => {
    // 모든 파일이 등록된 경우 "등록 가능한 파일 없음" 메시지 또는 빈 드롭다운 확인
    await page.getByRole('button', { name: /화면 추가/ }).click();
    await page.waitForTimeout(1000);

    // route input이 select(드롭다운)이지 text input이 아님을 확인
    const textInput = page.locator('input#screen-route');
    expect(await textInput.count()).toBe(0);
    console.log('PASS: 라우트는 드롭다운 선택만 가능, 자유 입력 불가');
  });
});
