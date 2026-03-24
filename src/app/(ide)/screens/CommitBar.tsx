'use client';

import { Icon } from '@iconify/react';
import type { GitCommit } from '@/lib/screens/git-history';
import styles from './CodeViewModal.module.scss';

interface CommitBarProps {
  mode: 'source' | 'diff' | 'commit';
  commitMeta: GitCommit | null | undefined;
  commitA: GitCommit | null | undefined;
  commitB: GitCommit | null | undefined;
  hashA?: string;
  hashB?: string;
}

export function CommitBar({ mode, commitMeta, commitA, commitB, hashA, hashB }: CommitBarProps) {
  return (
    <div className={styles.commitBar}>
      {(mode === 'source' || mode === 'commit') && commitMeta ? (
        <>
          <div className={styles.commitBarLeft}>
            <div className={styles.commitAvatar}>
              {commitMeta.author.slice(0, 1).toUpperCase()}
            </div>
            <span className={styles.commitAuthor}>{commitMeta.author}</span>
            <span className={styles.commitMessage}>{commitMeta.message}</span>
          </div>
          <div className={styles.commitBarRight}>
            <code className={styles.commitHash}>
              <Icon icon="solar:code-square-linear" width={12} height={12} />
              {commitMeta.hash}
            </code>
            <span className={styles.commitDate}>{commitMeta.date}</span>
          </div>
        </>
      ) : (
        <>
          <div className={styles.commitBarLeft}>
            <Icon icon="solar:code-scan-linear" width={14} height={14} style={{ color: '#79c0ff', flexShrink: 0 }} />
            <span className={styles.commitMessage}>커밋 비교</span>
            <code className={styles.commitHash}>
              <Icon icon="solar:code-square-linear" width={12} height={12} />
              {commitA?.hash ?? hashA}
            </code>
            <Icon icon="solar:arrow-right-linear" width={11} height={11} style={{ color: '#6e7681', flexShrink: 0 }} />
            <code className={styles.commitHash}>
              <Icon icon="solar:code-square-linear" width={12} height={12} />
              {commitB?.hash ?? hashB}
            </code>
          </div>
          <div className={styles.commitBarRight}>
            <span className={styles.commitDate}>{commitA?.date} → {commitB?.date}</span>
          </div>
        </>
      )}
    </div>
  );
}
