// @page Diff — 스냅샷 버전 관리 + Drift Detection
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  detectDriftAction,
  type SnapshotListItem,
  type DriftReport,
  type DriftItem,
} from '@/lib/actions/snapshots';
import type { SnapshotDiffSummary, TokenDiffItem } from '@/lib/tokens/snapshot-engine';
import { useUIStore } from '@/stores/useUIStore';
import styles from './page.module.scss';

// ===========================
// Constants
// ===========================

type DiffStatus = 'changed' | 'added' | 'removed';
type DriftStatus = 'new_in_figma' | 'removed_from_figma' | 'value_changed';

const STATUS_CONFIG: Record<DiffStatus, { label: string; icon: string }> = {
  changed: { label: '변경됨', icon: 'solar:pen-new-square-linear' },
  added: { label: '신규', icon: 'solar:add-circle-linear' },
  removed: { label: '삭제됨', icon: 'solar:minus-circle-linear' },
};

const DRIFT_CONFIG: Record<DriftStatus, { label: string; icon: string }> = {
  new_in_figma: { label: 'Figma 신규', icon: 'solar:add-circle-linear' },
  removed_from_figma: { label: 'Figma 삭제', icon: 'solar:minus-circle-linear' },
  value_changed: { label: '값 변경', icon: 'solar:pen-new-square-linear' },
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

const TOKEN_TYPE_ICONS: Record<string, string> = {
  color: 'solar:pallete-linear',
  typography: 'solar:text-field-linear',
  spacing: 'solar:ruler-linear',
  radius: 'solar:crop-linear',
  shadow: 'solar:layers-linear',
  opacity: 'solar:eye-linear',
  border: 'solar:square-linear',
};

// ===========================
// Helpers
// ===========================

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

/** JSON value에서 hex 색상 추출 시도 */
function tryExtractHex(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed.hex && typeof parsed.hex === 'string') return parsed.hex;
  } catch {
    // raw 값이 hex인 경우
    if (value.startsWith('#') && (value.length === 7 || value.length === 4)) return value;
  }
  return null;
}

// ===========================
// Sub-components
// ===========================

function ColorSwatch({ hex }: { hex: string }) {
  return (
    <span
      className={styles.colorSwatch}
      style={{ backgroundColor: hex }}
      aria-label={`색상: ${hex}`}
    />
  );
}

function TypeFilterBar({
  types,
  active,
  onSelect,
}: {
  types: string[];
  active: string | null;
  onSelect: (type: string | null) => void;
}) {
  if (types.length <= 1) return null;
  return (
    <div className={styles.typeFilterBar}>
      <button
        type="button"
        className={`${styles.typeChip} ${active === null ? styles.typeChipActive : ''}`}
        onClick={() => onSelect(null)}
      >
        전체
      </button>
      {types.map((type) => (
        <button
          key={type}
          type="button"
          className={`${styles.typeChip} ${active === type ? styles.typeChipActive : ''}`}
          onClick={() => onSelect(type)}
        >
          <Icon icon={TOKEN_TYPE_ICONS[type] ?? 'solar:document-linear'} width={14} height={14} />
          {TOKEN_TYPE_LABELS[type] ?? type}
        </button>
      ))}
    </div>
  );
}

// ===========================
// Main Page
// ===========================

