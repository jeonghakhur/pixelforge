interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface FigmaPaint {
  type: string;
  color?: FigmaColor;
}

interface FigmaTypeStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeightPx?: number;
  letterSpacing?: number;
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  fills?: FigmaPaint[];
  style?: FigmaTypeStyle;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
}

interface FigmaFileResponse {
  name: string;
  document: FigmaNode;
  styles: Record<string, { name: string; styleType: string }>;
}

interface FigmaStylesResponse {
  meta: {
    styles: Array<{
      key: string;
      name: string;
      style_type: string;
      node_id: string;
    }>;
  };
}

/**
 * Figma URL에서 file key 추출
 * 지원 형식:
 *   https://www.figma.com/file/{key}/...
 *   https://www.figma.com/design/{key}/...
 */
export function extractFileKey(url: string): string | null {
  const patterns = [
    /figma\.com\/file\/([a-zA-Z0-9]+)/,
    /figma\.com\/design\/([a-zA-Z0-9]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

export class FigmaClient {
  private readonly baseUrl = 'https://api.figma.com/v1';
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'X-Figma-Token': this.token,
      },
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Figma API error (${res.status}): ${errorBody}`);
    }

    return res.json() as Promise<T>;
  }

  /** 파일 전체 정보 조회 */
  async getFile(fileKey: string): Promise<FigmaFileResponse> {
    return this.request<FigmaFileResponse>(`/files/${fileKey}`);
  }

  /** 특정 노드 조회 */
  async getNodes(fileKey: string, nodeIds: string[]): Promise<{ nodes: Record<string, { document: FigmaNode }> }> {
    const ids = nodeIds.join(',');
    return this.request(`/files/${fileKey}/nodes?ids=${ids}`);
  }

  /** 파일에 정의된 스타일 목록 조회 */
  async getStyles(fileKey: string): Promise<FigmaStylesResponse> {
    return this.request<FigmaStylesResponse>(`/files/${fileKey}/styles`);
  }
}

export type { FigmaNode, FigmaPaint, FigmaColor, FigmaTypeStyle, FigmaFileResponse };
