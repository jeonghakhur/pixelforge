import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE = 'http://localhost:4000';
const OUT  = path.resolve('./scripts/screenshots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await ctx.route('**/api/sync/events**', route => route.abort());

  // 1. 로그인
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('#login-email', { timeout: 8000 });
  await page.fill('#login-email', 'jeoghak@inpix.com');
  await page.fill('#login-password', 'jY130709!@');
  await Promise.all([
    page.waitForNavigation({ timeout: 10000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
  console.log('로그인 후 URL:', page.url());

  if (page.url().includes('/login')) {
    const err = await page.locator('[role="alert"]').first().textContent().catch(() => '');
    console.error('로그인 실패:', err);
    await page.screenshot({ path: path.join(OUT, 'login-fail.png') });
    await browser.close();
    return;
  }
  console.log('✓ 로그인 성공');

  // 2. Button 페이지
  await page.goto(`${BASE}/components/Button`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('h1', { timeout: 10000 });
  await page.waitForTimeout(3500); // iframe + shiki 로드 대기
  console.log('Button 페이지:', page.url());

  // 전체 스크린샷
  await page.screenshot({ path: path.join(OUT, '02-button-full.png'), fullPage: true });
  console.log('  ✓ 02-button-full.png');

  // iframe 프리뷰
  const iframeEl = page.locator('iframe').first();
  if (await iframeEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    await iframeEl.screenshot({ path: path.join(OUT, '03-iframe.png') });
    console.log('  ✓ 03-iframe.png');
  }

  // sandbox 섹션
  const sandboxSection = page.locator('section').filter({ hasText: 'Interactive Sandbox' }).first();
  if (await sandboxSection.isVisible().catch(() => false)) {
    await sandboxSection.screenshot({ path: path.join(OUT, '04-sandbox.png') });
    console.log('  ✓ 04-sandbox.png');
  }

  // Props Editor
  const propsSection = page.locator('section').filter({ hasText: 'Props Editor' }).first();
  if (await propsSection.isVisible().catch(() => false)) {
    await propsSection.screenshot({ path: path.join(OUT, '05-props-editor.png') });
    console.log('  ✓ 05-props-editor.png');
  }

  await browser.close();
  console.log(`\n✓ 완료 — ${OUT}`);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
