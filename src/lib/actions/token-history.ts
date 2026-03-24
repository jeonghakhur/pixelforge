'use server';

import { execSync } from 'child_process';

const CWD = process.cwd();
const TOKEN_FILE = 'design-tokens/tokens.css';

function exec(cmd: string): string {
  return execSync(cmd, { cwd: CWD, stdio: ['pipe', 'pipe', 'pipe'] })
    .toString()
    .trim();
}

export interface TokenCommit {
  hash: string;
  fullHash: string;
  date: string;
  message: string;
  author: string;
}

export async function getTokenCssHistoryAction(): Promise<{
  error: string | null;
  commits: TokenCommit[];
}> {
  try {
    // git 저장소 확인
    try {
      exec('git rev-parse --git-dir');
    } catch {
      return { error: null, commits: [] };
    }

    // 파일이 git에 추적되지 않으면 빈 목록 반환
    let fileTracked = true;
    try {
      exec(`git ls-files --error-unmatch ${TOKEN_FILE}`);
    } catch {
      fileTracked = false;
    }
    if (!fileTracked) return { error: null, commits: [] };

    const log = exec(
      `git log --follow --format="%h|%H|%ai|%s|%an" -- ${TOKEN_FILE}`,
    );
    if (!log) return { error: null, commits: [] };

    const commits: TokenCommit[] = log.split('\n').map((line) => {
      const [hash, fullHash, date, message, author] = line.split('|');
      return { hash, fullHash, date, message, author };
    });

    return { error: null, commits };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'git log 실패',
      commits: [],
    };
  }
}

export async function getTokenCssDiffAction(
  hashA: string,
  hashB: string,
): Promise<{ error: string | null; diff: string }> {
  try {
    const diff = exec(`git diff ${hashA} ${hashB} -- ${TOKEN_FILE}`);
    return { error: null, diff };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'diff 실패', diff: '' };
  }
}

export async function getTokenCssAtCommitAction(hash: string): Promise<{
  error: string | null;
  content: string;
}> {
  try {
    const content = exec(`git show ${hash}:${TOKEN_FILE}`);
    return { error: null, content };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'git show 실패',
      content: '',
    };
  }
}
