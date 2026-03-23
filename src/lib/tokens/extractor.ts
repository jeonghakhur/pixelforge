import type { FigmaNode, FigmaColor } from '@/lib/figma/api';
import { TOKEN_TYPES } from './token-types';

// ===========================
// 토큰 타입 정의
// ===========================
export interface ColorToken {
  name: string;
  hex: string;
  rgba: { r: number; g: number; b: number; a: number };
}

export interface TypographyToken {
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight?: number;
  letterSpacing?: number;
}

export interface SpacingToken {
  name: string;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  gap?: number;
}

export interface RadiusToken {
  name: string;
  value: number;
  corners?: number[];
}

export interface ExtractedTokens {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
  radius: RadiusToken[];
}

// ===========================
// StyleMap 타입 (Named Styles용)
// ===========================
export interface StyleInfo {
  name: string;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
}

/** Figma node style ID → StyleInfo 매핑 (key: "S:abc123") */
export type StyleMap = Record<string, StyleInfo>;

/** extractTokens() 반환 타입 */
export interface ExtractResult {
  tokens: ExtractedTokens;
  source: 'styles-api' | 'section-scan' | 'node-scan';
}

// ===========================
// 유틸리티
// ===========================
function figmaColorToHex(color: FigmaColor): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function figmaColorToRgba(color: FigmaColor) {
  return {
    r: Math.round(color.r * 255),
    g: Math.round(color.g * 255),
    b: Math.round(color.b * 255),
    a: color.a,
  };
}

function deduplicateByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateAll(tokens: ExtractedTokens): ExtractedTokens {
  return {
    // 색상 dedup: 같은 hex면 "/" 포함(조상 경로 기반) 이름 우선 보존
    colors: deduplicateByKey(
      [...tokens.colors].sort((a, b) => {
        const aHasPath = a.name.includes('/') ? 0 : 1;
        const bHasPath = b.name.includes('/') ? 0 : 1;
        return aHasPath - bHasPath;
      }),
      (c) => c.hex,
    ),
    typography: deduplicateByKey(tokens.typography, (t) => `${t.fontFamily}-${t.fontSize}-${t.fontWeight}`),
    spacing: deduplicateByKey(tokens.spacing, (s) => `${s.paddingTop}-${s.paddingRight}-${s.paddingBottom}-${s.paddingLeft}-${s.gap}`),
    radius: deduplicateByKey(tokens.radius, (r) => String(r.value)),
  };
}

/**
 * Named Style 이름 정규화
 * "Colors/Brand/Blue 500" → "Brand/Blue 500"
 * "Text Style/Heading XL" → "Heading XL"
 */
function normalizeStyleName(name: string): string {
  const TYPE_PREFIXES = /^(colors?|text\s?style|typography|fills?)\//i;
  return name.replace(TYPE_PREFIXES, '');
}

// ===========================
// Layer 1: Named Styles 추출
// ===========================
function hasNamedStyles(node: FigmaNode, styleMap: StyleMap): boolean {
  const refs = node.styles ?? {};
  if (Object.values(refs).some((id) => styleMap[id])) return true;
  return (node.children ?? []).some((c) => hasNamedStyles(c, styleMap));
}

function extractByNamedStyles(rootNode: FigmaNode, styleMap: StyleMap): ExtractedTokens {
  const colors: ColorToken[] = [];
  const typography: TypographyToken[] = [];

  function traverse(node: FigmaNode) {
    const refs = node.styles ?? {};

    // fills / strokes → FILL 스타일
    const fillStyleId = refs['fills'] ?? refs['strokes'];
    if (fillStyleId) {
      const info = styleMap[fillStyleId];
      if (info?.styleType === 'FILL' && node.fills) {
        for (const fill of node.fills) {
          if (fill.type === 'SOLID' && fill.color) {
            colors.push({
              name: normalizeStyleName(info.name),
              hex: figmaColorToHex(fill.color),
              rgba: figmaColorToRgba(fill.color),
            });
          }
        }
      }
    }

    // text → TEXT 스타일
    const textStyleId = refs['text'];
    if (textStyleId) {
      const info = styleMap[textStyleId];
      if (info?.styleType === 'TEXT' && node.type === 'TEXT' && node.style) {
        typography.push({
          name: normalizeStyleName(info.name),
          fontFamily: node.style.fontFamily,
          fontSize: node.style.fontSize,
          fontWeight: node.style.fontWeight,
          lineHeight: node.style.lineHeightPx,
          letterSpacing: node.style.letterSpacing,
        });
      }
    }

    (node.children ?? []).forEach(traverse);
  }

  traverse(rootNode);

  return {
    colors: deduplicateByKey(colors, (c) => c.hex),
    typography: deduplicateByKey(typography, (t) => `${t.fontFamily}-${t.fontSize}-${t.fontWeight}`),
    spacing: [],
    radius: [],
  };
}

