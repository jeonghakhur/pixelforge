'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import {
  getActiveSnapshotListAction,
  getSnapshotDetailAction,
  type SnapshotInfo,
  type SnapshotDetail,
} from '@/lib/actions/tokens';
import styles from './snapshot-history.module.scss';

// ── 헬퍼 ─────────────────────────────────────────────────

function formatDate(date: Date | string): string {
  try {
    const d = new Date(date);
    const month = d.getMonth() + 1;
    const day   = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins  = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${mins}`;
  } catch {
    return String(date);
  }
}

function buildCountSummary(tokenCounts: Record<string, number>): string {
  const LABELS: Record<string, string> = {
    color: '색상', typography: '타이포', spacing: '간격',
    radius: '반경', size: '크기', resolution: '해상도',
    float: '숫자', string: '문자열', elevation: '이펙트',
    shadow: '그림자', boolean: '불린',
  };
  return Object.entries(tokenCounts)
    .filter(([k, v]) => k !== 'total' && v > 0)
    .map(([k, v]) => `${LABELS[k] ?? k} ${v}`)
    .join(' · ');
}

// ── 서브 컴포넌트 ─────────────────────────────────────────

function DiffChips({ counts }: { counts: SnapshotInfo['diffCounts'] }) {
  return (
    <div className={styles.diffChips}>
      {counts.added   > 0 && <span className={`${styles.chip} ${styles.chipAdded}`}>+{counts.added}</span>}
      {counts.removed > 0 && <span className={`${styles.chip} ${styles.chipRemoved}`}>-{counts.removed}</span>}
      {counts.changed > 0 && <span className={`${styles.chip} ${styles.chipChanged}`}>~{counts.changed}</span>}
    </div>
  );
}

function TokenChangeRow({
  name, type, prefix, prefixClass, oldRaw, newRaw,
}: {
  name: string;
  type: string;
  prefix: string;
  prefixClass: string;
  oldRaw?: string | null;
  newRaw?: string | null;
}) {
  return (
    <div className={styles.tokenRow}>
      <span className={`${styles.tokenPrefix} ${prefixClass}`}>{prefix}</span>
      <span className={styles.tokenName}>{name}</span>
      <span className={styles.typeBadge}>{type}</span>
      {(oldRaw || newRaw) && (
        <>
          <span className={styles.rawChange}>{oldRaw ?? '?'}</span>
          <span className={styles.rawArrow}>→</span>
          <span className={styles.rawChange}>{newRaw ?? '?'}</span>
        </>
      )}
    </div>
  );
}

function DetailPanel({ snapshotId }: { snapshotId: string }) {
  const [detail, setDetail] = useState<SnapshotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    setError(null);
    getSnapshotDetailAction(snapshotId).then((res) => {
      if (cancelled) return;
      if (res.error) { setError(res.error); }
      else { setDetail(res.detail); }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [snapshotId]);

  if (loading) {
    return (
      <div className={styles.detailPanel}>
        <div className={styles.detailLoading}>
          <Icon icon="solar:refresh-circle-linear" width={14} height={14} />
          불러오는 중...
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className={styles.detailPanel}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{error ?? '상세 정보를 불러올 수 없습니다.'}</span>
      </div>
    );
  }

  const isEmpty =
    detail.diff.added.length === 0 &&
    detail.diff.removed.length === 0 &&
    detail.diff.changed.length === 0;

  return (
    <div className={styles.detailPanel}>
      {isEmpty && (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>변경된 토큰이 없습니다. (첫 번째 추출이거나 동일한 데이터입니다)</span>
      )}

      {detail.diff.added.length > 0 && (
        <div className={styles.detailSection}>
          <div className={styles.detailSectionTitle}>추가 ({detail.diff.added.length})</div>
          {detail.diff.added.map((t, i) => (
            <TokenChangeRow
              key={`added-${i}`}
              name={t.name}
              type={t.type}
              prefix="+"
              prefixClass={styles.prefixAdded}
            />
          ))}
        </div>
      )}

      {detail.diff.removed.length > 0 && (
        <div className={styles.detailSection}>
          <div className={styles.detailSectionTitle}>삭제 ({detail.diff.removed.length})</div>
          {detail.diff.removed.map((t, i) => (
            <TokenChangeRow
              key={`removed-${i}`}
              name={t.name}
              type={t.type}
              prefix="-"
              prefixClass={styles.prefixRemoved}
            />
          ))}
        </div>
      )}

      {detail.diff.changed.length > 0 && (
        <div className={styles.detailSection}>
          <div className={styles.detailSectionTitle}>변경 ({detail.diff.changed.length})</div>
          {detail.diff.changed.map((t, i) => (
            <TokenChangeRow
              key={`changed-${i}`}
              name={t.name}
              type={t.type}
              prefix="~"
              prefixClass={styles.prefixChanged}
              oldRaw={t.oldRaw}
              newRaw={t.newRaw}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────

export default function SnapshotHistory() {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getActiveSnapshotListAction().then((list) => {
      setSnapshots(list);
      setLoading(false);
    });
  }, []);

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <Icon icon="solar:history-linear" width={18} height={18} />
        토큰 변경 이력
      </h2>

      {loading && (
        <div className={styles.empty}>
          <Icon icon="solar:refresh-circle-linear" width={24} height={24} className={styles.emptyIcon} />
          불러오는 중...
        </div>
      )}

      {!loading && snapshots.length === 0 && (
        <div className={styles.empty}>
          <Icon icon="solar:history-linear" width={28} height={28} className={styles.emptyIcon} />
          아직 sync 이력이 없습니다.
          <span style={{ fontSize: '12px' }}>Figma 플러그인으로 토큰을 sync하면 이력이 표시됩니다.</span>
        </div>
      )}

      {!loading && snapshots.length > 0 && (
        <div className={styles.list}>
          {snapshots.map((snap) => {
            const isExpanded = expandedId === snap.id;
            const summary = buildCountSummary(snap.tokenCounts);
            return (
              <div key={snap.id}>
                <div className={`${styles.row} ${isExpanded ? styles.expanded : ''}`}>
                  <span className={styles.versionBadge}>v{snap.version}</span>
                  <span className={styles.date}>{formatDate(snap.createdAt)}</span>
                  <span className={styles.sourceBadge}>{snap.source}</span>
                  <span className={styles.countSummary}>{summary}</span>
                  <DiffChips counts={snap.diffCounts} />
                  <button
                    type="button"
                    className={styles.toggleBtn}
                    onClick={() => handleToggle(snap.id)}
                    aria-label={isExpanded ? '접기' : '상세 보기'}
                    aria-expanded={isExpanded}
                  >
                    <Icon
                      icon={isExpanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                      width={16}
                      height={16}
                    />
                  </button>
                </div>
                {isExpanded && <DetailPanel snapshotId={snap.id} />}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
