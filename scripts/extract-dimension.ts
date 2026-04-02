/**
 * Spacing / Radius 토큰 추출 스크립트
 *
 * Usage:
 *   npx tsx scripts/extract-dimension.ts <spacing|radius> [input.json] [output.json]
 *
 * Defaults:
 *   input  = data/figma-node-spacing.json
 *   output = data/extracted-{type}.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getRootNode } from './shared';

interface FigmaNode {
  name: string;
  type: string;
  characters?: string;
  children?: FigmaNode[];
}

interface DimensionToken {
  name: string;
  value: number;
}

const tokenType = process.argv[2];
if (tokenType !== 'spacing' && tokenType !== 'radius') {
  process.stderr.write(
    '사용법: npx tsx scripts/extract-dimension.ts <spacing|radius> [input.json] [output.json]\n',
  );
  process.exit(1);
}

const VAR_PATTERN = new RegExp(`^Variable\\/${tokenType}\\/(.+)$`);

const inputPath = resolve(process.argv[3] ?? 'data/figma-node-spacing.json');
const outputPath = resolve(process.argv[4] ?? `data/extracted-${tokenType}.json`);

const raw = JSON.parse(readFileSync(inputPath, 'utf-8')) as unknown;
const rootNode = getRootNode<FigmaNode>(raw);

function extract(node: FigmaNode, result: DimensionToken[]): void {
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

const tokens: DimensionToken[] = [];
extract(rootNode, tokens);
tokens.sort((a, b) => a.value - b.value);

writeFileSync(outputPath, JSON.stringify(tokens, null, 2), 'utf-8');

process.stderr.write(`\nExtracted ${tokens.length} ${tokenType} tokens:\n\n`);
process.stderr.write(`${'Name'.padEnd(8)} Value\n`);
process.stderr.write(`${'─'.repeat(8)} ─────\n`);
for (const t of tokens) {
  process.stderr.write(`${t.name.padEnd(8)} ${t.value}\n`);
}
process.stderr.write(`\nSaved to: ${outputPath}\n`);