// ===========================
// Layer 2: 섹션 기반 스코핑
// ===========================
// TOKEN_TYPES config에서 파생 — 새 토큰 타입 추가 시 자동 반영
const SECTION_PATTERNS: Record<string, RegExp> = Object.fromEntries(
  TOKEN_TYPES.map((t) => [t.id, t.sectionPattern]),
);

// ExtractedTokens 키 매핑 (extractor 내부 키는 복수형 유지)
const TYPE_TO_RESULT_KEY: Record<string, keyof ExtractedTokens> = {
  color: 'colors',
  typography: 'typography',
  spacing: 'spacing',
  radius: 'radius',
};

// 토큰 쇼케이스 파일의 노이즈 노드 이름 (Variables 문서 UI 요소)
const SHOWCASE_NOISE = /^(variable information|variable layer|properties wrapper|code wrapper|page header)$/i;

function extractSingleNodeColor(node: FigmaNode, result: ColorToken[]) {
  // "Variable/{name}" 패턴 프레임 → 토큰 쇼케이스 구조로 특별 처리
  // 예: "Variable/border/default" → token name = "border/default"
  //     색상 = Variable Layer > Swatch fill
  const varMatch = node.name.match(/^Variable\/(.+)$/i);
  if (varMatch) {
    // 토큰명 결정: Variable Information 안의 첫 TEXT 레이어 이름을 우선 사용
    // (Figma에서 프레임 이름이 잘못된 경우에도 실제 변수명 복원 가능)
    const framePath = varMatch[1]; // e.g. "background/secondary"
    const pathParts = framePath.split('/');
    const category = pathParts.slice(0, -1).join('/'); // e.g. "background"

    const varInfo = node.children?.find((c) => c.name === 'Variable Information');
    const actualNameNode = varInfo?.children?.find(
      (c) => c.type === 'TEXT' && c.name !== 'Variable Description',
    );
    const tokenName = actualNameNode
      ? (category ? `${category}/${actualNameNode.name}` : actualNameNode.name)
      : framePath;

    const varLayer = node.children?.find((c) => c.name === 'Variable Layer');
    const swatch = varLayer?.children?.find((c) => c.name === 'Swatch');
    if (swatch?.fills) {
      for (const fill of swatch.fills) {
        if (fill.type === 'SOLID' && fill.color) {
          result.push({
            name: tokenName,
            hex: figmaColorToHex(fill.color),
            rgba: figmaColorToRgba(fill.color),
          });
        }
      }
    }
    return; // 하위 트리에 진입하지 않음
  }

  // 노이즈 노드(쇼케이스 UI 프레임, INSTANCE 템플릿, Wrapper 컨테이너) 스킵
  if (SHOWCASE_NOISE.test(node.name)) return;
  if (node.type === 'INSTANCE') {
    // INSTANCE는 컴포넌트 미리보기 → 내부 자식만 순회 (fill은 무시)
    for (const child of node.children ?? []) {
      extractSingleNodeColor(child, result);
    }
    return;
  }
  // "Wrapper" 이름 컨테이너 → 내부만 순회
  if (/^wrapper$/i.test(node.name)) {
    for (const child of node.children ?? []) {
      extractSingleNodeColor(child, result);
    }
    return;
  }
  // 카테고리 컨테이너 프레임: "1/border/", "2/text/" 같은 패턴 → 내부만 순회
  if (/^\d+\/[^/]+\/?$/.test(node.name)) {
    for (const child of node.children ?? []) {
      extractSingleNodeColor(child, result);
    }
    return;
  }

  if (node.fills && node.type !== 'TEXT') {
    for (const fill of node.fills) {
      if (fill.type === 'SOLID' && fill.color) {
        result.push({
          name: node.name,
          hex: figmaColorToHex(fill.color),
          rgba: figmaColorToRgba(fill.color),
        });
      }
    }
  }
  for (const child of node.children ?? []) {
    extractSingleNodeColor(child, result);
  }
}

