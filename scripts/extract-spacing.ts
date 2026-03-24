/**
 * Spacing 토큰 추출 스크립트
 *
 * Usage:
 *   npx tsx scripts/extract-spacing.ts [input.json] [output.json]
 *
 * Defaults:
 *   input  = data/figma-node-spacing.json
 *   output = data/extracted-spacing.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface FigmaNode {
  name: string;
  type: string;
  characters?: string;
  children?: FigmaNode[];
}

interface SpacingToken {
  name: string;
  value: number;
}

const VAR_PATTERN = /^Variable\/spacing\/(.+)$/;

const inputPath = resolve(process.argv[2] ?? 'data/figma-node-spacing.json');
const outputPath = resolve(process.argv[3] ?? 'data/extracted-spacing.json');

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

function extract(node: FigmaNode, result: SpacingToken[]): void {
  const match = node.name.match(VAR_PATTERN);
  if (match) {
    const varInfo = node.children?.find((c) => c.name === 'Variable Information');
    const firstText = varInfo?.children?.find(
      (c) => c.type === 'TEXT' && c.name !== 'Variable Description',
    );
    const rawName = firstText?.characters ?? match[1];
    const value = parseFloat(rawName);
    if (!isNaN(value)) {
      result.push({ name: rawName, value });
    }
    return;
  }
  for (const child of node.children ?? []) {
    extract(child, result);
  }
}

const tokens: SpacingToken[] = [];
extract(rootNode, tokens);
tokens.sort((a, b) => a.value - b.value);

writeFileSync(outputPath, JSON.stringify(tokens, null, 2), 'utf-8');

process.stderr.write(`\nExtracted ${tokens.length} spacing tokens:\n\n`);
process.stderr.write(`${'Name'.padEnd(8)} Value\n`);
process.stderr.write(`${'─'.repeat(8)} ─────\n`);
for (const t of tokens) {
  process.stderr.write(`${t.name.padEnd(8)} ${t.value}\n`);
}
process.stderr.write(`\nSaved to: ${outputPath}\n`);
