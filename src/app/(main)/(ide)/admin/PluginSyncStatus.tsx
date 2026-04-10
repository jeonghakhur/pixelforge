'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import Card from '@/components/common/Card';
import {
  getPluginSyncHistoryAction,
  deleteSnapshotAction,
  type ProjectSyncHistory,
} from '@/lib/actions/plugin-sync-admin';
import styles from './page.module.scss';

const TYPE_LABEL: Record<string, string> = {
  icons: '아이콘',
  images: '이미지',
  themes: '테마',
  components: '컴포넌트',
};

function formatRelative(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function ProjectRow({ project, onRefresh }: { project: ProjectSyncHistory; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const latestSnapshot = project.snapshots[0];

  const handleDelete = async (snapshotId: string) => {
    setDeletingId(snapshotId);
    await deleteSnapshotAction(snapshotId);
    setDeletingId(null);
    onRefresh();
  };

  return (
    <div className={styles.syncProject}>
      {/* 프로젝트 헤더 */}
      <button
        type="button"
        className={styles.syncProjectHeader}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={styles.syncProjectLeft}>
          <Icon icon="solar:figma-linear" width={16} height={16} className={styles.syncFigmaIcon} />
          <span className={styles.syncProjectName}>{project.name}</span>
        </div>
        <div className={styles.syncProjectMeta}>
          {latestSnapshot ? (
            <span className={styles.syncMetaText}>
              토큰: v{latestSnapshot.version} · {formatRelative(latestSnapshot.createdAt)} ({latestSnapshot.totalCount}개)
            </span>
          ) : (
            <span className={styles.syncMetaText}>토큰: 미전송</span>
          )}
          {['icons', 'images', 'themes', 'components'].map((type) => {
            const sync = project.otherSyncs.find((s) => s.type === type);
            return (
              <span key={type} className={styles.syncMetaText}>
                {TYPE_LABEL[type]}: {sync ? `v${sync.version}` : '미전송'}
              </span>
            );
          })}
        </div>
        <Icon
          icon={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
          width={14}
          height={14}
          className={styles.syncChevron}
        />
      </button>

      {/* 스냅샷 목록 */}
      {expanded && project.snapshots.length > 0 && (
        <ul className={styles.syncVersionList}>
          {project.snapshots.map((snap) => {
            const countEntries = Object.entries(snap.counts).filter(([, v]) => v > 0);
            return (
              <li key={snap.id} className={styles.syncVersionRow}>
                <span className={styles.syncVersionBadge}>v{snap.version}</span>
                <div className={styles.syncVersionBody}>
                  <span className={styles.syncVersionTime}>
                    {formatRelative(snap.createdAt)} · 총 {snap.totalCount}개
                  </span>
                  {countEntries.length > 0 && (
                    <span className={styles.syncVersionBreakdown}>
                      {countEntries.map(([type, count]) => `${type} ${count}개`).join(' · ')}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.syncDeleteBtn}
                  onClick={() => handleDelete(snap.id)}
                  disabled={deletingId === snap.id}
                  aria-label={`v${snap.version} 삭제`}
                >
                  {deletingId === snap.id ? (
                    <div className={styles.miniSpinner} />
                  ) : (
                    <>
                      <Icon icon="solar:trash-bin-2-linear" width={13} height={13} />
                      이 버전 삭제
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function PluginSyncStatus() {
  const [projects, setProjects] = useState<ProjectSyncHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await getPluginSyncHistoryAction();
    setProjects(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Card className={styles.tableCard}>
      <div className={styles.cardHeader}>
        <Icon icon="solar:refresh-circle-linear" width={18} height={18} />
        <h2 className={styles.cardTitle}>Figma 플러그인 연동 현황</h2>
      </div>
      <p className={styles.settingsDesc}>
        플러그인에서 전송된 Figma 파일별 동기화 이력입니다.
      </p>

      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} aria-label="로딩 중" />
        </div>
      ) : projects.length === 0 ? (
        <p className={styles.settingsDesc} style={{ marginTop: '12px' }}>
          아직 플러그인 sync 이력이 없습니다.
        </p>
      ) : (
        <div className={styles.syncProjectList}>
          {projects.map((p) => (
            <ProjectRow key={p.id} project={p} onRefresh={load} />
          ))}
        </div>
      )}
    </Card>
  );
}
