/**
 * Generator Config 저장/로드 E2E 테스트 (Playwright 없이 직접 DB + curl)
 *
 * 실행: npx tsx src/scripts/test-generator-config.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import { execSync } from 'child_process';

const DB_PATH = path.join(process.cwd(), '.pixelforge', 'db.sqlite');
const BASE_URL = 'http://localhost:3000';

function curl(urlPath: string): string {
  return execSync(`curl -s ${BASE_URL}${urlPath}`, { timeout: 10000 }).toString();
}

const db = new Database(DB_PATH);

console.log('\n=== Generator Config 저장/로드 테스트 ===\n');

// 1. 현재 DB 상태 확인
console.log('1. DB 상태 확인');
const rows = db.prepare("SELECT key, value FROM app_settings WHERE key LIKE 'generator.%'").all() as Array<{key: string; value: string}>;
console.log(`   ${rows.length}개 키 저장됨`);
for (const r of rows) {
  console.log(`   ${r.key}: ${r.value.slice(0, 50)}...`);
}

// 2. semanticMap에 테스트 항목 추가
console.log('\n2. DB에 테스트 데이터 추가 (test-e2e-key: test-e2e-value)');
const originalMap = rows.find(r => r.key === 'generator.semanticMap')?.value ?? '{}';
const mapObj = JSON.parse(originalMap);
mapObj['test-e2e-key'] = 'test-e2e-value';
db.prepare("UPDATE app_settings SET value = ? WHERE key = 'generator.semanticMap'").run(JSON.stringify(mapObj));

// 3. SSR 페이지에서 테스트 데이터가 보이는지 확인
console.log('\n3. /settings/generator SSR 응답 확인');
try {
  const html = curl('/settings/generator');
  const found = html.includes('test-e2e-key') && html.includes('test-e2e-value');
  console.log(`   test-e2e-key 발견: ${found ? '✅ PASS' : '❌ FAIL'}`);

  if (!found) {
    // 디버깅: SETTINGS 텍스트만 보이는지 확인
    const settingsOnly = html.includes('SETTINGS') && !html.includes('Semantic Map');
    console.log(`   SETTINGS만 표시: ${settingsOnly}`);
    console.log(`   Semantic Map 포함: ${html.includes('Semantic Map')}`);
    console.log(`   Generator Settings 포함: ${html.includes('Generator Settings')}`);

    // HTML 일부 추출
    const bodyMatch = html.match(/<body[^>]*>([\s\S]{0,500})/);
    if (bodyMatch) console.log(`   body 시작: ${bodyMatch[1].slice(0, 200)}...`);
  }
} catch (e) {
  console.log(`   ❌ FAIL - 서버 응답 없음 (dev 서버가 실행 중인지 확인)`);
}

// 4. 복원
console.log('\n4. 원본 데이터 복원');
db.prepare("UPDATE app_settings SET value = ? WHERE key = 'generator.semanticMap'").run(originalMap);
console.log('   ✅ 복원 완료');

// 5. paletteKeywords 확인
console.log('\n5. paletteKeywords DB 확인');
const kwRow = db.prepare("SELECT value FROM app_settings WHERE key = 'generator.paletteKeywords'").get() as {value: string} | undefined;
console.log(`   ${kwRow ? kwRow.value : '❌ 없음 (기본값 사용)'}`);

console.log('\n=== 테스트 완료 ===\n');

db.close();
