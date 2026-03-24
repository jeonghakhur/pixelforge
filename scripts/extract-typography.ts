/**
 * Typography 토큰 추출 스크립트
 *
 * Figma 노드 JSON에서 Variable/type/{category}/{name} 패턴의 타이포그래피 토큰을 추출합니다.
 *
 * Usage:
 *   npx tsx scripts/extract-typography.ts [input.json] [output.json]
 *
 * Defaults:
 *   input  = data/figma-node-1-2870.json
 *   output = data/extracted-typography.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface FigmaNode {
  name: string;
  type: string;
  characters?: string;
  children?: FigmaNode[];
}

interface TypographyToken {
  category: string;  // size | line-height | letter-spacing
  name: string;      // Variable Information > 첫 TEXT의 characters
  value: number;
  fullPath: string;  // type/size/38
}

// ── CLI args ──────────────────────────────────────────
const inputPath = resolve(process.argv[2] ?? 'data/figma-node-1-2870.json');
const outputPath = resolve(process.argv[3] ?? 'data/extracted-typography.json');

// ── JSON 읽기 ──────────────────────────────────────────
const raw = JSON.parse(readFileSync(inputPath, 'utf-8'));

let rootNode: FigmaNode;
if (raw.nodes) {
  const firstKey = Object.keys(raw.nodes)[0];
  rootNode = raw.nodes[firstKey].document as FigmaNode;
} else if (raw.document) {
  rootNode = raw.document as FigmaNode;
} else {
  rootNode = raw as FigmaNode;
}

// ── Variable/type/{category}/{...} 프레임 탐색 ────────
const VAR_PATTERN = /^Variable\/type\/([^/]+)\/(.+)$/;

function extract(node: FigmaNode, result: TypographyToken[]): void {
  const match = node.name.match(VAR_PATTERN);
  if (match) {
    const category = match[1];   // size | line-height | letter-spacing
    const frameSuffix = match[2]; // 프레임명 suffix (fallback용)

    // Variable Information > 첫 번째 TEXT에서 실제 값 읽기
    const varInfo = node.children?.find((c) => c.name === 'Variable Information');
    const firstText = varInfo?.children?.find(
      (c) => c.type === 'TEXT' && c.name !== 'Variable Description',
    );
    const rawName = firstText?.characters ?? frameSuffix;
    const numericValue = parseFloat(rawName);

    if (!isNaN(numericValue)) {
      result.push({
        category,
        name: rawName,
        value: numericValue,
        fullPath: `type/${category}/${rawName}`,
      });
    }
    return; // Variable 프레임 내부는 더 탐색하지 않음
  }

  for (const child of node.children ?? []) {
    extract(child, result);
  }
}

const tokens: TypographyToken[] = [];
extract(rootNode, tokens);

// ── 카테고리별 정렬 ──────────────────────────────────
tokens.sort((a, b) => {
  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return a.value - b.value;
});

// ── JSON 저장 ─────────────────────────────────────────
writeFileSync(outputPath, JSON.stringify(tokens, null, 2), 'utf-8');

// ── 터미널 출력 ───────────────────────────────────────
const PAD_CAT = 16;
const PAD_NAME = 8;

process.stderr.write(`\nExtracted ${tokens.length} typography tokens:\n\n`);
process.stderr.write(
  `${'Category'.padEnd(PAD_CAT)} ${'Name'.padEnd(PAD_NAME)} Value\n`,
);
process.stderr.write(`${'─'.repeat(PAD_CAT)} ${'─'.repeat(PAD_NAME)} ─────\n`);

for (const t of tokens) {
  process.stderr.write(
    `${t.category.padEnd(PAD_CAT)} ${t.name.padEnd(PAD_NAME)} ${t.value}\n`,
  );
}

process.stderr.write(`\nSaved to: ${outputPath}\n`);
