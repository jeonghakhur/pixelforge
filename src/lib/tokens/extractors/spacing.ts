import type { FigmaNode } from '@/lib/figma/api';
import type { SpacingToken } from './types';

/**
 * Variable/spacing/{name} 패턴 프레임에서 간격 토큰을 추출합니다.
 * - 토큰명: Variable Information > 첫 번째 TEXT (characters)
 * - 값: gap으로 저장 (단일 숫자값)
 */
export function extractSpacingNodes(node: FigmaNode, result: SpacingToken[]): void {
  const match = node.name.match(/^Variable\/spacing\/(.+)$/);
  if (match) {
    const varInfo = node.children?.find((c) => c.name === 'Variable Information');
    const firstText = varInfo?.children?.find(
      (c) => c.type === 'TEXT' && c.name !== 'Variable Description',
    );
    const rawValue = firstText?.characters ?? match[1];
    const value = parseFloat(rawValue);

    if (!isNaN(value)) {
      result.push({ name: rawValue, gap: value });
    }
    return;
  }

  for (const child of node.children ?? []) {
    extractSpacingNodes(child, result);
  }
}
