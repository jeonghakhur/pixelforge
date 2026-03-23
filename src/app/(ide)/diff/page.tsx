// @page Diff — 스냅샷 버전 관리
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import {
  getSnapshotsAction,
  compareSnapshotsAction,
  rollbackToSnapshotAction,
  deleteSnapshotAction,
  type SnapshotListItem,
} from '@/lib/actions/snapshots';
import type { SnapshotDiffSummary, TokenDiffItem } from '@/lib/tokens/snapshot-engine';
import styles from './page.module.scss';

type DiffStatus = 'changed' | 'added' | 'removed';

const STATUS_CONFIG: Record<DiffStatus, { label: string; icon: string }> = {
  changed: { label: '변경됨', icon: 'solar:pen-new-square-linear' },
  added: { label: '신규', icon: 'solar:add-circle-linear' },
  removed: { label: '삭제됨', icon: 'solar:minus-circle-linear' },
};

const SOURCE_LABELS: Record<string, string> = {
  variables: 'Variables API',
  'styles-api': 'Named Styles',
  'section-scan': '섹션 스캔',
  'node-scan': '노드 스캔',
};

const TOKEN_TYPE_LABELS: Record<string, string> = {
  color: '색상',
  typography: '타이포',
  spacing: '간격',
  radius: '반경',
  shadow: '그림자',
  opacity: '불투명도',
  border: '테두리',
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  } catch {
    return iso;
  }
}

function formatTokenCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${TOKEN_TYPE_LABELS[k] ?? k} ${v}`)
    .join(', ');
}

function renderDiffValue(item: TokenDiffItem): { label: string; rawValue: string } | null {
  if (item.change === 'changed') {
    return {
      label: `${item.oldRaw ?? '?'} → ${item.newRaw ?? '?'}`,
      rawValue: item.newValue ?? '',
    };
  }
  if (item.change === 'added') {
    return { label: item.newRaw ?? '', rawValue: item.newValue ?? '' };
  }
  if (item.change === 'removed') {
    return { label: item.oldRaw ?? '', rawValue: item.oldValue ?? '' };
  }
  return null;
}

export default function DiffPage() {
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Compare state
  const [baseId, setBaseId] = useState('');
  const [compareId, setCompareId] = useState('');
  const [diff, setDiff] = useState<SnapshotDiffSummary | null>(null);
  const [comparing, setComparing] = useState(false);
  const [filter, setFilter] = useState<DiffStatus | 'all'>('all');

  // Rollback confirm
  const [rollbackTarget, setRollbackTarget] = useState<SnapshotListItem | null>(null);
  const [rolling, setRolling] = useState(false);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    const result = await getSnapshotsAction();
    if (!result.error) {
      setSnapshots(result.snapshots);
      // 기본 선택: 최신 2개
      if (result.snapshots.length >= 2) {
        setBaseId(result.snapshots[1].id);
        setCompareId(result.snapshots[0].id);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadSnapshots(); }, [loadSnapshots]);

  const handleCompare = async () => {
    if (!baseId || !compareId || baseId === compareId) return;
    setComparing(true);
    setDiff(null);
    const result = await compareSnapshotsAction(baseId, compareId);
    if (!result.error && result.diff) {
      setDiff(result.diff);
    }
    setComparing(false);
  };

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    setRolling(true);
    const result = await rollbackToSnapshotAction(rollbackTarget.id);
    setRolling(false);
    setRollbackTarget(null);
    if (!result.error) {
      await loadSnapshots();
    }
  };

  const totalChanges = diff
    ? diff.added.length + diff.removed.length + diff.changed.length
    : 0;

  const allDiffItems: TokenDiffItem[] = diff
    ? [...diff.added, ...diff.removed, ...diff.changed]
    : [];

  const filteredItems = filter === 'all'
    ? allDiffItems
    : allDiffItems.filter((item) => item.change === filter);

  const isEmpty = snapshots.length === 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Version Control</span>
        <h1 className={styles.title}>스냅샷 버전 관리</h1>
        <p className={styles.description}>
          토큰 추출 시 자동 생성되는 스냅샷으로 변경 이력을 추적하고, 이전 버전으로 롤백할 수 있습니다.
        </p>
      </div>

      {loading ? (
        <div className={styles.stage}>
          <div className={styles.stageInner}>
            <Icon icon="solar:refresh-linear" width={24} height={24} className="spin" />
          </div>
        </div>
      ) : isEmpty ? (
        <div className={styles.stage}>
          <div className={styles.stageInner}>
            <EmptyState
              icon="solar:history-linear"
              title="스냅샷이 없습니다"
              description="토큰을 추출하면 자동으로 스냅샷이 생성됩니다. 두 번 이상 추출하면 버전 간 비교가 가능합니다."
              action={
                <Button variant="primary" leftIcon="solar:link-linear">
                  토큰 추출하기
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <>
          {/* ── 스냅샷 타임라인 ── */}
          <section className={styles.timeline}>
            <h2 className={styles.sectionTitle}>
              <Icon icon="solar:history-linear" width={18} height={18} />
              스냅샷 히스토리
              <span className={styles.countBadge}>{snapshots.length}</span>
            </h2>
            <div className={styles.snapshotList}>
              {snapshots.map((snap) => {
                const hasDiff = snap.diffSummary !== null;
                const diffTotal = hasDiff
                  ? (snap.diffSummary?.added.length ?? 0) +
                    (snap.diffSummary?.removed.length ?? 0) +
                    (snap.diffSummary?.changed.length ?? 0)
                  : 0;

                return (
                  <div key={snap.id} className={styles.snapshotCard}>
                    <div className={styles.snapshotHeader}>
                      <span className={styles.snapshotVersion}>v{snap.version}</span>
                      <span className={styles.snapshotDate}>{formatDate(snap.createdAt)}</span>
                      <span className={styles.snapshotSource}>
                        {SOURCE_LABELS[snap.source] ?? snap.source}
                      </span>
                      {hasDiff && diffTotal > 0 && (
                        <Badge variant="warning">{diffTotal}건 변경</Badge>
                      )}
                      {snap.version === snapshots[0].version && (
                        <Badge variant="success">최신</Badge>
                      )}
                    </div>
                    <div className={styles.snapshotMeta}>
                      <span className={styles.snapshotCounts}>
                        {formatTokenCounts(snap.tokenCounts)}
                      </span>
                      {snap.figmaVersion && (
                        <span className={styles.snapshotFigmaVer}>
                          Figma: {snap.figmaVersion.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    {hasDiff && snap.diffSummary && diffTotal > 0 && (
                      <div className={styles.snapshotDiffChips}>
                        {snap.diffSummary.added.length > 0 && (
                          <span className={styles.chipAdded}>
                            +{snap.diffSummary.added.length} 추가
                          </span>
                        )}
                        {snap.diffSummary.removed.length > 0 && (
                          <span className={styles.chipRemoved}>
                            -{snap.diffSummary.removed.length} 삭제
                          </span>
                        )}
                        {snap.diffSummary.changed.length > 0 && (
                          <span className={styles.chipChanged}>
                            ~{snap.diffSummary.changed.length} 변경
                          </span>
                        )}
                      </div>
                    )}
                    <div className={styles.snapshotActions}>
                      {snap.version !== snapshots[0].version && (
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => setRollbackTarget(snap)}
                          aria-label={`v${snap.version}으로 롤백`}
                        >
                          <Icon icon="solar:undo-left-linear" width={14} height={14} />
                          롤백
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── 버전 비교 ── */}
          {snapshots.length >= 2 && (
            <section className={styles.compareSection}>
              <h2 className={styles.sectionTitle}>
                <Icon icon="solar:code-scan-linear" width={18} height={18} />
                버전 비교
              </h2>
              <div className={styles.controls}>
                <div className={styles.versionSelect}>
                  <label htmlFor="base-version" className={styles.selectLabel}>Base</label>
                  <select
                    id="base-version"
                    className={styles.select}
                    value={baseId}
                    onChange={(e) => setBaseId(e.target.value)}
                  >
                    {snapshots.map((s) => (
                      <option key={s.id} value={s.id}>v{s.version} — {formatDate(s.createdAt)}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.arrow}>
                  <Icon icon="solar:arrow-right-linear" width={16} height={16} />
                </div>
                <div className={styles.versionSelect}>
                  <label htmlFor="compare-version" className={styles.selectLabel}>Compare</label>
                  <select
                    id="compare-version"
                    className={styles.select}
                    value={compareId}
                    onChange={(e) => setCompareId(e.target.value)}
                  >
                    {snapshots.map((s) => (
                      <option key={s.id} value={s.id}>v{s.version} — {formatDate(s.createdAt)}</option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="primary"
                  leftIcon="solar:refresh-linear"
                  loading={comparing}
                  disabled={baseId === compareId}
                  onClick={handleCompare}
                >
                  비교
                </Button>
              </div>

              {/* ── Diff 결과 ── */}
              {diff && (
                <>
                  {totalChanges === 0 ? (
                    <div className={styles.noDiff}>
                      <Icon icon="solar:check-circle-linear" width={20} height={20} />
                      두 버전이 동일합니다. 변경 사항이 없습니다.
                    </div>
                  ) : (
                    <>
                      <div className={styles.statusBar}>
                        <button
                          type="button"
                          className={`${styles.statusChip} ${filter === 'all' ? styles.statusActive : ''}`}
                          onClick={() => setFilter('all')}
                        >
                          전체 {totalChanges}
                        </button>
                        {diff.added.length > 0 && (
                          <button
                            type="button"
                            className={`${styles.statusChip} ${styles.status_added} ${filter === 'added' ? styles.statusActive : ''}`}
                            onClick={() => setFilter('added')}
                          >
                            <Icon icon={STATUS_CONFIG.added.icon} width={14} height={14} />
                            신규 {diff.added.length}
                          </button>
                        )}
                        {diff.removed.length > 0 && (
                          <button
                            type="button"
                            className={`${styles.statusChip} ${styles.status_removed} ${filter === 'removed' ? styles.statusActive : ''}`}
                            onClick={() => setFilter('removed')}
                          >
                            <Icon icon={STATUS_CONFIG.removed.icon} width={14} height={14} />
                            삭제 {diff.removed.length}
                          </button>
                        )}
                        {diff.changed.length > 0 && (
                          <button
                            type="button"
                            className={`${styles.statusChip} ${styles.status_changed} ${filter === 'changed' ? styles.statusActive : ''}`}
                            onClick={() => setFilter('changed')}
                          >
                            <Icon icon={STATUS_CONFIG.changed.icon} width={14} height={14} />
                            변경 {diff.changed.length}
                          </button>
                        )}
                      </div>

                      <div className={styles.diffList}>
                        {filteredItems.map((item, idx) => {
                          const info = renderDiffValue(item);
                          return (
                            <div
                              key={`${item.type}-${item.name}-${idx}`}
                              className={`${styles.diffItem} ${styles[`diff_${item.change}`]}`}
                            >
                              <div className={styles.diffHeader}>
                                <Icon icon={STATUS_CONFIG[item.change].icon} width={16} height={16} />
                                <span className={styles.diffName}>{item.name}</span>
                                <span className={styles.diffType}>
                                  {TOKEN_TYPE_LABELS[item.type] ?? item.type}
                                </span>
                                <span className={`${styles.diffBadge} ${styles[`badge_${item.change}`]}`}>
                                  {STATUS_CONFIG[item.change].label}
                                </span>
                              </div>
                              {info && (
                                <div className={styles.diffValues}>
                                  <div className={item.change === 'removed' ? styles.diffOld : styles.diffNew}>
                                    <code className={styles.diffCode}>{info.label}</code>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}

      {/* ── 롤백 확인 다이얼로그 ── */}
      {rollbackTarget && (
        <ConfirmDialog
          isOpen
          title={`v${rollbackTarget.version}으로 롤백`}
          message={`현재 토큰을 v${rollbackTarget.version} 시점의 스냅샷으로 되돌립니다. 현재 토큰 데이터가 교체됩니다.`}
          confirmLabel="롤백 실행"
          variant="danger"
          loading={rolling}
          onConfirm={handleRollback}
          onClose={() => setRollbackTarget(null)}
        />
      )}
    </div>
  );
}
