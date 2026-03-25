import type { FigmaNode, FigmaColor } from '@/lib/figma/api';
import type { ColorToken } from './types';

function toHex(v: number): string {
  return Math.round(v * 255).toString(16).padStart(2, '0');
}

function figmaColorToHex(c: FigmaColor): string {
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

function figmaColorToRgba(c: FigmaColor) {
  return {
    r: Math.round(c.r * 255),
    g: Math.round(c.g * 255),
    b: Math.round(c.b * 255),
    a: c.a ?? 1,
  };
}

/**
 * Variable/{category}/{...} 패턴 프레임에서 색상 토큰을 추출합니다.
 * - 토큰명: Variable Information > 첫 번째 TEXT (characters)
 * - 색상값: Variable Layer > Swatch > fills[SOLID]
 */
const GENERIC_SWATCH = /^(swatch|color chip|color sample|dot|spot|square)$/i;

export function extractColorNodes(node: FigmaNode, result: ColorToken[]): void {
  // Pattern 1: Variable/{category}/... showcase structure
  const match = node.name.match(/^Variable\/([^/]+)\/.+$/);
  if (match) {
    const category = match[1];

    const varInfo = node.children?.find((c) => c.name === 'Variable Information');
    const firstText = varInfo?.children?.find(
      (c) => c.type === 'TEXT' && c.name !== 'Variable Description',
    );
    const tokenName = (firstText?.characters?.trim() ?? node.name.split('/').pop() ?? '');

    const varLayer = node.children?.find((c) => c.name === 'Variable Layer');
    const swatch = varLayer?.children?.find((c) => c.name === 'Swatch');
    const fill = swatch?.fills?.find((f) => f.type === 'SOLID' && f.color);

    if (fill?.color) {
      result.push({
        name: `${category}/${tokenName}`,
        hex: figmaColorToHex(fill.color),
        rgba: figmaColorToRgba(fill.color),
      });
    }
    return;
  }

  // Pattern 2: Frame containing a generic "Swatch" child (community UI kit pattern)
  // e.g. Frame "Yellow bright" > Rectangle "Swatch" (direct fill)
  if (node.children) {
    const swatch = node.children.find(
      (c) => GENERIC_SWATCH.test(c.name) && c.fills?.some((f) => f.type === 'SOLID' && f.color),
    );
    if (swatch) {
      const fill = swatch.fills?.find((f) => f.type === 'SOLID' && f.color);
      if (fill?.color) {
        result.push({
          name: node.name,
          hex: figmaColorToHex(fill.color),
          rgba: figmaColorToRgba(fill.color),
        });
      }
      return;
    }
  }

  for (const child of node.children ?? []) {
    extractColorNodes(child, result);
  }
}
