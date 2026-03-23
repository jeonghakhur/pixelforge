/**
 * PixelForge — Token Extraction Dev Script
 *
 * Figma 파일에서 토큰을 추출하는 현재 로직을 진단합니다.
 * - Variables API 사용 가능 → Variables 비교
 * - Community 파일(403) → 노드 스캔 결과 + 파일 구조 출력
 *
 * Usage:
 *   npx tsx scripts/dev-extract.ts <figma-url-or-filekey> [type]
 *   npm run extract:dev -- oNTDgxxQJTuIu32ntLevAX color
 *   npm run extract:dev -- "https://figma.com/design/..." color
 *
 * Version history:
 *   v1 — 초기 버전: Variables API diff 출력
 *   v2 — node-scan 경로 추가, 파일 구조 진단 출력
 */

const SCRIPT_VERSION = 3;

import path from 'path';
import fs from 'fs';

import { FigmaClient, extractFileKey, extractNodeId } from '../src/lib/figma/api';
import { extractFromVariables } from '../src/lib/tokens/variables-extractor';
import { extractTokens } from '../src/lib/tokens/extractor';
import type { FigmaVariablesResponse, FigmaNode } from '../src/lib/figma/api';
import type { ExtractedVariableTokens } from '../src/lib/tokens/variables-extractor';
import type { StyleMap } from '../src/lib/tokens/extractor';

type Collections = FigmaVariablesResponse['meta']['variableCollections'];
type Variables   = FigmaVariablesResponse['meta']['variables'];

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────
async function main() {
  const [, , rawArg, typeArg] = process.argv;

  if (!rawArg) {
    console.error('Usage: npx tsx scripts/dev-extract.ts <figma-url-or-filekey> [type]');
    process.exit(1);
  }

  const isUrl = rawArg.startsWith('http');
  const fileKey = isUrl ? extractFileKey(rawArg) : rawArg;
  const urlNodeId = isUrl ? extractNodeId(rawArg) : null;

  if (!fileKey) {
    console.error('올바른 Figma URL 또는 파일 키를 입력하세요.');
    process.exit(1);
  }

  const targetTypes = typeArg
    ? [typeArg]
    : ['color', 'typography', 'spacing', 'radius'];

  // Figma 토큰 로드
  const configPath = path.join(process.cwd(), '.pixelforge', 'config.json');
  const figmaToken: string | undefined =
    process.env.FIGMA_TOKEN ??
    (fs.existsSync(configPath)
      ? (JSON.parse(fs.readFileSync(configPath, 'utf-8')) as { figmaToken?: string }).figmaToken
      : undefined);

  if (!figmaToken) {
    console.error('Figma API 토큰이 없습니다.');
    process.exit(1);
  }

  // ── Header
  hr('═');
  console.log(`  PixelForge Token Extraction Dev Tool  v${SCRIPT_VERSION}`);
  hr('═');
  console.log(`  File key  : ${fileKey}`);
  if (urlNodeId) console.log(`  Node ID   : ${urlNodeId}`);
  console.log(`  Types     : ${targetTypes.join(', ')}`);
  hr('═');
  console.log();

  const client = new FigmaClient(figmaToken);

  // ── 1. Variables API 시도
  process.stdout.write('Variables API 시도 중... ');
  const variablesRes = await client.getVariables(fileKey);

  if (variablesRes) {
    console.log('성공!\n');
    await runVariablesComparison(variablesRes, targetTypes);
  } else {
    console.log('403/404 — Community 파일 또는 권한 없음\n');
    console.log('→ 노드 스캔(section-scan / node-scan) 모드로 전환합니다.\n');
    await runNodeScanDiagnosis(client, fileKey, urlNodeId, targetTypes);
  }
}