export default function DiffPage() {
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Compare state
  const [baseId, setBaseId] = useState('');
  const [compareId, setCompareId] = useState('');
  const [diff, setDiff] = useState<SnapshotDiffSummary | null>(null);
  const [comparing, setComparing] = useState(false);
  const [filter, setFilter] = useState<DiffStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Rollback confirm
  const [rollbackTarget, setRollbackTarget] = useState<SnapshotListItem | null>(null);
  const [rolling, setRolling] = useState(false);

  // Drift detection
  const [driftReport, setDriftReport] = useState<DriftReport | null>(null);
  const [driftLoading, setDriftLoading] = useState(false);
  const [driftError, setDriftError] = useState<string | null>(null);
  const [driftFilter, setDriftFilter] = useState<DriftStatus | 'all'>('all');
  const [driftTypeFilter, setDriftTypeFilter] = useState<string | null>(null);
  const setGlobalDrift = useUIStore((s) => s.setDrift);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    const result = await getSnapshotsAction();
    if (!result.error) {
      setSnapshots(result.snapshots);
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
    setTypeFilter(null);
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

  const handleDetectDrift = async () => {
    setDriftLoading(true);
    setDriftError(null);
    setDriftReport(null);
    setDriftTypeFilter(null);
    const result = await detectDriftAction();
    if (result.error) {
      setDriftError(result.error);
    } else {
      setDriftReport(result.report);
      // Zustand에 drift 상태 반영 → ActivityBar, StatusBar, Sidebar, Home 페이지에 전파
      if (result.report) {
        setGlobalDrift(
          {
            newInFigma: result.report.newInFigma.length,
            removedFromFigma: result.report.removedFromFigma.length,
            valueChanged: result.report.valueChanged.length,
            total: result.report.newInFigma.length + result.report.removedFromFigma.length + result.report.valueChanged.length,
          },
          result.report.checkedAt,
        );
      }
    }
    setDriftLoading(false);
  };

  // ── Diff 결과 계산 ──
  const totalChanges = diff
    ? diff.added.length + diff.removed.length + diff.changed.length
    : 0;

  const allDiffItems: TokenDiffItem[] = diff
    ? [...diff.added, ...diff.removed, ...diff.changed]
    : [];

  const filteredDiffItems = useMemo(() => {
    let items = filter === 'all'
      ? allDiffItems
      : allDiffItems.filter((item) => item.change === filter);
    if (typeFilter) {
      items = items.filter((item) => item.type === typeFilter);
    }
    return items;
  }, [allDiffItems, filter, typeFilter]);

  const diffTypes = useMemo(() => {
    const set = new Set(allDiffItems.map((i) => i.type));
    return Array.from(set).sort();
  }, [allDiffItems]);

  // ── Drift 결과 계산 ──
  const allDriftItems: DriftItem[] = useMemo(() => {
    if (!driftReport) return [];
    return [...driftReport.newInFigma, ...driftReport.removedFromFigma, ...driftReport.valueChanged];
  }, [driftReport]);

  const filteredDriftItems = useMemo(() => {
    let items = driftFilter === 'all'
      ? allDriftItems
      : allDriftItems.filter((item) => item.drift === driftFilter);
    if (driftTypeFilter) {
      items = items.filter((item) => item.type === driftTypeFilter);
    }
    return items;
  }, [allDriftItems, driftFilter, driftTypeFilter]);

  const driftTypes = useMemo(() => {
    const set = new Set(allDriftItems.map((i) => i.type));
    return Array.from(set).sort();
  }, [allDriftItems]);

  const totalDrift = driftReport
    ? driftReport.newInFigma.length + driftReport.removedFromFigma.length + driftReport.valueChanged.length
    : 0;

  const isEmpty = snapshots.length === 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Version Control</span>
        <h1 className={styles.title}>스냅샷 버전 관리</h1>
        <p className={styles.description}>
          토큰 추출 시 자동 생성되는 스냅샷으로 변경 이력을 추적하고, Figma와의 차이를 감지합니다.
        </p>
      </div>

      {loading ? (
        <div className={styles.stage}>
          <div className={styles.stageInner}>
            <Icon icon="solar:refresh-linear" width={24} height={24} className="spin" />
          </div>
        </div>
      ) : (
        <>
          {/* ── Drift Detection ── */}
          <section className={styles.driftSection}>
            <h2 className={styles.sectionTitle}>
              <Icon icon="solar:radar-2-linear" width={18} height={18} />
              Drift Detection
              {driftReport && !driftReport.clean && (
                <Badge variant="danger">{totalDrift}건 감지</Badge>
              )}
              {driftReport?.clean && (
                <Badge variant="success">동기화 완료</Badge>
              )}
            </h2>
            <p className={styles.driftDesc}>
              현재 Figma Variables와 DB 토큰을 실시간으로 비교하여 동기화 상태를 확인합니다.
            </p>
            <div className={styles.driftActions}>
              <Button
                variant="secondary"
                leftIcon="solar:radar-2-linear"
                loading={driftLoading}
                onClick={handleDetectDrift}
              >
                Drift 감지 실행
              </Button>
              {driftReport && (
                <span className={styles.driftTimestamp}>
                  마지막 검사: {formatDate(driftReport.checkedAt)}
                </span>
              )}
            </div>

            {driftError && (
              <div className={styles.driftError}>
                <Icon icon="solar:danger-triangle-linear" width={16} height={16} />
                {driftError}
              </div>
            )}

            {driftReport && driftReport.clean && (
              <div className={styles.noDiff}>
                <Icon icon="solar:check-circle-linear" width={20} height={20} />
                Figma Variables와 DB 토큰이 완전히 동기화되어 있습니다.
              </div>
            )}

            {driftReport && !driftReport.clean && (
              <>
                <div className={styles.statusBar}>
                  <button
                    type="button"
                    className={`${styles.statusChip} ${driftFilter === 'all' ? styles.statusActive : ''}`}
                    onClick={() => setDriftFilter('all')}
                  >
                    전체 {totalDrift}
                  </button>
                  {driftReport.newInFigma.length > 0 && (
                    <button
                      type="button"
                      className={`${styles.statusChip} ${styles.status_added} ${driftFilter === 'new_in_figma' ? styles.statusActive : ''}`}
                      onClick={() => setDriftFilter('new_in_figma')}
                    >
                      <Icon icon={DRIFT_CONFIG.new_in_figma.icon} width={14} height={14} />
                      Figma 신규 {driftReport.newInFigma.length}
                    </button>
                  )}
                  {driftReport.removedFromFigma.length > 0 && (
                    <button
                      type="button"
                      className={`${styles.statusChip} ${styles.status_removed} ${driftFilter === 'removed_from_figma' ? styles.statusActive : ''}`}
                      onClick={() => setDriftFilter('removed_from_figma')}
                    >
                      <Icon icon={DRIFT_CONFIG.removed_from_figma.icon} width={14} height={14} />
                      Figma 삭제 {driftReport.removedFromFigma.length}
                    </button>
                  )}
                  {driftReport.valueChanged.length > 0 && (
                    <button
                      type="button"
                      className={`${styles.statusChip} ${styles.status_changed} ${driftFilter === 'value_changed' ? styles.statusActive : ''}`}
                      onClick={() => setDriftFilter('value_changed')}
                    >
                      <Icon icon={DRIFT_CONFIG.value_changed.icon} width={14} height={14} />
                      값 변경 {driftReport.valueChanged.length}
                    </button>
                  )}
                </div>

                <TypeFilterBar types={driftTypes} active={driftTypeFilter} onSelect={setDriftTypeFilter} />

                <div className={styles.diffList}>
                  {filteredDriftItems.map((item, idx) => {
                    const figmaHex = tryExtractHex(item.figmaValue) ?? tryExtractHex(item.figmaRaw);
                    const dbHex = tryExtractHex(item.dbValue) ?? tryExtractHex(item.dbRaw);
                    const isColor = item.type === 'color';
                    const driftCfg = DRIFT_CONFIG[item.drift];

                    const driftToBadgeClass = {
                      new_in_figma: 'badge_added',
                      removed_from_figma: 'badge_removed',
                      value_changed: 'badge_changed',
                    } as const;

                    const driftToDiffClass = {
                      new_in_figma: 'diff_added',
                      removed_from_figma: 'diff_removed',
                      value_changed: 'diff_changed',
                    } as const;

                    return (
                      <div
                        key={`drift-${item.type}-${item.name}-${idx}`}
                        className={`${styles.diffItem} ${styles[driftToDiffClass[item.drift]]}`}
                      >
                        <div className={styles.diffHeader}>
                          <Icon icon={driftCfg.icon} width={16} height={16} />
                          {isColor && figmaHex && <ColorSwatch hex={figmaHex} />}
                          {isColor && dbHex && item.drift === 'value_changed' && <ColorSwatch hex={dbHex} />}
                          <span className={styles.diffName}>{item.name}</span>
                          <span className={styles.diffType}>
                            {TOKEN_TYPE_LABELS[item.type] ?? item.type}
                          </span>
                          <span className={`${styles.diffBadge} ${styles[driftToBadgeClass[item.drift]]}`}>
                            {driftCfg.label}
                          </span>
                        </div>
                        {item.drift === 'value_changed' && (
                          <div className={styles.diffValues}>
                            <div className={styles.diffOldNew}>
                              <span className={styles.diffLabel}>DB</span>
                              <code className={styles.diffCode}>
                                {isColor && dbHex && <ColorSwatch hex={dbHex} />}
                                {item.dbRaw ?? '?'}
                              </code>
                            </div>
                            <div className={styles.diffArrow}>
                              <Icon icon="solar:arrow-right-linear" width={14} height={14} />
                            </div>
                            <div className={styles.diffOldNew}>
                              <span className={styles.diffLabel}>Figma</span>
                              <code className={styles.diffCode}>
                                {isColor && figmaHex && <ColorSwatch hex={figmaHex} />}
                                {item.figmaRaw ?? '?'}
                              </code>
                            </div>
                          </div>
                        )}
                        {item.drift === 'new_in_figma' && item.figmaRaw && (
                          <div className={styles.diffValues}>
                            <div className={styles.diffNew}>
                              <code className={styles.diffCode}>
                                {isColor && figmaHex && <ColorSwatch hex={figmaHex} />}
                                {item.figmaRaw}
                              </code>
                            </div>
                          </div>
                        )}
                        {item.drift === 'removed_from_figma' && item.dbRaw && (
                          <div className={styles.diffValues}>
                            <div className={styles.diffOld}>
                              <code className={styles.diffCode}>
                                {isColor && dbHex && <ColorSwatch hex={dbHex} />}
                                {item.dbRaw}
                              </code>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          {/* ── 스냅샷 타임라인 ── */}
          {isEmpty ? (
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

                          <TypeFilterBar types={diffTypes} active={typeFilter} onSelect={setTypeFilter} />

                          <div className={styles.diffList}>
                            {filteredDiffItems.map((item, idx) => {
                              const isColor = item.type === 'color';
                              const oldHex = isColor ? (tryExtractHex(item.oldValue) ?? tryExtractHex(item.oldRaw)) : null;
                              const newHex = isColor ? (tryExtractHex(item.newValue) ?? tryExtractHex(item.newRaw)) : null;

                              return (
                                <div
                                  key={`${item.type}-${item.name}-${idx}`}
                                  className={`${styles.diffItem} ${styles[`diff_${item.change}`]}`}
                                >
                                  <div className={styles.diffHeader}>
                                    <Icon icon={STATUS_CONFIG[item.change].icon} width={16} height={16} />
                                    {isColor && oldHex && <ColorSwatch hex={oldHex} />}
                                    {isColor && newHex && item.change === 'changed' && <ColorSwatch hex={newHex} />}
                                    <span className={styles.diffName}>{item.name}</span>
                                    <span className={styles.diffType}>
                                      {TOKEN_TYPE_LABELS[item.type] ?? item.type}
                                    </span>
                                    <span className={`${styles.diffBadge} ${styles[`badge_${item.change}`]}`}>
                                      {STATUS_CONFIG[item.change].label}
                                    </span>
                                  </div>
                                  {item.change === 'changed' && (
                                    <div className={styles.diffValues}>
                                      <div className={styles.diffOldNew}>
                                        <span className={styles.diffLabel}>이전</span>
                                        <code className={styles.diffCode}>
                                          {isColor && oldHex && <ColorSwatch hex={oldHex} />}
                                          {item.oldRaw ?? '?'}
                                        </code>
                                      </div>
                                      <div className={styles.diffArrow}>
                                        <Icon icon="solar:arrow-right-linear" width={14} height={14} />
                                      </div>
                                      <div className={styles.diffOldNew}>
                                        <span className={styles.diffLabel}>이후</span>
                                        <code className={styles.diffCode}>
                                          {isColor && newHex && <ColorSwatch hex={newHex} />}
                                          {item.newRaw ?? '?'}
                                        </code>
                                      </div>
                                    </div>
                                  )}
                                  {item.change === 'added' && item.newRaw && (
                                    <div className={styles.diffValues}>
                                      <div className={styles.diffNew}>
                                        <code className={styles.diffCode}>
                                          {isColor && newHex && <ColorSwatch hex={newHex} />}
                                          {item.newRaw}
                                        </code>
                                      </div>
                                    </div>
                                  )}
                                  {item.change === 'removed' && item.oldRaw && (
                                    <div className={styles.diffValues}>
                                      <div className={styles.diffOld}>
                                        <code className={styles.diffCode}>
                                          {isColor && oldHex && <ColorSwatch hex={oldHex} />}
                                          {item.oldRaw}
                                        </code>
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
