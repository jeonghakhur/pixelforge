// @page Home — Figma URL 입력 + 토큰 추출 + 대시보드
'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { analyzeFileAction, extractTokensAction } from '@/lib/actions/project';
import { getTokenSummary, deleteAllTokensAction, type TokenSummary } from '@/lib/actions/tokens';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/stores/useUIStore';
import { useStageProgress } from '@/hooks/useStageProgress';
import ProgressCard from '@/components/common/ProgressCard';
import { TOKEN_TYPES, ALL_TOKEN_TYPE_IDS } from '@/lib/tokens/token-types';
import styles from './page.module.scss';

const figmaUrlSchema = z.object({
  url: z
    .string()
    .min(1, 'Figma URL을 입력해주세요')
    .url('올바른 URL 형식이 아닙니다')
    .refine((val) => val.includes('figma.com'), 'Figma URL을 입력해주세요'),
});
type FigmaUrlForm = z.infer<typeof figmaUrlSchema>;

interface ExtractResult { colors: number; typography: number; spacing: number; radii: number; }

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
type CountKey = 'colors' | 'typography' | 'spacing' | 'radius' | null;

const NAV_ITEMS: {
  icon: string;
  label: string;
  path: string;
  section: SectionKey;
  countKey: CountKey;
  resultKey?: keyof ExtractResult;
}[] = [
  { icon: 'solar:pallete-linear',    label: '색상',        path: '/tokens/color',      section: 'tokens',     countKey: 'colors',     resultKey: 'colors'     },
  { icon: 'solar:text-field-linear', label: '타이포그래피', path: '/tokens/typography', section: 'tokens',     countKey: 'typography', resultKey: 'typography' },
  { icon: 'solar:ruler-linear',      label: '간격',        path: '/tokens/spacing',    section: 'tokens',     countKey: 'spacing',    resultKey: 'spacing'    },
  { icon: 'solar:crop-linear',       label: '반경',        path: '/tokens/radius',     section: 'tokens',     countKey: 'radius',     resultKey: 'radii'      },
  { icon: 'solar:widget-2-linear',   label: '컴포넌트',    path: '/components/new',    section: 'components', countKey: null },
  { icon: 'solar:settings-linear',   label: '설정',        path: '/settings',          section: 'settings',   countKey: null },
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
  const [fileInfo, setFileInfo] = useState<{ fileName: string; nodeId: string | null } | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(ALL_TOKEN_TYPE_IDS);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [summary, setSummary] = useState<TokenSummary | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const refreshRef = useRef(false);

  const analyzeProgress = useStageProgress(ANALYZE_STAGES);
  const extractProgress = useStageProgress(EXTRACT_STAGES);

  useEffect(() => {
    getTokenSummary().then(setSummary);
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
    setFileInfo({ fileName: res.fileName, nodeId: res.detectedNodeId });
    setFromCache(res.fromCache);
    setTimeout(() => setStep('select'), res.fromCache ? 0 : 400);
  };

  const onExtract = async () => {
    setExtractError(null);
    setExtracting(true);
    extractProgress.start();

    const res = await extractTokensAction(getValues('url'), { types: selectedTypes });
    extractProgress.complete();
    setExtracting(false);

    if (res.error) { setExtractError(res.error); return; }
    setResult({ colors: res.colors, typography: res.typography, spacing: res.spacing, radii: res.radii });
    invalidateTokens();
    setSelectedTypes(ALL_TOKEN_TYPE_IDS);
    setTimeout(() => {
      setStep('url');
      router.refresh();
      getTokenSummary().then(setSummary);
    }, 500);
  };

  const handleBack = () => {
    setStep('url');
    setFileInfo(null);
    setFromCache(false);
    setAnalyzeError(null);
    setExtractError(null);
    setSelectedTypes(ALL_TOKEN_TYPE_IDS);
    analyzeProgress.reset();
    extractProgress.reset();
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

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    await deleteAllTokensAction();
    setDeletingAll(false);
    setDeleteAllOpen(false);
    setSummary(null);
    setResult(null);
    invalidateTokens();
    router.refresh();
  };

  const handleNav = (path: string, section: SectionKey) => {
    setSection(section);
    router.push(path);
  };

  const getCount = (item: typeof NAV_ITEMS[number]): number | null => {
    if (!item.countKey) return null;
    if (result && item.resultKey) return result[item.resultKey];
    if (summary) return summary[item.countKey];
    return null;
  };

  const hasAnyTokens = summary && (summary.colors + summary.typography + summary.spacing + summary.radius > 0);

  const toggleType = (id: string) => {
    setSelectedTypes((prev) =>
      prev.includes(id)
        ? prev.length === 1 ? ALL_TOKEN_TYPE_IDS : prev.filter((t) => t !== id)
        : [...prev, id],
    );
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
                <Icon icon="solar:magnifer-linear" width={14} height={14} />
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
                <button type="button" className={styles.refreshBtn} onClick={handleRefresh} disabled={extracting || analyzing}>
                  <Icon icon="solar:refresh-linear" width={12} height={12} />
                  새로고침
                </button>
              )}
              <button type="button" className={styles.backBtn} onClick={handleBack} disabled={extracting}>
                <Icon icon="solar:arrow-left-linear" width={12} height={12} />
                처음으로
              </button>
            </div>
          </div>

          {extracting || extractProgress.isRunning ? (
            <div className={styles.progressWrap}>
              <ProgressCard percent={extractProgress.percent} label={extractProgress.label} />
            </div>
          ) : (
            <>
              <div className={styles.selectorPanel}>
                <div className={styles.fileNameRow}>
                  <Icon icon="solar:figma-linear" width={13} height={13} className={styles.fileIcon} />
                  <span className={styles.fileName}>{fileInfo.fileName}</span>
                </div>
                <div className={styles.filterBlock}>
                  <span className={styles.filterLabel}>Token Types</span>
                  <div className={styles.typeChips}>
                    {TOKEN_TYPES.map(({ id, label, icon }) => (
                      <button
                        key={id}
                        type="button"
                        className={`${styles.typeChip}${selectedTypes.includes(id) ? ` ${styles.typeChipActive}` : ''}`}
                        onClick={() => toggleType(id)}
                        aria-pressed={selectedTypes.includes(id)}
                      >
                        <Icon icon={icon} width={12} height={12} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {extractError && (
                <p className={styles.error} role="alert">{extractError}</p>
              )}
              <button
                type="button"
                className={styles.extractBtn}
                style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }}
                onClick={onExtract}
              >
                <Icon icon="solar:download-minimalistic-linear" width={14} height={14} />
                {fileInfo?.nodeId ? '선택된 노드에서 추출' : '전체 문서에서 추출'}
              </button>
            </>
          )}
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
                      <Icon icon={item.icon} width={14} height={14} />
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
