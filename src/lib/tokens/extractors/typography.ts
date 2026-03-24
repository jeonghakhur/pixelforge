import type { FigmaNode } from '@/lib/figma/api';
import type { TypographyToken } from './types';

/**
 * Variable/type/{category}/{name} 패턴 프레임에서 타이포그래피 토큰을 추출합니다.
 * - 토큰명: category/name (예: size/16, line-height/24)
 * - 값: Variable Information > 첫 번째 TEXT (characters) → parseFloat
 */
export function extractTypographyNodes(node: FigmaNode, result: TypographyToken[]): void {
  const match = node.name.match(/^Variable\/type\/([^/]+)\/(.+)$/);
  if (match) {
    const category = match[1]; // size | line-height | letter-spacing

    const varInfo = node.children?.find((c) => c.name === 'Variable Information');
    const firstText = varInfo?.children?.find(
      (c) => c.type === 'TEXT' && c.name !== 'Variable Description',
    );
    const rawValue = firstText?.characters ?? match[2];
    const numericValue = parseFloat(rawValue);

    if (!isNaN(numericValue)) {
      result.push({
        name: `${category}/${rawValue}`,
        fontFamily: '',
        fontSize: category === 'size' ? numericValue : 0,
        fontWeight: 400,
        lineHeight: category === 'line-height' ? numericValue : undefined,
        letterSpacing: category === 'letter-spacing' ? numericValue : undefined,
      });
    }
    return;
  }

  for (const child of node.children ?? []) {
    extractTypographyNodes(child, result);
  }
}
