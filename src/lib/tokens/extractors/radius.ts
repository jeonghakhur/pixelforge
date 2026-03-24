import type { FigmaNode } from '@/lib/figma/api';
import type { RadiusToken } from './types';

/**
 * Variable/radius/{name} 패턴 프레임에서 반경 토큰을 추출합니다.
 * - 토큰명: Variable Information > 첫 번째 TEXT (characters)
 * - 값: parseFloat
 */
export function extractRadiusNodes(node: FigmaNode, result: RadiusToken[]): void {
  const match = node.name.match(/^Variable\/radius\/(.+)$/);
  if (match) {
    const varInfo = node.children?.find((c) => c.name === 'Variable Information');
    const firstText = varInfo?.children?.find(
      (c) => c.type === 'TEXT' && c.name !== 'Variable Description',
    );
    const rawValue = firstText?.characters ?? match[1];
    const value = parseFloat(rawValue);

    if (!isNaN(value)) {
      result.push({ name: rawValue, value });
    }
    return;
  }

  for (const child of node.children ?? []) {
    extractRadiusNodes(child, result);
  }
}
