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
  boundVariables?: {
    fills?: Array<{ type: 'VARIABLE_ALIAS'; id: string }>;
  };
  /**
   * REST API 표준 Named Style 참조 맵
   * key: "fills" | "text" | "strokes" | "effect"
   * value: "S:abc123" 형식 styleId
   */
  styles?: Record<string, string>;
  /** TEXT 노드의 실제 텍스트 내용 */
  characters?: string;
  /** Auto Layout 방향 */
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  /** 노드 경계 박스 — 원형 판별용 */
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
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

// ===========================
// Variables API 타입
// ===========================
export interface FigmaVariableValue {
  r?: number;
  g?: number;
  b?: number;
  a?: number;
  type?: 'VARIABLE_ALIAS';
  id?: string;
}

export interface FigmaVariable {
  id: string;
  name: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  valuesByMode: Record<string, FigmaVariableValue | number | string | boolean>;
  scopes: string[];
  hiddenFromPublishing: boolean;
}

export interface FigmaVariableCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  defaultModeId: string;
  variableIds: string[];
}

export interface FigmaVariablesResponse {
  meta: {
    variableCollections: Record<string, FigmaVariableCollection>;
    variables: Record<string, FigmaVariable>;
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

/**
 * Figma URL에서 node-id를 추출하여 API 형식(1:234)으로 반환
 * - URL 형식 1: ?node-id=1%3A234 (콜론 URL 인코딩)
 * - URL 형식 2: ?node-id=1-234 (하이픈으로 콜론 대체)
 */
export function extractNodeId(url: string): string | null {
  try {
    const u = new URL(url);
    const raw = u.searchParams.get('node-id');
    if (!raw) return null;
    // searchParams.get이 %3A → : 자동 디코딩, 하이픈 형식은 직접 변환
    return raw.includes(':') ? raw : raw.replace('-', ':');
  } catch {
    return null;
  }
}

export class FigmaClient {
  private readonly baseUrl = 'https://api.figma.com/v1';
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, retries = 3): Promise<T> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'X-Figma-Token': this.token,
      },
    });

    if (res.status === 429 && retries > 0) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '10', 10);
      const delay = (retryAfter || 10) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.request<T>(endpoint, retries - 1);
    }

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Figma API error (${res.status}): ${errorBody}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * 파일 버전만 경량 조회 (depth=0 — 문서 트리 제외)
   * 캐시 유효성 검사용. 실패 시 null 반환.
   */
  async getFileVersion(fileKey: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/files/${fileKey}?depth=0`, {
        headers: { 'X-Figma-Token': this.token },
      });
      if (!res.ok) return null;
      const data = await res.json() as { version?: string };
      return data.version ?? null;
    } catch {
      return null;
    }
  }

  /** 파일 전체 정보 조회 */
  async getFile(fileKey: string): Promise<FigmaFileResponse> {
    return this.request<FigmaFileResponse>(`/files/${fileKey}`);
  }

  /** 특정 노드 조회 */
  async getNodes(fileKey: string, nodeIds: string[]): Promise<{ name: string; nodes: Record<string, { document: FigmaNode }> }> {
    const ids = nodeIds.join(',');
    return this.request(`/files/${fileKey}/nodes?ids=${ids}`);
  }

  /** 파일에 정의된 스타일 목록 조회 */
  async getStyles(fileKey: string): Promise<FigmaStylesResponse> {
    return this.request<FigmaStylesResponse>(`/files/${fileKey}/styles`);
  }

  /** 노드 이미지 URL 조회 */
  async getImages(
    fileKey: string,
    nodeIds: string[],
    format: 'png' | 'jpg' | 'svg' = 'png',
    scale = 2,
  ): Promise<{ images: Record<string, string> }> {
    const ids = nodeIds.join(',');
    return this.request(
      `/images/${fileKey}?ids=${ids}&format=${format}&scale=${scale}`,
    );
  }

  /**
   * 파일의 로컬 Variables 조회
   * - 커뮤니티 파일(읽기 전용)은 403 반환 → null 반환으로 폴백 신호
   * - Variables 없는 파일은 빈 meta 반환
   */
  async getVariables(fileKey: string): Promise<FigmaVariablesResponse | null> {
    try {
      return await this.request<FigmaVariablesResponse>(
        `/files/${fileKey}/variables/local`,
      );
    } catch (err) {
      if (err instanceof Error && /Figma API error \(40[34]\)/.test(err.message)) {
        return null;
      }
      throw err;
    }
  }
}

export type { FigmaNode, FigmaPaint, FigmaColor, FigmaTypeStyle, FigmaFileResponse };

// ===========================
// 파일 구조 (페이지 + 프레임 목록)
// ===========================
export interface FigmaFrameInfo {
  id: string;
  name: string;
  type: string;
}

export interface FigmaPageInfo {
  id: string;
  name: string;
  frames: FigmaFrameInfo[];
}

/** 전체 문서 트리에서 페이지 → 직계 프레임만 추출 (토큰 추출 없음) */
export function parseFileStructure(document: FigmaNode): FigmaPageInfo[] {
  return (document.children ?? []).map((page) => ({
    id: page.id,
    name: page.name,
    frames: (page.children ?? [])
      .filter((n) => ['FRAME', 'GROUP', 'COMPONENT', 'COMPONENT_SET', 'SECTION'].includes(n.type))
      .map((n) => ({ id: n.id, name: n.name, type: n.type })),
  }));
}