// ──────────────────────────────────────────────
// Path A: Variables API 비교
// ──────────────────────────────────────────────
async function runVariablesComparison(
  variablesRes: FigmaVariablesResponse,
  targetTypes: string[],
) {
  const { variableCollections, variables } = variablesRes.meta;
  const collections = Object.values(variableCollections);

  console.log(`Collections (${collections.length}개):`);
  for (const col of collections) {
    const modeStr = col.modes.map((m) => m.name).join(' / ');
    console.log(`  · "${col.name}"  [${modeStr}]  →  기본 모드: "${col.modes[0]?.name ?? '-'}"`);
  }
  console.log();

  const extracted = extractFromVariables(variablesRes);

  let totalFigma = 0, totalMatched = 0;

  for (const type of targetTypes) {
    const figmaNames  = getRawFigmaNames(variableCollections, variables, type);
    const ourNames    = getExtractedNames(extracted, type);
    const figmaSet    = new Set(figmaNames);
    const ourSet      = new Set(ourNames);
    const missing     = figmaNames.filter((n) => !ourSet.has(n));
    const extra       = ourNames.filter((n) => !figmaSet.has(n));
    const matched     = figmaNames.filter((n) => ourSet.has(n));
    const matchPct    = figmaNames.length === 0 ? 100 : Math.round((matched.length / figmaNames.length) * 100);

    totalFigma   += figmaNames.length;
    totalMatched += matched.length;

    hr('─');
    console.log(`  TYPE: ${type.toUpperCase()}   Figma ${figmaNames.length}개 → 추출 ${ourNames.length}개`);
    hr('─');

    console.log(`\n  [Figma 원본 — ${figmaNames.length}개]`);
    printNameList(figmaNames, ourSet);

    console.log(`\n  [추출 결과 — ${ourNames.length}개]`);
    printNameList(ourNames, figmaSet);

    console.log(`\n  [Diff]`);
    if (missing.length === 0 && extra.length === 0) {
      console.log('    완전 일치!');
    } else {
      if (missing.length > 0) {
        console.log(`    누락 (Figma에 있는데 추출 안 됨) — ${missing.length}개:`);
        missing.forEach((n) => console.log(`      - ${n}`));
      }
      if (extra.length > 0) {
        console.log(`    초과 (추출됐는데 Figma에 없음) — ${extra.length}개:`);
        extra.forEach((n) => console.log(`      + ${n}`));
      }
    }
    console.log(`\n  Match rate: ${makeBar(matchPct)} ${matchPct}%  (${matched.length}/${figmaNames.length})\n`);
  }

  const totalPct = totalFigma === 0 ? 100 : Math.round((totalMatched / totalFigma) * 100);
  hr('═');
  console.log(`  전체 Match rate: ${makeBar(totalPct)} ${totalPct}%  (${totalMatched}/${totalFigma})`);
  hr('═');
  console.log();
}

