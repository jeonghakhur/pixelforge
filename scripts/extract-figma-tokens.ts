/**
 * Figma JSON → 컬러 토큰 자동 추출 스크립트
 *
 * Usage:
 *   npx tsx scripts/extract-figma-tokens.ts [input.json] [output.json]
 *
 * Defaults:
 *   input  = data/figma-node-2028-1034.json
 *   output = data/extracted-tokens.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getRootNode } from './shared';
import { extractTokens } from '@/lib/tokens/extractor';
import type { ColorToken } from '@/lib/tokens/extractor';
import type { FigmaNode } from '@/lib/figma/api';

interface StructuredToken {
  category: string;
  name: string;
  hex: string;
  rgba: { r: number; g: number; b: number; a: number };
}

// ── CLI args ──────────────────────────────────────────
const inputPath = resolve(process.argv[2] ?? 'data/figma-node-2028-1034.json');
const outputPath = resolve(process.argv[3] ?? 'data/extracted-tokens.json');

// ── 1. JSON 읽기 + document 언래핑 ──────────────────
const raw = JSON.parse(readFileSync(inputPath, 'utf-8')) as unknown;
const rootNode = getRootNode<FigmaNode>(raw);

// ── 2. 기존 extractTokens() 호출 ────────────────────
const { tokens, source } = extractTokens(rootNode);

// ── 3. ColorToken[] → category/name 분리 ─────────────
function splitCategoryName(token: ColorToken): StructuredToken {
  const slashIdx = token.name.indexOf('/');
  if (slashIdx > 0) {
    return {
      category: token.name.slice(0, slashIdx),
      name: token.name.slice(slashIdx + 1),
      hex: token.hex.toUpperCase(),
      rgba: token.rgba,
    };
  }
  return {
    category: 'uncategorized',
    name: token.name,
    hex: token.hex.toUpperCase(),
    rgba: token.rgba,
  };
}

const structured = tokens.colors.map(splitCategoryName);

// ── 4. JSON 저장 ─────────────────────────────────────
writeFileSync(outputPath, JSON.stringify(structured, null, 2), 'utf-8');

// ── 5. stderr 요약 테이블 ────────────────────────────
const PAD_CAT = 14;
const PAD_NAME = 14;
const PAD_HEX = 9;

process.stderr.write(`\nSource: ${source}\n`);
process.stderr.write(`Extracted ${structured.length} color tokens:\n\n`);
process.stderr.write(
  `${'Category'.padEnd(PAD_CAT)} ${'Name'.padEnd(PAD_NAME)} ${'Hex'.padEnd(PAD_HEX)}\n`,
);
process.stderr.write(
  `${'─'.repeat(PAD_CAT)} ${'─'.repeat(PAD_NAME)} ${'─'.repeat(PAD_HEX)}\n`,
);

for (const t of structured) {
  process.stderr.write(
    `${t.category.padEnd(PAD_CAT)} ${t.name.padEnd(PAD_NAME)} ${t.hex}\n`,
  );
}

process.stderr.write(`\nSaved to: ${outputPath}\n`);
