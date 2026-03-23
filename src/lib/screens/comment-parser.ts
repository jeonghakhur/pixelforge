export type ScreenStatus = 'wip' | 'dev-done' | 'qa-ready' | 'qa-done';

export interface ScreenMeta {
  route: string;
  filePath: string;
  name: string;
  description: string | null;
  authors: string[];
  category: string | null;
  status: ScreenStatus;
  sinceDate: string | null;
  updatedDate: string | null;
  figmaUrl: string | null;
  /** @visible false 태그로 초기 노출 여부를 설정. 관리자가 UI에서 변경 가능. */
  visible: boolean;
}

const VALID_STATUSES: ScreenStatus[] = ['wip', 'dev-done', 'qa-ready', 'qa-done'];

/** "Name — description" 또는 "Name - description" 분리 */
function parseName(raw: string): { name: string; description: string | null } {
  const match = raw.match(/^(.+?)\s*[—\-–]\s*(.+)$/);
  if (match) {
    return { name: match[1].trim(), description: match[2].trim() };
  }
  return { name: raw.trim(), description: null };
}

/** "김디자인, 이개발" → ["김디자인", "이개발"] */
function parseAuthors(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isValidStatus(value: string): value is ScreenStatus {
  return (VALID_STATUSES as string[]).includes(value);
}

/**
 * page.tsx 파일 내용에서 @page 주석 메타데이터를 파싱한다.
 * 단일 라인(// @tag value)과 JSDoc 블록(/** @tag value *\/) 모두 지원.
 * @page 태그가 없으면 null을 반환한다.
 */
export function parsePageComment(filePath: string, fileContent: string): ScreenMeta | null {
  // 파일 앞 4KB만 파싱 (성능 보장)
  const head = fileContent.slice(0, 4096);

  const tags: Record<string, string> = {};

  // 단일 라인: // @tag value
  const singleRe = /\/\/\s*@(\w+)\s+(.+)/g;
  let m: RegExpExecArray | null;
  while ((m = singleRe.exec(head)) !== null) {
    tags[m[1]] = m[2].trim();
  }

  // JSDoc 블록: * @tag value
  const jsdocRe = /\*\s*@(\w+)\s+(.+)/g;
  while ((m = jsdocRe.exec(head)) !== null) {
    tags[m[1]] = m[2].trim();
  }

  if (!tags['page']) return null;

  const { name, description } = parseName(tags['page']);
  const status = tags['status'] && isValidStatus(tags['status']) ? tags['status'] : 'wip';

  return {
    route: '',           // file-scanner에서 설정
    filePath,
    name,
    description,
    authors: tags['author'] ? parseAuthors(tags['author']) : [],
    category: tags['category'] ?? null,
    status,
    sinceDate: tags['since'] ?? null,
    updatedDate: tags['updated'] ?? null,
    figmaUrl: tags['figma'] ?? null,
    visible: tags['visible'] !== 'false',
  };
}
