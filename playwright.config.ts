import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 15000,
  use: {
    baseURL: 'http://localhost:3777',
    headless: true,
  },
  workers: 1, // 순차 실행 (상태 의존)
});
