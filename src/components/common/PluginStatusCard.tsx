'use client';

import { Icon } from '@iconify/react';
import type { SyncProjectStatus, SyncItem } from '@/lib/actions/sync-status';
import styles from './PluginStatusCard.module.scss';

interface Props {
  syncProjects: SyncProjectStatus[];
  onSettingsClick: () => void;
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function getLatestTokenSync(project: SyncProjectStatus): SyncItem | null {
  return project.syncs.find((s) => s.type === 'tokens') ?? null;
}

export default function PluginStatusCard({ syncProjects, onSettingsClick }: Props) {
  const hasSync = syncProjects.length > 0;
  const latestProject = syncProjects[0];
  const tokenSync = latestProject ? getLatestTokenSync(latestProject) : null;

  if (!hasSync || !tokenSync) {
    return (
      <div className={`${styles.card} ${styles.cardDisconnected}`}>
        <div className={styles.statusRow}>
          <span className={`${styles.dot} ${styles.dotOff}`} />
          <span className={styles.statusLabel}>플러그인 미연결</span>
        </div>
        <p className={styles.desc}>
          Figma 플러그인을 설치하고 API 키를 연결하면 토큰이 자동으로 동기화됩니다.
        </p>
        <button type="button" className={styles.actionBtn} onClick={onSettingsClick}>
          플러그인 설정하기
          <Icon icon="solar:arrow-right-linear" width={12} height={12} />
        </button>
      </div>
    );
  }

  return (
    <div className={`${styles.card} ${styles.cardConnected}`}>
      <div className={styles.statusRow}>
        <span className={`${styles.dot} ${styles.dotOn}`} />
        <span className={styles.statusLabel}>플러그인 연결됨</span>
        <span className={styles.projectName}>{latestProject.name}</span>
      </div>

      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <Icon icon="solar:clock-circle-linear" width={11} height={11} />
          마지막 sync: {formatRelativeTime(tokenSync.syncedAt)}
        </span>
        <span className={styles.metaSep}>·</span>
        <span className={styles.metaItem}>
          <Icon icon="solar:hashtag-linear" width={11} height={11} />
          v{tokenSync.version}
        </span>
        {tokenSync.count !== undefined && (
          <>
            <span className={styles.metaSep}>·</span>
            <span className={styles.metaItem}>
              <Icon icon="solar:layers-minimalistic-linear" width={11} height={11} />
              {tokenSync.count}개 토큰
            </span>
          </>
        )}
      </div>

      <button type="button" className={styles.linkBtn} onClick={onSettingsClick}>
        sync 현황 보기
        <Icon icon="solar:arrow-right-linear" width={11} height={11} />
      </button>
    </div>
  );
}
