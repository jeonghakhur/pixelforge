import type { FigmaNode, FigmaColor } from '@/lib/figma/api';

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
// 유틸리티
// ===========================
function figmaColorToHex(color: FigmaColor): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
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

// ===========================
// 추출 함수
// ===========================

/** 색상 토큰 추출: FILL이 SOLID인 노드에서 HEX 추출 */
function extractColors(node: FigmaNode, result: ColorToken[]): void {
  if (node.fills) {
    for (const fill of node.fills) {
      if (fill.type === 'SOLID' && fill.color) {
        result.push({
          name: node.name,
          hex: figmaColorToHex(fill.color),
          rgba: {
            r: Math.round(fill.color.r * 255),
            g: Math.round(fill.color.g * 255),
            b: Math.round(fill.color.b * 255),
            a: fill.color.a,
          },
        });
      }
    }
  }

  if (node.children) {
    for (const child of node.children) {
      extractColors(child, result);
    }
  }
}

/** 타이포그래피 토큰 추출: TEXT 노드에서 fontFamily, fontSize, fontWeight 추출 */
function extractTypography(node: FigmaNode, result: TypographyToken[]): void {
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

  if (node.children) {
    for (const child of node.children) {
      extractTypography(child, result);
    }
  }
}

/** 간격 토큰 추출: FRAME 노드에서 padding, gap 추출 */
function extractSpacing(node: FigmaNode, result: SpacingToken[]): void {
  if (node.type === 'FRAME') {
    const hasPadding = node.paddingTop || node.paddingRight || node.paddingBottom || node.paddingLeft;
    const hasGap = node.itemSpacing;

    if (hasPadding || hasGap) {
      result.push({
        name: node.name,
        paddingTop: node.paddingTop,
        paddingRight: node.paddingRight,
        paddingBottom: node.paddingBottom,
        paddingLeft: node.paddingLeft,
        gap: node.itemSpacing,
      });
    }
  }

  if (node.children) {
    for (const child of node.children) {
      extractSpacing(child, result);
    }
  }
}

/** 반경 토큰 추출: cornerRadius 추출 */
function extractRadius(node: FigmaNode, result: RadiusToken[]): void {
  if (node.cornerRadius !== undefined && node.cornerRadius > 0) {
    result.push({
      name: node.name,
      value: node.cornerRadius,
      corners: node.rectangleCornerRadii,
    });
  }

  if (node.children) {
    for (const child of node.children) {
      extractRadius(child, result);
    }
  }
}

// ===========================
// 메인 추출 엔진
// ===========================
export function extractTokens(rootNode: FigmaNode): ExtractedTokens {
  const colors: ColorToken[] = [];
  const typography: TypographyToken[] = [];
  const spacing: SpacingToken[] = [];
  const radius: RadiusToken[] = [];

  extractColors(rootNode, colors);
  extractTypography(rootNode, typography);
  extractSpacing(rootNode, spacing);
  extractRadius(rootNode, radius);

  return {
    colors: deduplicateByKey(colors, (c) => c.hex),
    typography: deduplicateByKey(typography, (t) => `${t.fontFamily}-${t.fontSize}-${t.fontWeight}`),
    spacing: deduplicateByKey(spacing, (s) => `${s.paddingTop}-${s.paddingRight}-${s.paddingBottom}-${s.paddingLeft}-${s.gap}`),
    radius: deduplicateByKey(radius, (r) => String(r.value)),
  };
}
