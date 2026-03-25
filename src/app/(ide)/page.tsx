// @page Home — Figma URL 입력 + 토큰 추출 + 대시보드
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { analyzeFileAction } from '@/lib/actions/project';
import TokenExtractModal from './tokens/[type]/TokenExtractModal';
import { previewTokensAction, type TokenPreviewResult } from '@/lib/actions/preview';
import type { FigmaPageInfo } from '@/lib/figma/api';
import { getTokenSummary, deleteAllTokensAction, type TokenSummary } from '@/lib/actions/tokens';

import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/stores/useUIStore';
import { useStageProgress } from '@/hooks/useStageProgress';
import ProgressCard from '@/components/common/ProgressCard';
import { TOKEN_TYPES } from '@/lib/tokens/token-types';
import styles from './page.module.scss';

// ===========================
// URL 히스토리 (localStorage)
// ===========================
const HISTORY_KEY = 'pixelforge_url_history';
const HISTORY_MAX = 5;

interface UrlHistoryItem {
  url: string;
  analyzedAt: string; // ISO string
}

function loadUrlHistory(): UrlHistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function pushUrlHistory(url: string): UrlHistoryItem[] {
  const existing = loadUrlHistory().filter((h) => h.url !== url);
  const updated = [{ url, analyzedAt: new Date().toISOString() }, ...existing].slice(0, HISTORY_MAX);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

function deleteUrlHistory(url: string): UrlHistoryItem[] {
  const updated = loadUrlHistory().filter((h) => h.url !== url);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const hhmm = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (dDay.getTime() === today.getTime()) return `오늘 ${hhmm}`;
  if (dDay.getTime() === yesterday.getTime()) return `어제 ${hhmm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hhmm}`;
}

const figmaUrlSchema = z.object({
  url: z
    .string()
    .min(1, 'Figma URL을 입력해주세요')
    .url('올바른 URL 형식이 아닙니다')
    .refine((val) => val.includes('figma.com'), 'Figma URL을 입력해주세요'),
});
type FigmaUrlForm = z.infer<typeof figmaUrlSchema>;


const ANALYZE_STAGES = [
  { label: 'Figma 서버에 연결 중...', percent: 20, durationMs: 700 },
  { label: '파일 정보 가져오는 중...', percent: 55, durationMs: 1200 },
  { label: '페이지 구조 파싱 중...', percent: 85, durationMs: 500 },
  { label: '분석 완료!', percent: 100, durationMs: 0 },
];

const EXTRACT_STAGES = [
  { label: 'Figma API에서 데이터 로드 중...', percent: 20, durationMs: 1000 },
  { label: '색상 토큰 추출 중...', percent: 42, durationMs: 900 },
  { label: '타이포그래피 분석 중...', percent: 60, durationMs: 700 },
  { label: '간격 & 반경 처리 중...', percent: 76, durationMs: 600 },
  { label: '데이터베이스에 저장 중...', percent: 92, durationMs: 400 },
  { label: '저장 완료!', percent: 100, durationMs: 0 },
];

type SectionKey = 'tokens' | 'components' | 'settings';

const TOKEN_NAV_ITEMS = TOKEN_TYPES.map((t) => ({
  icon: t.icon,
  label: t.label,
  path: `/tokens/${t.id}`,
  section: 'tokens' as SectionKey,
  typeId: t.id,
}));

const NAV_ITEMS = [
  ...TOKEN_NAV_ITEMS,
  { icon: 'solar:widget-2-linear', label: 'Components', path: '/components/new', section: 'components' as SectionKey, typeId: null },
  { icon: 'solar:settings-linear', label: 'Settings',   path: '/settings',       section: 'settings'   as SectionKey, typeId: null },
];

export default function HomePage() {
  const router = useRouter();
  const setSection = useUIStore((s) => s.setSection);
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const preloadUrl = useUIStore((s) => s.preloadUrl);
  const setPreloadUrl = useUIStore((s) => s.setPreloadUrl);

  const [step, setStep] = useState<'url' | 'select'>('url');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ fileName: string; nodeId: string | null; pages: FigmaPageInfo[]; typeNodeIds: Record<string, string> } | null>(null);
  const [extractModalType, setExtractModalType] = useState<string | null>(null);
  const [extractDone, setExtractDone] = useState<{ typeId: string; count: number } | null>(null);
  const [summary, setSummary] = useState<TokenSummary | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [preview, setPreview] = useState<TokenPreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [urlHistory, setUrlHistory] = useState<UrlHistoryItem[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const refreshRef = useRef(false);

  const analyzeProgress = useStageProgress(ANALYZE_STAGES);

  useEffect(() => {
    getTokenSummary().then(setSummary);
    setUrlHistory(loadUrlHistory());
  }, []);

  const { register, handleSubmit, getValues, setValue, formState: { errors }, setFocus } = useForm<FigmaUrlForm>({
    resolver: zodResolver(figmaUrlSchema),
  });

  const onAnalyze = async (data: FigmaUrlForm) => {
    const forceRefresh = refreshRef.current;
    refreshRef.current = false;
    setAnalyzeError(null);
    setFromCache(false);
    setAnalyzing(true);
    analyzeProgress.start();

    const res = await analyzeFileAction(data.url, forceRefresh);
    analyzeProgress.complete();
    setAnalyzing(false);

    if (res.error) { setAnalyzeError(res.error); return; }
    setFileInfo({ fileName: res.fileName, nodeId: res.detectedNodeId, pages: res.pages, typeNodeIds: res.typeNodeIds });
    setFromCache(res.fromCache);
    setUrlHistory(pushUrlHistory(data.url));

    // 캐시 파일로 토큰 미리보기 추출 (백그라운드)
    setPreviewing(true);
    previewTokensAction(data.url).then((p) => {
      setPreview(p);
      setPreviewing(false);
    });

    setTimeout(() => setStep('select'), res.fromCache ? 0 : 400);
  };

  const getTypeInitialUrl = useCallback((typeId: string): string => {
    const base = getValues('url');
    const nodeId = fileInfo?.typeNodeIds[typeId];
    if (!nodeId) return base;
    const urlNodeId = nodeId.replace(/:/g, '-');
    try {
      const url = new URL(base);
      url.searchParams.set('node-id', urlNodeId);
      return url.toString();
    } catch {
      return base;
    }
  }, [fileInfo, getValues]);

  const onExtractType = (typeId: string) => {
    setExtractDone(null);
    setExtractModalType(typeId);
  };

  const handleExtractSuccess = (typeId: string, count: number) => {
    setExtractDone({ typeId, count });
    invalidateTokens();
    getTokenSummary().then(setSummary);
  };

  const handleBack = () => {
    setStep('url');
    setFileInfo(null);
    setFromCache(false);
    setAnalyzeError(null);
    setExtractDone(null);
    setExtractModalType(null);
    setPreview(null);
    analyzeProgress.reset();
  };

  const handleRefresh = () => {
    refreshRef.current = true;
    handleSubmit(onAnalyze)();
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!preloadUrl || step !== 'url' || analyzing) return;
    setValue('url', preloadUrl);
    setPreloadUrl(null);
    refreshRef.current = false;
    setTimeout(() => handleSubmit(onAnalyze)(), 50);
  }, [preloadUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleHistoryClick = useCallback((url: string) => {
    setValue('url', url);
    setFocus('url');
  }, [setValue, setFocus]);

  const handleHistoryCopy = useCallback((url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 1800);
    });
  }, []);

  const handleHistoryDelete = useCallback((url: string) => {
    setUrlHistory(deleteUrlHistory(url));
  }, []);

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    await deleteAllTokensAction();
    setDeletingAll(false);
    setDeleteAllOpen(false);
    setSummary(null);
    setExtractDone(null);
    invalidateTokens();
    router.refresh();
  };

  const handleNav = (path: string, section: SectionKey) => {
    setSection(section);
    router.push(path);
  };

  const getCount = (item: typeof NAV_ITEMS[number]): number | null => {
    if (!item.typeId || !summary) return null;
    return summary.counts[item.typeId] ?? 0;
  };

  const hasAnyTokens = summary && Object.values(summary.counts).reduce((a, b) => a + b, 0) > 0;

  const getTypePreviewCount = (typeId: string): number | null => {
    if (!preview) return null;
    const map: Record<string, number> = {
      color:      preview.colors.length,
      typography: preview.typography.length,
      spacing:    preview.spacing.length,
      radius:     preview.radius.length,
    };
    return map[typeId] ?? null;
  };

  return (
    <div className={styles.home}>

      {/* ── Step 1: URL 입력 ─────────────────── */}
      {step === 'url' && (
        <div className={styles.inputSection}>
        <div className={styles.inputSectionInner}>
          <span className={styles.sectionLabel}>Figma URL</span>
          <form onSubmit={handleSubmit(onAnalyze, () => setFocus('url'))} className={styles.form} noValidate>
            <div className={styles.inputRow}>
              <div className={styles.inputWrapper}>
                <Icon icon="solar:link-linear" className={styles.inputIcon} />
                <label htmlFor="figma-url" className="sr-only">Figma URL</label>
                <input
                  id="figma-url"
                  type="url"
                  placeholder="https://www.figma.com/file/..."
                  className={styles.input}
                  aria-invalid={!!errors.url}
                  aria-describedby={errors.url ? 'figma-url-error' : undefined}
                  disabled={analyzing}
                  {...register('url')}
                />
              </div>
              <button type="submit" className={styles.extractBtn} disabled={analyzing}>
                <Icon icon="solar:magnifer-linear" width={15} height={15} />
                분석
              </button>
            </div>
            {errors.url && (
              <p id="figma-url-error" className={styles.error} role="alert">{errors.url.message}</p>
            )}
            {analyzeError && (
              <p className={styles.error} role="alert">{analyzeError}</p>
            )}
          </form>
          {analyzeProgress.isRunning && (
            <div className={styles.progressWrap}>
              <ProgressCard percent={analyzeProgress.percent} label={analyzeProgress.label} />
            </div>
          )}

          {/* 최근 검색 히스토리 */}
          {!analyzeProgress.isRunning && urlHistory.length > 0 && (
            <div className={styles.historyBlock}>
              <span className={styles.historyLabel}>최근 검색</span>
              <ul className={styles.historyList} aria-label="최근 검색 목록">
                {urlHistory.map((item) => (
                  <li key={item.url} className={styles.historyItem}>
                    <button
                      type="button"
                      className={styles.historyUrlBtn}
                      onClick={() => handleHistoryClick(item.url)}
                      title={item.url}
                    >
                      <Icon icon="solar:history-linear" width={12} height={12} className={styles.historyIcon} />
                      <span className={styles.historyUrl}>{item.url}</span>
                      <span className={styles.historyDate}>{formatHistoryDate(item.analyzedAt)}</span>
                    </button>
                    <div className={styles.historyActions}>
                      <button
                        type="button"
                        className={styles.historyActionBtn}
                        onClick={() => handleHistoryCopy(item.url)}
                        aria-label="URL 복사"
                        title="클립보드에 복사"
                      >
                        <Icon
                          icon={copiedUrl === item.url ? 'solar:check-circle-linear' : 'solar:copy-linear'}
                          width={13}
                          height={13}
                        />
                      </button>
                      <button
                        type="button"
                        className={`${styles.historyActionBtn} ${styles.historyActionDelete}`}
                        onClick={() => handleHistoryDelete(item.url)}
                        aria-label="히스토리 삭제"
                        title="삭제"
                      >
                        <Icon icon="solar:close-circle-linear" width={13} height={13} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        </div>
      )}

      {/* ── Step 2: 토큰 타입 선택 + 추출 ────── */}
      {step === 'select' && fileInfo && (
        <div className={styles.inputSection}>
        <div className={styles.inputSectionInner}>
          <div className={styles.selectHeader}>
            <div className={styles.selectHeaderLeft}>
              <span className={styles.sectionLabel}>토큰 추출</span>
              {fromCache && (
                <span className={styles.cacheTag}>
                  <Icon icon="solar:database-linear" width={11} height={11} />
                  캐시됨
                </span>
              )}
            </div>
            <div className={styles.selectHeaderRight}>
              {fromCache && (
                <button type="button" className={styles.refreshBtn} onClick={handleRefresh} disabled={analyzing}>
                  <Icon icon="solar:refresh-linear" width={12} height={12} />
                  새로고침
                </button>
              )}
              <button type="button" className={styles.backBtn} onClick={handleBack}>
                <Icon icon="solar:arrow-left-linear" width={12} height={12} />
                처음으로
              </button>
            </div>
          </div>

          <>
              <div className={styles.selectorPanel}>
                {/* 파일명 */}
                <div className={styles.fileNameRow}>
                  <Icon icon="solar:figma-linear" width={13} height={13} className={styles.fileIcon} />
                  <span className={styles.fileName}>{fileInfo.fileName}</span>
                </div>

                {/* 페이지 목록 */}
                {fileInfo.pages.length > 0 && (
                  <div className={styles.pagesBlock}>
                    <div className={styles.pagesHeader}>
                      <Icon icon="solar:document-text-linear" width={11} height={11} />
                      <span>Pages</span>
                      <span className={styles.pageCount}>{fileInfo.pages.length}</span>
                    </div>
                    <ul className={styles.pageList} aria-label="Figma 페이지 목록">
                      {fileInfo.pages.map((page) => (
                        <li key={page.id} className={styles.pageItem}>
                          <Icon icon="solar:layers-minimalistic-linear" width={11} height={11} className={styles.pageIcon} />
                          <span className={styles.pageName}>{page.name}</span>
                          {page.frames.length > 0 && (
                            <span className={styles.frameCount}>{page.frames.length}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 토큰 미리보기 */}
                <div className={styles.previewBlock}>
                  <div className={styles.previewHeader}>
                    <span className={styles.filterLabel}>발견된 토큰</span>
                    {previewing && <span className={styles.previewLoading}>스캔 중...</span>}
                  </div>
                  {preview && (
                    <div className={styles.previewRows}>
                      {/* 색상 */}
                      <div className={styles.previewRow}>
                        <div className={styles.previewRowMeta}>
                          <Icon icon="solar:pallete-linear" width={12} height={12} className={styles.previewRowIcon} />
                          <span className={styles.previewRowLabel}>Colors</span>
                          <span className={styles.previewRowCount}>{preview.colors.length}</span>
                        </div>
                        <div className={styles.swatchRow}>
                          {preview.colors.slice(0, 10).map((c) => (
                            <span
                              key={`${c.category}/${c.name}`}
                              className={styles.swatch}
                              style={{ background: c.hex }}
                              title={`${c.category}/${c.name} ${c.hex}`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* 타이포그래피 */}
                      {preview.typography.length > 0 && (
                        <div className={styles.previewRow}>
                          <div className={styles.previewRowMeta}>
                            <Icon icon="solar:text-field-linear" width={12} height={12} className={styles.previewRowIcon} />
                            <span className={styles.previewRowLabel}>Typography</span>
                            <span className={styles.previewRowCount}>{preview.typography.length}</span>
                          </div>
                          <div className={styles.valueChips}>
                            {preview.typography.filter((t) => t.category === 'size').map((t) => (
                              <span key={t.name} className={styles.valueChip}>{t.value}px</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 간격 */}
                      {preview.spacing.length > 0 && (
                        <div className={styles.previewRow}>
                          <div className={styles.previewRowMeta}>
                            <Icon icon="solar:ruler-linear" width={12} height={12} className={styles.previewRowIcon} />
                            <span className={styles.previewRowLabel}>Spacing</span>
                            <span className={styles.previewRowCount}>{preview.spacing.length}</span>
                          </div>
                          <div className={styles.valueChips}>
                            {preview.spacing.slice(0, 8).map((s) => (
                              <span key={s.name} className={styles.valueChip}>{s.value}</span>
                            ))}
                            {preview.spacing.length > 8 && (
                              <span className={styles.valueChipMore}>+{preview.spacing.length - 8}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 반경 */}
                      {preview.radius.length > 0 && (
                        <div className={styles.previewRow}>
                          <div className={styles.previewRowMeta}>
                            <Icon icon="solar:crop-linear" width={12} height={12} className={styles.previewRowIcon} />
                            <span className={styles.previewRowLabel}>Radius</span>
                            <span className={styles.previewRowCount}>{preview.radius.length}</span>
                          </div>
                          <div className={styles.valueChips}>
                            {preview.radius.map((r) => (
                              <span key={r.name} className={styles.valueChip}>{r.value}px</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Token Types — 클릭 시 해당 타입 추출 후 페이지 이동 */}
                <div className={styles.filterBlock}>
                  <span className={styles.filterLabel}>추출할 타입 선택</span>
                  <div className={styles.typeChips}>
                    {TOKEN_TYPES.map(({ id, label, icon }) => {
                      const cnt = getTypePreviewCount(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`${styles.typeChip} ${styles.typeChipAction}${cnt === 0 ? ` ${styles.typeChipEmpty}` : ''}`}
                          onClick={() => onExtractType(id)}
                          title={`${label} 토큰 추출하기`}
                        >
                          <Icon icon={icon} width={12} height={12} />
                          {label}
                          {cnt !== null && (
                            <span className={cnt > 0 ? styles.typeChipCount : styles.typeChipCountZero}>
                              {cnt}
                            </span>
                          )}
                          <Icon icon="solar:arrow-right-linear" width={10} height={10} className={styles.typeChipArrow} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {extractDone && (
                <div className={styles.extractSuccess} role="status">
                  <Icon icon="solar:check-circle-linear" width={15} height={15} />
                  <span>
                    {TOKEN_TYPES.find((t) => t.id === extractDone.typeId)?.label ?? extractDone.typeId} 토큰
                    {extractDone.count > 0 ? ` ${extractDone.count}개` : ''} 추출 완료
                  </span>
                </div>
              )}
          </>
        </div>
        </div>
      )}

      {/* ── 대시보드 카드: Navigation + 인라인 토큰 카운트 ── */}
      <div className={styles.dashboardCard}>
        <div className={styles.dashboardInner}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Navigation</span>
            {hasAnyTokens && (
              <button
                type="button"
                className={styles.deleteAllBtn}
                onClick={() => setDeleteAllOpen(true)}
                aria-label="모든 토큰 삭제"
              >
                <Icon icon="solar:trash-bin-2-linear" width={11} height={11} />
                전체 삭제
              </button>
            )}
          </div>

          <nav className={styles.navList} aria-label="주요 메뉴">
            {NAV_ITEMS.map((item, index) => {
              const count = getCount(item);
              const hasCount = count !== null;
              const isTokenGroup = index < 4;
              const showDivider = index === 4; // 토큰 그룹 / 기타 구분선

              return (
                <div key={item.path}>
                  {showDivider && <div className={styles.navDivider} />}
                  <button
                    type="button"
                    className={`${styles.navItem}${isTokenGroup ? ` ${styles.navItemToken}` : ''}`}
                    onClick={() => handleNav(item.path, item.section)}
                  >
                    <div className={styles.navIcon}>
                      <Icon icon={item.icon} width={17} height={17} />
                    </div>
                    <span className={styles.navLabel}>{item.label}</span>
                    {hasCount && (
                      <span className={`${styles.countBadge}${count > 0 ? ` ${styles.countBadgeActive}` : ''}`}>
                        {count}
                      </span>
                    )}
                    <Icon icon="solar:arrow-right-linear" width={11} height={11} className={styles.navArrow} />
                  </button>
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {extractModalType && (
        <TokenExtractModal
          type={extractModalType}
          typeLabel={TOKEN_TYPES.find((t) => t.id === extractModalType)?.label ?? extractModalType}
          isOpen={!!extractModalType}
          initialUrl={getTypeInitialUrl(extractModalType)}
          onClose={() => setExtractModalType(null)}
          onSuccess={(count) => {
            setExtractModalType(null);
            handleExtractSuccess(extractModalType, count);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={handleDeleteAll}
        title="전체 토큰 삭제"
        message="저장된 모든 토큰을 삭제합니다. 이 작업은 되돌릴 수 없습니다."
        confirmLabel="전체 삭제"
        loading={deletingAll}
      />
    </div>
  );
}