// ──────────────────────────────────────────────
// Path B: Node Scan 진단 (Community 파일용)
// ──────────────────────────────────────────────
async function runNodeScanDiagnosis(
  client: FigmaClient,
  fileKey: string,
  urlNodeId: string | null,
  targetTypes: string[],
) {
  // 파일 구조 fetch
  process.stdout.write('파일 구조 로딩 중... ');
  let rootNode: FigmaNode;
  let styleMap: StyleMap = {};
  let fileName = fileKey;

  if (urlNodeId) {
    const [nodesRes, stylesRes] = await Promise.all([
      client.getNodes(fileKey, [urlNodeId]),
      client.getStyles(fileKey),
    ]);
    fileName = nodesRes.name;
    const doc = nodesRes.nodes[urlNodeId]?.document;
    if (!doc) { console.error('노드를 찾을 수 없습니다.'); process.exit(1); }
    rootNode = doc;
    const rawStyles: Record<string, { name: string; styleType: string }> = {};
    for (const s of stylesRes.meta.styles) {
      rawStyles[`S:${s.key}`] = { name: s.name, styleType: s.style_type };
    }
    styleMap = rawStyles as StyleMap;
  } else {
    const file = await client.getFile(fileKey);
    fileName = file.name;
    rootNode = file.document as FigmaNode;
    styleMap = file.styles as StyleMap;
  }
  console.log(`완료 (${fileName})\n`);

  // ── 파일 상위 구조 출력 (섹션 이름 확인용)
  console.log('── 파일 상위 구조 (섹션/프레임 이름) ──────────────────────');
  printNodeTree(rootNode, 0, 5);
  console.log();

  // ── 색상 값이 있는 노드 전체 나열 (색상 진단용)
  if (targetTypes.includes('color')) {
    console.log('── 색상 fill이 있는 노드 전체 (SOLID fill 한정) ──────────');
    collectColorNodes(rootNode, 0);
    console.log();
  }

  // ── Named Styles 목록 (있으면)
  const styleEntries = Object.entries(styleMap);
  if (styleEntries.length > 0) {
    console.log(`── Named Styles (${styleEntries.length}개) ─────────────────────────────`);
    styleEntries.slice(0, 30).forEach(([id, info]) => {
      console.log(`  ${(info as { styleType: string; name: string }).styleType.padEnd(8)} ${(info as { name: string }).name}  [${id}]`);
    });
    if (styleEntries.length > 30) console.log(`  ... 외 ${styleEntries.length - 30}개`);
    console.log();
  }

  // ── 현재 추출 로직 실행
  const { tokens: extracted, source } = extractTokens(rootNode, styleMap);
  console.log(`── 추출 결과 (소스: ${source}) ──────────────────────────────`);

  for (const type of targetTypes) {
    const names = getExtractedTokenNames(extracted, type);
    console.log(`\n  ${type.toUpperCase()} — ${names.length}개:`);
    if (names.length === 0) {
      console.log('    (없음)');
    } else {
      names.forEach((n, i) => console.log(`    ${String(i + 1).padStart(2)}. ${n}`));
    }
  }

  console.log();
  hr('═');
  console.log('  진단 완료. 위 파일 구조와 추출 결과를 비교해 로직을 수정하세요.');
  console.log(`  실제 토큰이 있는 섹션 이름을 TOKEN_TYPES sectionPattern에 추가하면 됩니다.`);
  hr('═');
  console.log();
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function getRawFigmaNames(
  collections: Collections,
  variables: Variables,
  type: string,
): string[] {
  const names: string[] = [];
  for (const collection of Object.values(collections)) {
    const defaultMode = collection.modes[0];
    if (!defaultMode) continue;
    for (const varId of collection.variableIds) {
      const variable = variables[varId];
      if (!variable || variable.hiddenFromPublishing) continue;
      const rawValue = variable.valuesByMode[defaultMode.modeId];
      if (rawValue === undefined) continue;
      if (
        typeof rawValue === 'object' &&
        rawValue !== null &&
        (rawValue as { type?: string }).type === 'VARIABLE_ALIAS'
      ) continue;

      if (type === 'color' && variable.resolvedType === 'COLOR') {
        names.push(variable.name);
      } else if (variable.resolvedType === 'FLOAT' && type !== 'color') {
        const inferred = inferFloatType(variable.name, variable.scopes ?? []);
        if (inferred === type) names.push(variable.name);
      }
    }
  }
  return names;
}

function inferFloatType(name: string, scopes: string[]): string | null {
  if (scopes.includes('GAP') || scopes.includes('WIDTH_HEIGHT')) return 'spacing';
  if (scopes.includes('CORNER_RADIUS')) return 'radius';
  if (scopes.includes('FONT_SIZE') || scopes.includes('LINE_HEIGHT') || scopes.includes('LETTER_SPACING')) return 'typography';
  const lower = name.toLowerCase();
  if (/spacing|gap|padding|margin/.test(lower)) return 'spacing';
  if (/radius|corner|rounded/.test(lower)) return 'radius';
  if (/font.?size|font.?weight|line.?height|letter.?spacing/.test(lower)) return 'typography';
  return null;
}

function getExtractedNames(extracted: ExtractedVariableTokens, type: string): string[] {
  switch (type) {
    case 'color':      return extracted.colors.map((c) => c.name);
    case 'typography': return extracted.typography.map((t) => t.name);
    case 'spacing':    return extracted.spacing.map((s) => s.name);
    case 'radius':     return extracted.radius.map((r) => r.name);
    default:           return [];
  }
}

function getExtractedTokenNames(
  extracted: ReturnType<typeof extractTokens>['tokens'],
  type: string,
): string[] {
  switch (type) {
    case 'color':      return extracted.colors.map((c) => c.name);
    case 'typography': return extracted.typography.map((t) => t.name);
    case 'spacing':    return extracted.spacing.map((s) => s.name);
    case 'radius':     return extracted.radius.map((r) => r.name);
    default:           return [];
  }
}

/** SOLID fill이 있는 노드를 전부 출력 (색상 추출 디버깅용) */
function collectColorNodes(node: FigmaNode, depth: number) {
  const fills = node.fills ?? [];
  const solidFill = fills.find((f) => f.type === 'SOLID' && f.color);
  if (solidFill?.color) {
    const { r, g, b } = solidFill.color;
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    const indent = '  '.repeat(Math.min(depth, 6));
    console.log(`${indent}[${node.type}] "${node.name}"  ${hex}`);
  }
  for (const child of node.children ?? []) {
    collectColorNodes(child, depth + 1);
  }
}

function toHex(n: number): string {
  return Math.round(n * 255).toString(16).padStart(2, '0');
}

/** 노드 트리를 depth 제한으로 출력 */
function printNodeTree(node: FigmaNode, depth: number, maxDepth: number) {
  if (depth > maxDepth) return;
  const indent = '  '.repeat(depth);
  const childCount = node.children ? ` (${node.children.length})` : '';
  console.log(`${indent}· [${node.type}] "${node.name}"${childCount}`);
  if (depth < maxDepth) {
    for (const child of node.children ?? []) {
      printNodeTree(child, depth + 1, maxDepth);
    }
  }
}

function printNameList(names: string[], checkSet: Set<string>) {
  if (names.length === 0) {
    console.log('    (없음)');
    return;
  }
  names.forEach((n, i) => {
    const mark = checkSet.has(n) ? '✓' : '✗';
    console.log(`    ${mark} ${String(i + 1).padStart(2)}. ${n}`);
  });
}

function hr(char: string) {
  console.log(char.repeat(62));
}

function makeBar(pct: number, width = 20): string {
  const filled = Math.round((pct / 100) * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}]`;
}

main().catch((err) => {
  console.error('오류:', err instanceof Error ? err.message : err);
  process.exit(1);
});
