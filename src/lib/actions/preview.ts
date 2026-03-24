'use server';

import fs from 'fs';
import path from 'path';
import { extractFileKey } from '@/lib/figma/api';

// ===========================
// 미리보기 토큰 타입
// ===========================
export interface ColorPreview {
  category: string;
  name: string;
  hex: string;
}

export interface TypographyPreview {
  category: string; // size | line-height | letter-spacing
  name: string;
  value: number;
}

export interface SpacingPreview {
  name: string;
  value: number;
}

export interface RadiusPreview {
  name: string;
  value: number;
}

export interface TokenPreviewResult {
  error: string | null;
  colors: ColorPreview[];
  typography: TypographyPreview[];
  spacing: SpacingPreview[];
  radius: RadiusPreview[];
}

// ===========================
// 내부 Figma 노드 타입
// ===========================
interface FigmaFill {
  type: string;
  color?: { r: number; g: number; b: number; a?: number };
}

interface FigmaNode {
  name: string;
  type: string;
  characters?: string;
  fills?: FigmaFill[];
  children?: FigmaNode[];
}

// ===========================
// 유틸리티
// ===========================
function toHex(n: number): string {
  return Math.round(n * 255).toString(16).padStart(2, '0');
}

function getVarInfoText(node: FigmaNode): string | null {
  const varInfo = node.children?.find((c) => c.name === 'Variable Information');
  const firstText = varInfo?.children?.find(
    (c) => c.type === 'TEXT' && c.name !== 'Variable Description',
  );
  return firstText?.characters?.trim() ?? null;
}

// ===========================
// 색상 — Variable/{category}/...
// color 카테고리: spacing | radius | type 제외한 모든 것
// ===========================
const NON_COLOR_CATEGORIES = new Set(['spacing', 'radius', 'type']);
const COLOR_PATTERN = /^Variable\/([^/]+)\/.+$/;

function extractColors(node: FigmaNode, result: ColorPreview[]): void {
  const match = node.name.match(COLOR_PATTERN);
  if (match) {
    const category = match[1];
    if (NON_COLOR_CATEGORIES.has(category)) return; // 다른 Variable 타입 스킵

    const tokenName = getVarInfoText(node) ?? node.name.split('/').pop() ?? '';
    const varLayer = node.children?.find((c) => c.name === 'Variable Layer');
    const swatch = varLayer?.children?.find((c) => c.name === 'Swatch');
    const fill = swatch?.fills?.find((f) => f.type === 'SOLID' && f.color);

    if (fill?.color) {
      const { r, g, b } = fill.color;
      result.push({
        category,
        name: tokenName,
        hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
      });
    }
    return;
  }
  for (const child of node.children ?? []) {
    extractColors(child, result);
  }
}

// ===========================
// 타이포그래피 — Variable/type/{category}/...
// ===========================
const TYPO_PATTERN = /^Variable\/type\/([^/]+)\/(.+)$/;

function extractTypography(node: FigmaNode, result: TypographyPreview[]): void {
  const match = node.name.match(TYPO_PATTERN);
  if (match) {
    const category = match[1];
    const frameSuffix = match[2];
    const rawName = getVarInfoText(node) ?? frameSuffix;
    const value = parseFloat(rawName);
    if (!isNaN(value)) {
      result.push({ category, name: rawName, value });
    }
    return;
  }
  for (const child of node.children ?? []) {
    extractTypography(child, result);
  }
}

// ===========================
// 간격 — Variable/spacing/...
// ===========================
const SPACING_PATTERN = /^Variable\/spacing\/(.+)$/;

function extractSpacing(node: FigmaNode, result: SpacingPreview[]): void {
  const match = node.name.match(SPACING_PATTERN);
  if (match) {
    const rawName = getVarInfoText(node) ?? match[1];
    const value = parseFloat(rawName);
    if (!isNaN(value)) {
      result.push({ name: rawName, value });
    }
    return;
  }
  for (const child of node.children ?? []) {
    extractSpacing(child, result);
  }
}

// ===========================
// 반경 — Variable/radius/...
// ===========================
const RADIUS_PATTERN = /^Variable\/radius\/(.+)$/;

function extractRadius(node: FigmaNode, result: RadiusPreview[]): void {
  const match = node.name.match(RADIUS_PATTERN);
  if (match) {
    const rawName = getVarInfoText(node) ?? match[1];
    const value = parseFloat(rawName);
    if (!isNaN(value)) {
      result.push({ name: rawName, value });
    }
    return;
  }
  for (const child of node.children ?? []) {
    extractRadius(child, result);
  }
}

// ===========================
// 메인 액션
// ===========================
export async function previewTokensAction(figmaUrl: string): Promise<TokenPreviewResult> {
  const empty: TokenPreviewResult = { error: null, colors: [], typography: [], spacing: [], radius: [] };

  const fileKey = extractFileKey(figmaUrl);
  if (!fileKey) return { ...empty, error: '올바른 Figma URL이 아닙니다.' };

  const cachePath = path.join(process.cwd(), '.pixelforge', 'cache', `${fileKey}.json`);
  if (!fs.existsSync(cachePath)) return empty; // 캐시 없으면 빈 결과 (오류 아님)

  try {
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

    let rootNode: FigmaNode;
    if (raw.nodes) {
      rootNode = raw.nodes[Object.keys(raw.nodes)[0]].document as FigmaNode;
    } else if (raw.document) {
      rootNode = raw.document as FigmaNode;
    } else {
      rootNode = raw as FigmaNode;
    }

    const colors: ColorPreview[] = [];
    const typography: TypographyPreview[] = [];
    const spacing: SpacingPreview[] = [];
    const radius: RadiusPreview[] = [];

    extractColors(rootNode, colors);
    extractTypography(rootNode, typography);
    extractSpacing(rootNode, spacing);
    extractRadius(rootNode, radius);

    typography.sort((a, b) => a.category.localeCompare(b.category) || a.value - b.value);
    spacing.sort((a, b) => a.value - b.value);
    radius.sort((a, b) => a.value - b.value);

    return { error: null, colors, typography, spacing, radius };
  } catch {
    return empty; // 파싱 실패 시 빈 결과
  }
}
