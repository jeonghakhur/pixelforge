// @page Diff — 커밋 이력 + Drift Detection
'use client';

import { useState, useMemo, useRef } from 'react';
import { Icon } from '@iconify/react';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import {
  detectDriftAction,
  detectDriftFromJsonAction,
  type DriftReport,
  type DriftItem,
} from '@/lib/actions/snapshots';
import { getProjectInfo } from '@/lib/actions/tokens';
import { extractTokensAction } from '@/lib/actions/project';
import { useUIStore } from '@/stores/useUIStore';
import SnapshotHistory from '../SnapshotHistory';
import styles from './page.module.scss';

// ===========================
// Constants
// ===========================

type DriftStatus = 'new_in_figma' | 'removed_from_figma' | 'value_changed';

const DRIFT_CONFIG: Record<DriftStatus, { label: string; icon: string }> = {
  new_in_figma: { label: 'Figma 신규', icon: 'solar:add-circle-linear' },
  removed_from_figma: { label: 'Figma 삭제', icon: 'solar:minus-circle-linear' },
  value_changed: { label: '값 변경', icon: 'solar:pen-new-square-linear' },
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
  // Drift detection
  type DriftMode = 'api' | 'json';
  const [driftMode, setDriftMode] = useState<DriftMode>('api');
  const [driftReport, setDriftReport] = useState<DriftReport | null>(null);
  const [driftLoading, setDriftLoading] = useState(false);
  const [driftError, setDriftError] = useState<string | null>(null);
  const [driftFilter, setDriftFilter] = useState<DriftStatus | 'all'>('all');
  const [driftTypeFilter, setDriftTypeFilter] = useState<string | null>(null);
  const [jsonFormat, setJsonFormat] = useState<string | null>(null);
  const setGlobalDrift = useUIStore((s) => s.setDrift);
  const clearGlobalDrift = useUIStore((s) => s.clearDrift);
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync (re-extract)
  const [syncing, setSyncing] = useState(false);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);

  /** drift 결과를 Zustand에 반영하는 공통 함수 */
  const applyDriftReport = (report: DriftReport | null) => {
    setDriftReport(report);
    if (report) {
      setGlobalDrift(
        {
          newInFigma: report.newInFigma.length,
          removedFromFigma: report.removedFromFigma.length,
          valueChanged: report.valueChanged.length,
          total: report.newInFigma.length + report.removedFromFigma.length + report.valueChanged.length,
        },
        report.checkedAt,
      );
    }
  };

  /** Variables REST API 모드 (Enterprise 요금제) */
  const handleDetectDrift = async () => {
    setDriftLoading(true);
    setDriftError(null);
    setDriftReport(null);
    setDriftTypeFilter(null);
    setJsonFormat(null);
    const result = await detectDriftAction();
    if (result.error) {
      // Variables API 403 시 Plugin JSON 모드 안내
      const is403 = result.error.includes('접근할 수 없습니다') || result.error.includes('403');
      if (is403) {
        setDriftError(
          'Figma Variables REST API는 Enterprise 요금제에서만 사용 가능합니다. ' +
          'Professional 요금제에서는 "Plugin JSON 업로드" 모드를 사용해주세요.',
        );
        setDriftMode('json');
      } else {
        setDriftError(result.error);
      }
    } else {
      applyDriftReport(result.report);
    }
    setDriftLoading(false);
  };

  /** Plugin JSON 업로드 모드 (Professional 요금제) */
  const handleJsonUpload = async (file: File) => {
    setDriftLoading(true);
    setDriftError(null);
    setDriftReport(null);
    setDriftTypeFilter(null);
    setJsonFormat(null);

    try {
      const text = await file.text();
      const result = await detectDriftFromJsonAction(text);
      if (result.error) {
        setDriftError(result.error);
      } else {
        applyDriftReport(result.report);
        setJsonFormat(result.format);
      }
    } catch {
      setDriftError('파일 읽기에 실패했습니다.');
    }
    setDriftLoading(false);
    // 파일 input 초기화
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleJsonUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) handleJsonUpload(file);
  };

  // Sync: Figma에서 재추출하여 drift 해소
  const handleSync = async () => {
    setSyncConfirmOpen(false);
    setSyncing(true);
    const projectInfo = await getProjectInfo();
    if (!projectInfo?.figmaUrl) {
      setSyncing(false);
      return;
    }
    const result = await extractTokensAction(projectInfo.figmaUrl);
    setSyncing(false);
    if (!result.error) {
      invalidateTokens();
      clearGlobalDrift();
      setDriftReport(null);
      setDriftError(null);
      await handleDetectDrift();
    }
  };

  // Drift report JSON 내보내기
  const handleExportDrift = () => {
    if (!driftReport) return;
    const data = {
      checkedAt: driftReport.checkedAt,
      summary: {
        newInFigma: driftReport.newInFigma.length,
        removedFromFigma: driftReport.removedFromFigma.length,
        valueChanged: driftReport.valueChanged.length,
      },
      countsByType: driftReport.countsByType,
      items: [...driftReport.newInFigma, ...driftReport.removedFromFigma, ...driftReport.valueChanged],
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drift-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Version Control</span>
        <h1 className={styles.title}>변경 이력</h1>
        <p className={styles.description}>
          토큰 추출 이력을 git으로 추적하고, Figma와의 차이를 감지합니다.
        </p>
      </div>


      <SnapshotHistory />

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
              {jsonFormat && (
                <span className={styles.formatTag}>
                  {jsonFormat === 'pixelforge' ? 'PixelForge Plugin' : 'Tokens Studio'}
                </span>
              )}
            </h2>

            {/* ── 모드 선택 ── */}
            <div className={styles.modeToggle}>
              <button
                type="button"
                className={`${styles.modeBtn} ${driftMode === 'api' ? styles.modeBtnActive : ''}`}
                onClick={() => setDriftMode('api')}
              >
                <Icon icon="solar:server-linear" width={14} height={14} />
                Variables API
                <span className={styles.modeTag}>Enterprise</span>
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${driftMode === 'json' ? styles.modeBtnActive : ''}`}
                onClick={() => setDriftMode('json')}
              >
                <Icon icon="solar:upload-linear" width={14} height={14} />
                Plugin JSON
                <span className={styles.modeTag}>Professional+</span>
              </button>
            </div>

            {driftMode === 'api' && (
              <p className={styles.driftDesc}>
                Figma Variables REST API로 실시간 비교합니다. Enterprise 요금제에서만 사용 가능합니다.
              </p>
            )}
            {driftMode === 'json' && (
              <p className={styles.driftDesc}>
                Figma 플러그인에서 내보낸 JSON을 업로드하여 비교합니다. 모든 요금제에서 사용 가능합니다.
              </p>
            )}

            <div className={styles.driftActions}>
              {driftMode === 'api' && (
                <Button
                  variant="secondary"
                  leftIcon="solar:radar-2-linear"
                  loading={driftLoading}
                  onClick={handleDetectDrift}
                >
                  Drift 감지 실행
                </Button>
              )}
              {driftMode === 'json' && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className={styles.hiddenInput}
                    aria-label="Plugin JSON 파일 선택"
                  />
                  <Button
                    variant="secondary"
                    leftIcon="solar:upload-linear"
                    loading={driftLoading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    JSON 파일 업로드
                  </Button>
                </>
              )}
              {driftReport && !driftReport.clean && (
                <Button
                  variant="primary"
                  leftIcon="solar:refresh-circle-linear"
                  loading={syncing}
                  onClick={() => setSyncConfirmOpen(true)}
                >
                  Figma와 동기화
                </Button>
              )}
              {driftReport && !driftReport.clean && (
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={handleExportDrift}
                  aria-label="Drift 리포트 내보내기"
                >
                  <Icon icon="solar:download-minimalistic-linear" width={14} height={14} />
                  JSON 내보내기
                </button>
              )}
              {driftReport && (
                <span className={styles.driftTimestamp}>
                  마지막 검사: {formatDate(driftReport.checkedAt)}
                </span>
              )}
            </div>

            {/* ── Plugin JSON 드래그 앤 드롭 영역 ── */}
            {driftMode === 'json' && !driftReport && !driftLoading && (
              <div
                className={styles.dropZone}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <Icon icon="solar:cloud-upload-linear" width={28} height={28} />
                <span className={styles.dropText}>
                  JSON 파일을 드래그하거나 위 버튼을 클릭하세요
                </span>
                <span className={styles.dropHint}>
                  PixelForge Plugin, Tokens Studio 형식 지원
                </span>
              </div>
            )}

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

      </>

      {/* ── 동기화 확인 다이얼로그 ── */}
      <ConfirmDialog
        isOpen={syncConfirmOpen}
        title="Figma와 동기화"
        message="Figma에서 토큰을 다시 추출하여 DB를 최신 상태로 업데이트합니다. 기존 토큰이 교체됩니다."
        confirmLabel="동기화 실행"
        variant="warning"
        loading={syncing}
        onConfirm={handleSync}
        onClose={() => setSyncConfirmOpen(false)}
      />
    </div>
  );
}
