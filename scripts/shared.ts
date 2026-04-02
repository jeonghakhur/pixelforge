/**
 * scripts/ 공통 유틸리티
 *
 * Figma API 응답(nodes / document / raw) → rootNode 추출
 */

interface RawFigmaResponse {
  nodes?: Record<string, { document: unknown }>;
  document?: unknown;
}

export function getRootNode<T>(raw: unknown): T {
  const r = raw as RawFigmaResponse;
  if (r.nodes) {
    const firstKey = Object.keys(r.nodes)[0];
    return r.nodes[firstKey].document as T;
  }
  if (r.document) return r.document as T;
  return raw as T;
}