function extractSingleNodeTypo(node: FigmaNode, result: TypographyToken[]) {
  if (node.type === 'TEXT' && node.style) {
    result.push({
      name: node.name,
      fontFamily: node.style.fontFamily,
      fontSize: node.style.fontSize,
      fontWeight: node.style.fontWeight,
      lineHeight: node.style.lineHeightPx,
      letterSpacing: node.style.letterSpacing,
    });
  }
  for (const child of node.children ?? []) extractSingleNodeTypo(child, result);
}

function extractSingleNodeSpacing(node: FigmaNode, result: SpacingToken[]) {
  const children = node.children ?? [];

  // FRAME/COMPONENT 중 padding 또는 auto-layout gap이 있으면 스페이싱 토큰으로 수집
  // return 없이 계속 자식도 순회 (컨테이너이면서 토큰일 수 있음)
  if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
    const pt = node.paddingTop ?? 0;
    const pr = node.paddingRight ?? 0;
    const pb = node.paddingBottom ?? 0;
    const pl = node.paddingLeft ?? 0;
    const gap = node.itemSpacing ?? 0;
    if (pt > 0 || pr > 0 || pb > 0 || pl > 0 || gap > 0) {
      result.push({
        name: node.name,
        paddingTop: pt > 0 ? pt : undefined,
        paddingRight: pr > 0 ? pr : undefined,
        paddingBottom: pb > 0 ? pb : undefined,
        paddingLeft: pl > 0 ? pl : undefined,
        gap: gap > 0 ? gap : undefined,
      });
    }
  }

  // 리프 노드: bbox의 최소 변이 스페이싱 값을 나타낼 수 있음
  // TEXT 제외 — 시각적 사각형/선 노드만 (RECTANGLE, LINE, VECTOR, ELLIPSE)
  const VISUAL_LEAF_TYPES = ['RECTANGLE', 'LINE', 'VECTOR', 'ELLIPSE'];
  if (children.length === 0 && VISUAL_LEAF_TYPES.includes(node.type)) {
    const box = node.absoluteBoundingBox;
    if (box) {
      const size = Math.min(box.width, box.height);
      if (size >= 1 && size <= 128 && Number.isInteger(size)) {
        result.push({ name: node.name, gap: size });
      }
    }
    return;
  }

  for (const child of children) extractSingleNodeSpacing(child, result);
}

function extractSingleNodeRadius(node: FigmaNode, result: RadiusToken[]) {
  if (node.cornerRadius !== undefined && node.cornerRadius > 0) {
    result.push({ name: node.name, value: node.cornerRadius, corners: node.rectangleCornerRadii });
  }
  for (const child of node.children ?? []) extractSingleNodeRadius(child, result);
}

