/**
 * 토큰 추출 + CSS 변수명 검증 스크립트
 *
 * Figma JSON → parseVariablesPayload → toVarName → CSS 변수명이
 * 플러그인 컴포넌트 참조와 일치하는지 검증
 *
 * 실행: npx tsx src/scripts/test-token-extraction.ts
 */

import { readFileSync } from 'fs';
import { parseVariablesPayload } from '../lib/sync/parse-variables';
import { toVarName, TYPE_PREFIX } from '../lib/tokens/css-generator';

const FIGMA_JSON_PATH = '/Users/jeonghak/Downloads/Untitled_UI_Figma_PRO_VARIABLES_v8_0_KTWJ8mYFqVpN_복사_tokens.json';

// 플러그인이 Button 컴포넌트에서 참조하는 CSS 변수명 (일치해야 함)
const EXPECTED_VARS = [
  '--shadow-xs',
  '--shadow-xs-skeuomorphic',
  '--focus-ring',
  '--focus-ring-shadow-xs-skeuomorphic',
  '--focus-ring-error',
  '--focus-ring-error-shadow-xs-skeuomorphic',
  '--skeuemorphic-gradient-border',
];

try {
  const raw = JSON.parse(readFileSync(FIGMA_JSON_PATH, 'utf-8'));
  const tokens = parseVariablesPayload(raw);

  console.log(`\n✅ 총 ${tokens.length}개 토큰 추출됨\n`);

  // 타입별 집계
  const typeCounts = new Map<string, number>();
  for (const t of tokens) {
    typeCounts.set(t.type, (typeCounts.get(t.type) ?? 0) + 1);
  }
  console.log('── 타입별 개수 ──');
  for (const [type, count] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  // Shadow 토큰 CSS 변수명 확인
  const shadowTokens = tokens.filter(t => t.type === 'shadow');
  console.log(`\n── Shadow 토큰 (${shadowTokens.length}개) ──`);
  const seenNames = new Set<string>();
  for (const t of shadowTokens) {
    if (seenNames.has(t.name)) continue;
    seenNames.add(t.name);
    const prefix = TYPE_PREFIX[t.type] ?? t.type;
    const varName = toVarName(t.name, prefix);
    console.log(`  ${t.name} → ${varName}`);
  }

  // Gradient 토큰
  const gradientTokens = tokens.filter(t => t.type === 'gradient');
  console.log(`\n── Gradient 토큰 (${gradientTokens.length}개) ──`);
  for (const t of gradientTokens) {
    const prefix = TYPE_PREFIX[t.type] ?? t.type;
    const varName = toVarName(t.name, prefix);
    const preview = t.raw ? t.raw.slice(0, 60) + (t.raw.length > 60 ? '...' : '') : '';
    console.log(`  ${t.name} → ${varName}`);
    console.log(`    value: ${preview}`);
  }

  // Blur 토큰
  const blurTokens = tokens.filter(t => t.type === 'blur');
  console.log(`\n── Blur 토큰 (${blurTokens.length}개) ──`);
  for (const t of blurTokens) {
    const prefix = TYPE_PREFIX[t.type] ?? t.type;
    const varName = toVarName(t.name, prefix);
    console.log(`  ${t.name} → ${varName} (raw: ${t.raw})`);
  }

  // 기대 변수 일치 검증
  console.log(`\n── 플러그인 참조 변수 일치 검증 ──`);
  const allVarNames = new Set<string>();
  for (const t of tokens) {
    if (t.mode && t.mode !== 'Mode 1' && !/light/i.test(t.mode)) continue;
    const prefix = TYPE_PREFIX[t.type] ?? t.type;
    allVarNames.add(toVarName(t.name, prefix));
  }

  let pass = 0;
  let fail = 0;
  for (const expected of EXPECTED_VARS) {
    if (allVarNames.has(expected)) {
      console.log(`  ✅ ${expected}`);
      pass++;
    } else {
      console.log(`  ❌ ${expected} — NOT FOUND`);
      fail++;
    }
  }

  console.log(`\n결과: ${pass} pass, ${fail} fail\n`);
  process.exit(fail > 0 ? 1 : 0);
} catch (err) {
  console.error('Error:', err);
  process.exit(1);
}
