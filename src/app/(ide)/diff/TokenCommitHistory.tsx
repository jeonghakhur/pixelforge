'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import {
  getTokenCssHistoryAction,
  type TokenCommit,
} from '@/lib/actions/token-history';
import Spinner from '@/components/common/Spinner';
import TokenDiffModal from './TokenDiffModal';
import styles from './token-commit-history.module.scss';

function formatRelativeDate(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);
    const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
    if (days >= 1) return rtf.format(-days, 'day');
    if (hours >= 1) return rtf.format(-hours, 'hour');
    if (minutes >= 1) return rtf.format(-minutes, 'minute');
    return '방금';
  } catch {
    return iso.slice(0, 10);
  }
}

export default function TokenCommitHistory() {
  const [commits, setCommits] = useState<TokenCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommit, setSelectedCommit] = useState<TokenCommit | null>(null);

  useEffect(() => {
    getTokenCssHistoryAction().then((result) => {
      setCommits(result.commits);
      setLoading(false);
    });
  }, []);

  const handleClose = useCallback(() => setSelectedCommit(null), []);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <Icon icon="solar:history-linear" width={18} height={18} />
          커밋 이력
        </h2>
      </div>

      {loading ? (
        <div className={styles.emptyState}>
          <Spinner size="sm" />
          <span>불러오는 중...</span>
        </div>
      ) : commits.length === 0 ? (
        <div className={styles.emptyState}>
          <Icon icon="solar:info-circle-linear" width={16} height={16} />
          <span>아직 추출된 토큰이 없습니다. 토큰을 추출하면 자동으로 기록됩니다.</span>
        </div>
      ) : (
        <div className={styles.commitList}>
          {commits.map((commit) => (
            <button
              key={commit.hash}
              type="button"
              className={styles.commitRow}
              onClick={() => setSelectedCommit(commit)}
            >
              <Icon
                icon="solar:alt-arrow-right-linear"
                width={14}
                height={14}
                className={styles.chevron}
              />
              <code className={styles.hash}>{commit.hash}</code>
              <span className={styles.message}>{commit.message}</span>
              <span className={styles.authorName}>{commit.author}</span>
              <span className={styles.date}>{formatRelativeDate(commit.date)}</span>
            </button>
          ))}
        </div>
      )}

      {selectedCommit && (
        <TokenDiffModal commit={selectedCommit} onClose={handleClose} />
      )}
    </section>
  );
}