function extractBySectionScope(rootNode: FigmaNode): { hasData: boolean; tokens: ExtractedTokens } {
  const result: ExtractedTokens = { colors: [], typography: [], spacing: [], radius: [] };
  let found = false;

  const dispatchExtract = (typeId: string, node: FigmaNode) => {
    const key = TYPE_TO_RESULT_KEY[typeId];
    if (!key) return;
    if (typeId === 'color') extractSingleNodeColor(node, result.colors);
    else if (typeId === 'typography') extractSingleNodeTypo(node, result.typography);
    else if (typeId === 'spacing') extractSingleNodeSpacing(node, result.spacing);
    else if (typeId === 'radius') extractSingleNodeRadius(node, result.radius);
  };

  // rootNode 자체가 섹션인 경우 (특정 프레임을 직접 선택했을 때)
  for (const [typeId, pattern] of Object.entries(SECTION_PATTERNS)) {
    if (pattern.test(rootNode.name)) {
      for (const child of rootNode.children ?? []) {
        dispatchExtract(typeId, child);
      }
      return { hasData: true, tokens: deduplicateAll(result) };
    }
  }

  const topLevel = rootNode.type === 'DOCUMENT'
    ? (rootNode.children ?? []).flatMap((page) => page.children ?? [])
    : (rootNode.children ?? []);

  for (const section of topLevel) {
    for (const [typeId, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(section.name)) {
        found = true;
        for (const child of section.children ?? []) {
          dispatchExtract(typeId, child);
        }
      }
    }
  }

  return { hasData: found, tokens: deduplicateAll(result) };
}

// ===========================
// Layer 3: 패턴 필터 (개선)
// ===========================
const NOISE_NAMES = /^(rectangle \d+|ellipse \d+|vector \d+|icon|arrow|chevron|close|check|menu)/i;
const NOISE_TEXT = /^(text \d+|label \d+|placeholder|hint)/i;
const VALID_FONT_SIZE = (size: number) => size >= 10 && size <= 96;

/**
 * 노드 이름이 의미없는 범용 스워치명이면 true.
 * 이 경우 조상 경로(ancestor path)로 토큰명을 대체한다.
 * Variables API가 차단된 커뮤니티 파일에서 "border/default" 같은
 * 올바른 이름을 복원하기 위한 휴리스틱.
 */
const GENERIC_SWATCH_NAMES = /^(swatch|color|chip|sample|preview|fill|dot|box|square|circle|spot)$/i;

function isCircle(node: FigmaNode): boolean {
  const box = node.absoluteBoundingBox;
  if (!box) return false;
  return (node.cornerRadius ?? 0) >= Math.min(box.width, box.height) / 2;
}

function hasLayoutMode(node: FigmaNode): boolean {
  return node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL';
}

function extractByPatternFilter(rootNode: FigmaNode): ExtractedTokens {
  const colors: ColorToken[] = [];
  const typography: TypographyToken[] = [];
  const spacing: SpacingToken[] = [];
  const radius: RadiusToken[] = [];

  // 기존 boundVariables 로직 유지
  const boundOnly = hasVariableBoundFills(rootNode);

  function traverseColors(node: FigmaNode, ancestors: string[]) {
    // TEXT 노드는 텍스트 색상(semantic)이므로 fill 토큰에서 제외
    if (node.type === 'TEXT') {
      for (const child of node.children ?? []) {
        traverseColors(child, [...ancestors, node.name]);
      }
      return;
    }

    const hasBound = (node.boundVariables?.fills?.length ?? 0) > 0;
    if (!NOISE_NAMES.test(node.name) && (!boundOnly || hasBound)) {
      if (node.fills) {
        for (const fill of node.fills) {
          if (fill.type === 'SOLID' && fill.color) {
            // boundOnly 모드이거나 범용 스워치명이면 조상 경로로 토큰명 복원
            const useAncestor = (boundOnly && hasBound) || GENERIC_SWATCH_NAMES.test(node.name);
            const name = useAncestor
              ? (buildBoundTokenName(ancestors) ?? node.name)
              : node.name;
            colors.push({ name, hex: figmaColorToHex(fill.color), rgba: figmaColorToRgba(fill.color) });
          }
        }
      }
    }
    for (const child of node.children ?? []) {
      traverseColors(child, [...ancestors, node.name]);
    }
  }

  function traverseTypo(node: FigmaNode) {
    if (node.type === 'TEXT' && node.style && !NOISE_TEXT.test(node.name) && VALID_FONT_SIZE(node.style.fontSize)) {
      typography.push({
        name: node.name,
        fontFamily: node.style.fontFamily,
        fontSize: node.style.fontSize,
        fontWeight: node.style.fontWeight,
        lineHeight: node.style.lineHeightPx,
        letterSpacing: node.style.letterSpacing,
      });
    }
    for (const child of node.children ?? []) traverseTypo(child);
  }

  function traverseSpacing(node: FigmaNode) {
    if (node.type === 'FRAME' && hasLayoutMode(node)) {
      const pt = node.paddingTop ?? 0;
      const pr = node.paddingRight ?? 0;
      const pb = node.paddingBottom ?? 0;
      const pl = node.paddingLeft ?? 0;
      const gap = node.itemSpacing ?? 0;
      const isUniformPadding = (pt === pb && pl === pr) || (pt === pr && pr === pb && pb === pl);
      const hasGap = gap > 0;
      const hasPadding = pt > 0 || pr > 0 || pb > 0 || pl > 0;
      if ((hasPadding && isUniformPadding) || hasGap) {
        spacing.push({
          name: node.name,
          paddingTop: node.paddingTop,
          paddingRight: node.paddingRight,
          paddingBottom: node.paddingBottom,
          paddingLeft: node.paddingLeft,
          gap: node.itemSpacing,
        });
      }
    }
    for (const child of node.children ?? []) traverseSpacing(child);
  }

  function traverseRadius(node: FigmaNode) {
    if (node.cornerRadius !== undefined && node.cornerRadius > 0 && node.cornerRadius <= 100 && !isCircle(node)) {
      radius.push({ name: node.name, value: node.cornerRadius, corners: node.rectangleCornerRadii });
    }
    for (const child of node.children ?? []) traverseRadius(child);
  }

  traverseColors(rootNode, []);
  traverseTypo(rootNode);
  traverseSpacing(rootNode);
  traverseRadius(rootNode);

  return deduplicateAll({ colors, typography, spacing, radius });
}

