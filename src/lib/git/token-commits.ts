import { execSync, type ExecSyncOptionsWithBufferEncoding } from 'child_process';
import fs from 'fs';
import path from 'path';

const CWD = process.cwd();
const TOKENS_CSS_PATH = path.join(CWD, 'design-tokens', 'tokens.css');
const GIT_AUTHOR_FLAGS = '-c user.name="PixelForge" -c user.email="bot@pixelforge.local"';

function exec(cmd: string): string {
  const opts: ExecSyncOptionsWithBufferEncoding = { cwd: CWD, stdio: ['pipe', 'pipe', 'pipe'] };
  return execSync(cmd, opts).toString().trim();
}

export interface CommitTokensResult {
  committed: boolean;
  hash: string | null;
  error: string | null;
}

/**
 * tokens.css 파일을 저장하고 변경이 있을 때만 git commit.
 * git 저장소가 없거나 실패해도 에러를 throw하지 않음 (추출 자체를 막으면 안 됨).
 */
export function commitTokensCss(
  cssContent: string,
  commitMessage: string,
): CommitTokensResult {
  try {
    fs.mkdirSync(path.dirname(TOKENS_CSS_PATH), { recursive: true });
    fs.writeFileSync(TOKENS_CSS_PATH, cssContent, 'utf-8');

    try {
      exec('git rev-parse --git-dir');
    } catch {
      return { committed: false, hash: null, error: 'git 저장소가 없습니다.' };
    }

    const statusOutput = exec('git status --porcelain design-tokens/tokens.css');
    if (!statusOutput) {
      return { committed: false, hash: null, error: null };
    }

    exec('git add design-tokens/tokens.css');
    const safeMsg = commitMessage.replace(/"/g, '\\"');
    exec(`git ${GIT_AUTHOR_FLAGS} commit -m "${safeMsg}" --no-verify`);

    const hash = exec('git rev-parse --short HEAD');
    return { committed: true, hash, error: null };
  } catch (err) {
    return {
      committed: false,
      hash: null,
      error: err instanceof Error ? err.message : 'git commit 실패',
    };
  }
}

export function buildCommitMessage(counts: {
  colors: number;
  typography: number;
  spacing: number;
  radii: number;
}): string {
  const parts = [
    counts.colors     > 0 && `색상 ${counts.colors}`,
    counts.typography > 0 && `타이포 ${counts.typography}`,
    counts.spacing    > 0 && `간격 ${counts.spacing}`,
    counts.radii      > 0 && `반경 ${counts.radii}`,
  ].filter(Boolean) as string[];

  return `tokens: ${parts.join(' · ')}`;
}
