import { spawnSync } from 'child_process';

export interface GitCommit {
  hash: string;
  date: string;
  author: string;
  message: string;
}

export interface GitFileDates {
  sinceDate: string | null;
  updatedDate: string | null;
}

function runGit(args: string[], cwd: string): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0 || result.error) return '';
  return result.stdout.trim();
}

/**
 * 파일의 첫 커밋(생성일)과 마지막 커밋(최종수정일)을 반환한다.
 * git 히스토리가 없으면 null.
 */
export function getFileGitDates(filePath: string): GitFileDates {
  const cwd = process.cwd();

  const lastOut = runGit(
    ['log', '-1', '--format=%ad', '--date=short', '--', filePath],
    cwd,
  );
  const updatedDate = lastOut || null;

  // --diff-filter=A: 파일이 처음 추가된 커밋만, --follow: 리네임 추적
  const allOut = runGit(
    ['log', '--diff-filter=A', '--follow', '--format=%ad', '--date=short', '--', filePath],
    cwd,
  );
  const lines = allOut.split('\n').filter(Boolean);
  const sinceDate = lines[lines.length - 1] || null;

  return { sinceDate, updatedDate };
}

/**
 * 파일의 커밋 이력을 최신 순으로 반환한다.
 */
export function getFileGitLog(filePath: string, limit = 10): GitCommit[] {
  const cwd = process.cwd();
  const SEP = '\x1f';
  const out = runGit(
    ['log', `-${limit}`, `--format=%H${SEP}%ad${SEP}%an${SEP}%s`, '--date=short', '--', filePath],
    cwd,
  );
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, date, author, message] = line.split(SEP);
      return {
        hash: (hash ?? '').slice(0, 7),
        date: date ?? '',
        author: author ?? '',
        message: message ?? '',
      };
    });
}
