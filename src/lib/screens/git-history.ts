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
 * 특정 커밋 시점의 파일 전체 소스를 반환한다.
 * git show <hash>:<filePath>
 */
export function getCommitSource(filePath: string, hash: string): string {
  const cwd = process.cwd();
  return runGit(['show', `${hash}:${filePath}`], cwd);
}

/**
 * 두 커밋 사이의 unified diff를 반환한다.
 * 항상 오래된 → 최신 순으로 diff 방향을 유지.
 */
export function getCommitDiff(
  filePath: string,
  hashA: string,
  hashB: string,
): string {
  const cwd = process.cwd();
  const tsA = runGit(['log', '-1', '--format=%at', hashA], cwd);
  const tsB = runGit(['log', '-1', '--format=%at', hashB], cwd);
  const [older, newer] =
    parseInt(tsA, 10) <= parseInt(tsB, 10) ? [hashA, hashB] : [hashB, hashA];
  return runGit(['diff', older, newer, '--', filePath], cwd);
}

/**
 * 해당 커밋이 부모 대비 변경한 내용(unified diff)을 반환한다.
 * GitHub 커밋 뷰와 동일한 방식. 초기 커밋은 git show로 대체.
 */
export function getCommitParentDiff(filePath: string, hash: string): string {
  const cwd = process.cwd();
  const diff = runGit(['diff', `${hash}^`, hash, '--', filePath], cwd);
  if (diff) return diff;
  // 초기 커밋(부모 없음) 또는 해당 파일 변경 없음 → git show로 폴백
  return runGit(['show', '--format=', hash, '--', filePath], cwd);
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