/** 트리 내에 variable 바인딩된 fill을 가진 노드가 하나라도 있는지 확인 */
function hasVariableBoundFills(node: FigmaNode): boolean {
  if ((node.boundVariables?.fills?.length ?? 0) > 0) return true;
  return (node.children ?? []).some(hasVariableBoundFills);
}

/**
 * boundVariables 모드에서 의미있는 토큰 이름 추출
 */
function buildBoundTokenName(ancestors: string[]): string | null {
  for (let i = ancestors.length - 1; i >= 1; i--) {
    const m = ancestors[i].match(/^Variable\/(.+)$/i);
    if (m) return m[1];
  }
  const GENERIC = /^(wrapper|container|layer|node|frame|group|content|inner|outer|swatch|color)$/i;
  const clean = ancestors
    .slice(1)
    .filter((a) => a.length <= 40 && !GENERIC.test(a) && !/^\d/.test(a) && !a.includes('//') && !/^\s*$/.test(a));
  if (clean.length >= 2) return `${clean[clean.length - 2]}/${clean[clean.length - 1]}`;
  if (clean.length === 1) return clean[0];
  return null;
}

// ===========================
// 메인 추출 엔진 — 3-Layer
// ===========================
export function extractTokens(rootNode: FigmaNode, styleMap?: StyleMap): ExtractResult {
  // Layer 1: Named Styles (colors + typography만 반환)
  if (styleMap && hasNamedStyles(rootNode, styleMap)) {
    const namedResult = extractByNamedStyles(rootNode, styleMap);

    // spacing/radius는 Named Styles로 추출 불가 → Layer 2/3로 보완
    const sectioned = extractBySectionScope(rootNode);
    const fallback = sectioned.hasData ? sectioned.tokens : extractByPatternFilter(rootNode);

    return {
      tokens: {
        colors: namedResult.colors,
        typography: namedResult.typography,
        spacing: fallback.spacing,
        radius: fallback.radius,
      },
      source: 'styles-api',
    };
  }

  // Layer 2: 섹션 기반 스코핑
  const sectioned = extractBySectionScope(rootNode);
  if (sectioned.hasData) {
    return { tokens: sectioned.tokens, source: 'section-scan' };
  }

  // Layer 3: 패턴 필터 (기존 boundVariables 로직 포함)
  return { tokens: extractByPatternFilter(rootNode), source: 'node-scan' };
}
