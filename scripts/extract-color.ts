/**
 * Color 토큰 추출 스크립트
 *
 * Usage:
 *   npx tsx scripts/extract-color.ts [input.json] [output.json]
 *
 * Defaults:
 *   input  = data/figma-node-color.json
 *   output = data/extracted-color.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface FigmaFill {
  type: string;
  color?: FigmaColor;
}

interface FigmaNode {
  name: string;
  type: string;
  characters?: string;
  fills?: FigmaFill[];
  children?: FigmaNode[];
}

interface ColorToken {
  category: string;
  name: string;
  hex: string;
  rgba: { r: number; g: number; b: number; a: number };
}

const VAR_PATTERN = /^Variable\/([^/]+)\/.+$/;

const inputPath = resolve(process.argv[2] ?? 'data/figma-node-color.json');
const outputPath = resolve(process.argv[3] ?? 'data/extracted-color.json');

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

function toHex(n: number): string {
  return Math.round(n * 255).toString(16).padStart(2, '0');
}

function extract(node: FigmaNode, result: ColorToken[]): void {
  const match = node.name.match(VAR_PATTERN);
  if (match) {
    const category = match[1];

    // Variable Information > 첫 TEXT에서 실제 토큰명 읽기
    const varInfo = node.children?.find((c) => c.name === 'Variable Information');
    const firstText = varInfo?.children?.find(
      (c) => c.type === 'TEXT' && c.name !== 'Variable Description',
    );
    const tokenName = firstText?.characters?.trim() ?? node.name.split('/').pop() ?? '';

    // Variable Layer > Swatch에서 색상 읽기
    const varLayer = node.children?.find((c) => c.name === 'Variable Layer');
    const swatch = varLayer?.children?.find((c) => c.name === 'Swatch');
    const fill = swatch?.fills?.find((f) => f.type === 'SOLID' && f.color);

    if (fill?.color) {
      const { r, g, b, a = 1 } = fill.color;
      result.push({
        category,
        name: tokenName,
        hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
        rgba: {
          r: Math.round(r * 255),
          g: Math.round(g * 255),
          b: Math.round(b * 255),
          a,
        },
      });
    }
    return;
  }
  for (const child of node.children ?? []) {
    extract(child, result);
  }
}

const tokens: ColorToken[] = [];
extract(rootNode, tokens);

writeFileSync(outputPath, JSON.stringify(tokens, null, 2), 'utf-8');

const PAD_CAT = 12;
const PAD_NAME = 12;
const PAD_HEX = 9;

process.stderr.write(`\nExtracted ${tokens.length} color tokens:\n\n`);
process.stderr.write(
  `${'Category'.padEnd(PAD_CAT)} ${'Name'.padEnd(PAD_NAME)} Hex\n`,
);
process.stderr.write(`${'─'.repeat(PAD_CAT)} ${'─'.repeat(PAD_NAME)} ${'─'.repeat(PAD_HEX)}\n`);
for (const t of tokens) {
  process.stderr.write(
    `${t.category.padEnd(PAD_CAT)} ${t.name.padEnd(PAD_NAME)} ${t.hex}\n`,
  );
}
process.stderr.write(`\nSaved to: ${outputPath}\n`);
