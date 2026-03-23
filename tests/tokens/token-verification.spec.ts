import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3777';
const ADMIN_EMAIL = 'admin@pixelforge.test';
const ADMIN_PW = 'NewPass789!';

// 스크린샷 저장 디렉토리
const SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'tokens');

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('#login-email', ADMIN_EMAIL);
  await page.fill('#login-password', ADMIN_PW);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/`, { timeout: 8000 });
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

test.describe('토큰 UI 검증 테스트', () => {

  // ────────────────────────────────────────
  // 색상 토큰 검증
  // ────────────────────────────────────────
  test('color 토큰 — DOM 렌더링 vs 헤더 카운트 일치', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/tokens/color`);
    await page.waitForLoadState('networkidle');

    // 토큰이 없는 경우 — 빈 상태 확인 후 종료
    const grid = page.locator('[data-token-grid]');
    const gridVisible = await grid.isVisible().catch(() => false);

    if (!gridVisible) {
      const emptyMsg = page.getByText('Figma에서 토큰을 추출하면 여기에 표시됩니다.');
      await expect(emptyMsg).toBeVisible();
      console.log('SKIP: color 토큰 없음 — 빈 상태 확인');
      ensureDir(SCREENSHOT_DIR);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'color-empty.png'), fullPage: true });
      return;
    }

    // 헤더의 "N개 추출됨" 카운트 텍스트 읽기
    const countText = await page.locator('.count, [class*="count"]').first().textContent() ?? '';
    const headerCount = parseInt(countText.replace(/[^0-9]/g, ''), 10) || 0;

    // DOM에서 실제 렌더링된 색상 카드 수 읽기
    const colorCards = page.locator('[class*="colorCard"]');
    const domCount = await colorCards.count();

    console.log(`color 토큰 — 헤더: ${headerCount}개, DOM 카드: ${domCount}개`);
    expect(domCount).toBe(headerCount);

    // 각 카드의 hex 값 형식 검증
    const hexValues = page.locator('[class*="hexValue"]');
    const hexCount = await hexValues.count();

    const invalidHexes: string[] = [];
    for (let i = 0; i < hexCount; i++) {
      const hex = await hexValues.nth(i).textContent() ?? '';
      if (!/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(hex.trim())) {
        invalidHexes.push(hex.trim());
      }
    }

    if (invalidHexes.length > 0) {
      console.error(`잘못된 HEX 형식 발견: ${invalidHexes.join(', ')}`);
    }
    expect(invalidHexes).toHaveLength(0);

    // swatch 배경색이 hex 값과 일치하는지 확인 (첫 번째 카드)
    if (hexCount > 0) {
      const firstHex = (await hexValues.first().textContent() ?? '').trim().toLowerCase();
      const firstSwatch = page.locator('[class*="colorSwatch"]').first();
      const bgColor = await firstSwatch.evaluate((el) => getComputedStyle(el).backgroundColor);
      // rgb(r, g, b) → 파싱해서 hex 비교
      const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0');
        const g = parseInt(match[2]).toString(16).padStart(2, '0');
        const b = parseInt(match[3]).toString(16).padStart(2, '0');
        const computedHex = `#${r}${g}${b}`;
        console.log(`첫 번째 색상 — HEX: ${firstHex}, swatch 계산값: ${computedHex}`);
        expect(computedHex).toBe(firstHex);
      }
    }

    // 스크린샷 저장
    ensureDir(SCREENSHOT_DIR);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'color-tokens.png'), fullPage: true });
    console.log(`PASS: color 토큰 ${domCount}개 검증 완료 — test-results/tokens/color-tokens.png`);
  });

  // ────────────────────────────────────────
  // 타이포그래피 토큰 검증
  // ────────────────────────────────────────
  test('typography 토큰 — DOM 렌더링 vs 헤더 카운트 일치', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/tokens/typography`);
    await page.waitForLoadState('networkidle');

    const grid = page.locator('[data-token-grid]');
    const gridVisible = await grid.isVisible().catch(() => false);

    if (!gridVisible) {
      const emptyMsg = page.getByText('Figma에서 토큰을 추출하면 여기에 표시됩니다.');
      await expect(emptyMsg).toBeVisible();
      console.log('SKIP: typography 토큰 없음 — 빈 상태 확인');
      ensureDir(SCREENSHOT_DIR);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'typography-empty.png'), fullPage: true });
      return;
    }

    const countText = await page.locator('[class*="count"]').first().textContent() ?? '';
    const headerCount = parseInt(countText.replace(/[^0-9]/g, ''), 10) || 0;

    const typoRows = page.locator('[class*="typoCard"]');
    const domCount = await typoRows.count();

    console.log(`typography 토큰 — 헤더: ${headerCount}개, DOM 행: ${domCount}개`);
    expect(domCount).toBe(headerCount);

    // 각 타이포 항목의 font-size가 숫자값을 포함하는지 확인
    const sizeValues = page.locator('[class*="typoSize"], [class*="fontSize"]');
    const sizeCount = await sizeValues.count();
    for (let i = 0; i < sizeCount; i++) {
      const sizeText = await sizeValues.nth(i).textContent() ?? '';
      expect(sizeText).toMatch(/\d+/);
    }

    ensureDir(SCREENSHOT_DIR);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'typography-tokens.png'), fullPage: true });
    console.log(`PASS: typography 토큰 ${domCount}개 검증 완료`);
  });

  // ────────────────────────────────────────
  // 간격(spacing) 토큰 검증
  // ────────────────────────────────────────
  test('spacing 토큰 — DOM 렌더링 vs 헤더 카운트 일치', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/tokens/spacing`);
    await page.waitForLoadState('networkidle');

    const grid = page.locator('[data-token-grid]');
    const gridVisible = await grid.isVisible().catch(() => false);

    if (!gridVisible) {
      console.log('SKIP: spacing 토큰 없음 — 빈 상태 확인');
      ensureDir(SCREENSHOT_DIR);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'spacing-empty.png'), fullPage: true });
      return;
    }

    const countText = await page.locator('[class*="count"]').first().textContent() ?? '';
    const headerCount = parseInt(countText.replace(/[^0-9]/g, ''), 10) || 0;

    const spacingRows = page.locator('[class*="spacingCard"]');
    const domCount = await spacingRows.count();

    console.log(`spacing 토큰 — 헤더: ${headerCount}개, DOM 행: ${domCount}개`);
    expect(domCount).toBe(headerCount);

    ensureDir(SCREENSHOT_DIR);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'spacing-tokens.png'), fullPage: true });
    console.log(`PASS: spacing 토큰 ${domCount}개 검증 완료`);
  });

  // ────────────────────────────────────────
  // 반경(radius) 토큰 검증
  // ────────────────────────────────────────
  test('radius 토큰 — DOM 렌더링 vs 헤더 카운트 일치', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/tokens/radius`);
    await page.waitForLoadState('networkidle');

    const grid = page.locator('[data-token-grid]');
    const gridVisible = await grid.isVisible().catch(() => false);

    if (!gridVisible) {
      console.log('SKIP: radius 토큰 없음 — 빈 상태 확인');
      ensureDir(SCREENSHOT_DIR);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'radius-empty.png'), fullPage: true });
      return;
    }

    const countText = await page.locator('[class*="count"]').first().textContent() ?? '';
    const headerCount = parseInt(countText.replace(/[^0-9]/g, ''), 10) || 0;

    const radiusRows = page.locator('[class*="radiusCard"]');
    const domCount = await radiusRows.count();

    console.log(`radius 토큰 — 헤더: ${headerCount}개, DOM 행: ${domCount}개`);
    expect(domCount).toBe(headerCount);

    ensureDir(SCREENSHOT_DIR);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'radius-tokens.png'), fullPage: true });
    console.log(`PASS: radius 토큰 ${domCount}개 검증 완료`);
  });

  // ────────────────────────────────────────
  // data-token-grid 속성 존재 확인 (Playwright 스크린샷 트리거 조건)
  // ────────────────────────────────────────
  test('토큰 있을 때 data-token-grid 속성 존재', async ({ page }) => {
    await login(page);

    const TYPES = ['color', 'typography', 'spacing', 'radius'];
    for (const type of TYPES) {
      await page.goto(`${BASE_URL}/tokens/${type}`);
      await page.waitForLoadState('networkidle');

      const grid = page.locator('[data-token-grid]');
      const gridVisible = await grid.isVisible().catch(() => false);
      const emptyStage = page.locator('[class*="stageInner"]');
      const emptyVisible = await emptyStage.isVisible().catch(() => false);

      // 둘 중 하나는 반드시 표시되어야 함
      expect(gridVisible || emptyVisible).toBe(true);
      console.log(`${type}: grid=${gridVisible ? '표시' : '없음'}, empty=${emptyVisible ? '표시' : '없음'}`);
    }
    console.log('PASS: 모든 토큰 타입 페이지 정상 렌더링');
  });

  // ────────────────────────────────────────
  // source 배너 — 추출 출처 표시 검증
  // ────────────────────────────────────────
  test('추출된 토큰에 sourceMeta 배너 표시', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/tokens/color`);
    await page.waitForLoadState('networkidle');

    const grid = page.locator('[data-token-grid]');
    const gridVisible = await grid.isVisible().catch(() => false);

    if (!gridVisible) {
      console.log('SKIP: 토큰 없음 — sourceMeta 검증 건너뜀');
      return;
    }

    // 마지막 추출 메타 정보 표시 확인
    const sourceMeta = page.locator('[class*="sourceMeta"]');
    await expect(sourceMeta).toBeVisible();

    const metaText = await sourceMeta.textContent() ?? '';
    // "마지막 추출: MM/DD HH:mm" 형식 확인
    expect(metaText).toMatch(/마지막 추출/);
    console.log(`sourceMeta: "${metaText.trim().substring(0, 60)}"`);
    console.log('PASS: sourceMeta 배너 정상 표시');
  });

  // ────────────────────────────────────────
  // 전체 타입 스크린샷 일괄 캡처
  // ────────────────────────────────────────
  test('모든 토큰 타입 전체 화면 스크린샷 캡처', async ({ page }) => {
    await login(page);
    ensureDir(SCREENSHOT_DIR);

    const TYPES = ['color', 'typography', 'spacing', 'radius'];
    for (const type of TYPES) {
      await page.goto(`${BASE_URL}/tokens/${type}`);
      await page.waitForLoadState('networkidle');

      const screenshotPath = path.join(SCREENSHOT_DIR, `${type}-full.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`스크린샷 저장: test-results/tokens/${type}-full.png`);
    }
    console.log('PASS: 모든 토큰 타입 스크린샷 캡처 완료');
  });

});
