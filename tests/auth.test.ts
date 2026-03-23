import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3777';
const ADMIN_EMAIL = 'admin@pixelforge.test';
const ADMIN_PW = 'TestPass123!';
const MEMBER_EMAIL = 'member@pixelforge.test';
const MEMBER_PW = 'MemberPass456!';

test.describe('auth-signup 인증 플로우 테스트', () => {

  // ────────────────────────────────────────
  // 1. 최초 접속 → /login 리다이렉트
  // ────────────────────────────────────────
  test('미인증 접근 시 /login 리다이렉트', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveURL(/\/login/);
    console.log('PASS: 미인증 → /login 리다이렉트');
  });

  // ────────────────────────────────────────
  // 2. /register 접근 (계정 없을 때)
  // ────────────────────────────────────────
  test('계정 없을 때 /register 페이지 표시', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByText('관리자 계정을 만들어 시작하세요')).toBeVisible();
    console.log('PASS: /register 페이지 정상 렌더링');
  });

  // ────────────────────────────────────────
  // 3. 유효성 검사 — 짧은 비밀번호
  // ────────────────────────────────────────
  test('비밀번호 8자 미만 에러 표시', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.fill('#reg-email', ADMIN_EMAIL);
    await page.fill('#reg-password', 'short');
    await page.fill('#reg-password-confirm', 'short');
    await page.click('button[type="submit"]');
    await expect(page.getByRole('alert').first()).toBeVisible();
    console.log('PASS: 짧은 비밀번호 에러 표시');
  });

  // ────────────────────────────────────────
  // 4. 비밀번호 불일치 에러
  // ────────────────────────────────────────
  test('비밀번호 확인 불일치 에러', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.fill('#reg-email', ADMIN_EMAIL);
    await page.fill('#reg-password', ADMIN_PW);
    await page.fill('#reg-password-confirm', 'DifferentPw999!');
    await page.click('button[type="submit"]');
    await expect(page.getByText('비밀번호가 일치하지 않습니다')).toBeVisible();
    console.log('PASS: 비밀번호 불일치 에러');
  });

  // ────────────────────────────────────────
  // 5. 회원가입 성공 → IDE 진입
  // ────────────────────────────────────────
  test('admin 계정 생성 후 IDE 자동 진입', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.fill('#reg-email', ADMIN_EMAIL);
    await page.fill('#reg-password', ADMIN_PW);
    await page.fill('#reg-password-confirm', ADMIN_PW);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 5000 });
    await expect(page).toHaveURL(`${BASE_URL}/`);
    console.log('PASS: admin 계정 생성 + IDE 자동 진입');
  });

  // ────────────────────────────────────────
  // 6. 이미 계정 있을 때 /register 접근 → /login 리다이렉트
  // ────────────────────────────────────────
  test('계정 있을 때 /register → /login 리다이렉트', async ({ page }) => {
    // 로그아웃 상태로
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/register`);
    // register 페이지가 계정 존재 체크 후 /login으로 리다이렉트
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
    console.log('PASS: 계정 있을 때 /register → /login 리다이렉트');
  });

  // ────────────────────────────────────────
  // 7. 로그인 — 잘못된 비밀번호
  // ────────────────────────────────────────
  test('잘못된 비밀번호 로그인 에러 표시', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', 'WrongPassword!');
    await page.click('button[type="submit"]');
    await expect(page.getByText('이메일 또는 비밀번호가 올바르지 않습니다')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    console.log('PASS: 잘못된 비밀번호 에러 표시 + 페이지 유지');
  });

  // ────────────────────────────────────────
  // 8. 로그인 성공 → IDE 진입
  // ────────────────────────────────────────
  test('올바른 자격증명으로 로그인 성공', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', ADMIN_PW);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 5000 });
    await expect(page).toHaveURL(`${BASE_URL}/`);
    console.log('PASS: 로그인 성공 → IDE 진입');
  });

  // ────────────────────────────────────────
  // 9. 팀원 추가 (Settings → 팀원 탭)
  // ────────────────────────────────────────
  test('admin이 멤버 사용자 추가', async ({ page }) => {
    // 로그인
    await page.goto(`${BASE_URL}/login`);
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', ADMIN_PW);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`);

    // Settings → 팀원 탭
    await page.goto(`${BASE_URL}/settings`);
    // 팀원 탭 클릭
    await page.getByRole('tab', { name: '팀원' }).click();

    // 사용자 추가 폼
    await page.fill('#invite-email', MEMBER_EMAIL);
    await page.fill('#invite-pw', MEMBER_PW);
    await page.getByRole('button', { name: '추가' }).click();

    // 추가된 사용자 목록에 표시
    await expect(page.getByText(MEMBER_EMAIL)).toBeVisible({ timeout: 3000 });
    console.log('PASS: 멤버 사용자 추가');
  });

  // ────────────────────────────────────────
  // 10. 비밀번호 변경 (Settings → 계정 탭)
  // ────────────────────────────────────────
  test('비밀번호 변경 성공', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', ADMIN_PW);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`);

    await page.goto(`${BASE_URL}/settings`);
    await page.getByRole('tab', { name: '계정' }).click();

    const newPw = 'NewPass789!';
    await page.fill('#current-pw', ADMIN_PW);
    await page.fill('#new-pw', newPw);
    await page.fill('#new-pw-confirm', newPw);
    await page.getByRole('button', { name: '비밀번호 변경' }).click();

    await expect(page.getByText('비밀번호가 변경되었습니다')).toBeVisible({ timeout: 3000 });
    console.log('PASS: 비밀번호 변경 성공');

    // 변경된 비밀번호로 재로그인 확인
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/login`);
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', newPw);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 5000 });
    await expect(page).toHaveURL(`${BASE_URL}/`);
    console.log('PASS: 변경된 비밀번호로 재로그인 성공');
  });

  // ────────────────────────────────────────
  // 11. 사용자 삭제
  // ────────────────────────────────────────
  test('admin이 멤버 사용자 삭제', async ({ page }) => {
    // 변경된 비밀번호로 로그인
    const newPw = 'NewPass789!';
    await page.goto(`${BASE_URL}/login`);
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', newPw);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`);

    await page.goto(`${BASE_URL}/settings`);
    await page.getByRole('tab', { name: '팀원' }).click();
    await expect(page.getByText(MEMBER_EMAIL)).toBeVisible({ timeout: 3000 });

    // 삭제 버튼 클릭
    await page.getByRole('button', { name: `${MEMBER_EMAIL} 삭제` }).click();

    // 목록에서 사라짐
    await expect(page.getByText(MEMBER_EMAIL)).not.toBeVisible({ timeout: 3000 });
    console.log('PASS: 멤버 사용자 삭제');
  });

  // ────────────────────────────────────────
  // 12. 로그아웃 후 IDE 접근 차단
  // ────────────────────────────────────────
  test('로그아웃 후 IDE 접근 → /login 리다이렉트', async ({ page }) => {
    const newPw = 'NewPass789!';
    await page.goto(`${BASE_URL}/login`);
    await page.fill('#login-email', ADMIN_EMAIL);
    await page.fill('#login-password', newPw);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/`);

    // 로그아웃 버튼 클릭
    await page.getByRole('button', { name: '로그아웃' }).click();
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);

    // IDE 직접 접근 시도
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveURL(/\/login/);
    console.log('PASS: 로그아웃 후 IDE 접근 차단');
  });

});
