// @page Home — Figma URL 입력 + 토큰 추출 + 히스토리
'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { analyzeFileAction, extractTokensAction, getRecentProjects, type RecentProject } from '@/lib/actions/project';
import { getTokenSummary, deleteAllTokensAction, type TokenSummary } from '@/lib/actions/tokens';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/stores/useUIStore';
import { useStageProgress } from '@/hooks/useStageProgress';
import EmptyState from '@/components/common/EmptyState';
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

const SHORTCUTS = [
  { icon: 'solar:pallete-linear', label: '색상 토큰 보기', desc: '추출된 색상 팔레트를 확인합니다', section: 'tokens' as const, path: '/tokens/color' },
  { icon: 'solar:text-field-linear', label: '타이포그래피 토큰', desc: '폰트 스타일과 타입 스케일을 확인합니다', section: 'tokens' as const, path: '/tokens/typography' },
  { icon: 'solar:widget-2-linear', label: '컴포넌트 생성', desc: '토큰 기반 컴포넌트를 생성합니다', section: 'components' as const, path: '/components/new' },
  { icon: 'solar:settings-linear', label: '설정', desc: 'Figma 토큰 및 앱 설정', section: 'settings' as const, path: '/settings' },
];

const RESULT_ITEMS = [
  { key: 'colors' as const, label: 'Colors', icon: 'solar:pallete-linear', path: '/tokens/color' },
  { key: 'typography' as const, label: 'Typography', icon: 'solar:text-field-linear', path: '/tokens/typography' },
  { key: 'spacing' as const, label: 'Spacing', icon: 'solar:ruler-linear', path: '/tokens/spacing' },
  { key: 'radii' as const, label: 'Radii', icon: 'solar:crop-linear', path: '/tokens/radius' },
];

function formatRelativeDate(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

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
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const refreshRef = useRef(false);

  const analyzeProgress = useStageProgress(ANALYZE_STAGES);
  const extractProgress = useStageProgress(EXTRACT_STAGES);

  useEffect(() => {
    getTokenSummary().then(setSummary);
    getRecentProjects().then(setRecentProjects);
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

    if (res.error) {
      setAnalyzeError(res.error);
      return;
    }
    setFileInfo({ fileName: res.fileName, nodeId: res.detectedNodeId });
    setFromCache(res.fromCache);
    setTimeout(() => setStep('select'), res.fromCache ? 0 : 400);
  };

  const onExtract = async () => {
    setExtractError(null);
    setExtracting(true);
    extractProgress.start();

    // nodeIds 없이 전체 문서 추출 — 3-Layer 엔진이 섹션 자동 탐지
    const res = await extractTokensAction(getValues('url'), {
      types: selectedTypes,
    });

    extractProgress.complete();
    setExtracting(false);

    if (res.error) {
      setExtractError(res.error);
      return;
    }
    setResult({ colors: res.colors, typography: res.typography, spacing: res.spacing, radii: res.radii });
    invalidateTokens();
    setSelectedTypes(ALL_TOKEN_TYPE_IDS);
    setTimeout(() => {
      setStep('url');
      router.refresh();
      getTokenSummary().then(setSummary);
      getRecentProjects().then(setRecentProjects);
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

  const handleLoadProject = (project: RecentProject) => {
    if (!project.figmaUrl) return;
    setValue('url', project.figmaUrl);

    if (project.pagesCache) {
      try {
        setFileInfo({ fileName: project.name, nodeId: null });
        setFromCache(true);
        setStep('select');
        return;
      } catch { /* 캐시 파싱 실패 시 fresh 분석 */ }
    }
    handleSubmit(onAnalyze)();
  };

  // Pages 페이지의 "다시 추출" 버튼으로부터 URL 전달받은 경우 자동 로드
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
    getRecentProjects().then(setRecentProjects);
  };

  const handleShortcut = (path: string, section: typeof SHORTCUTS[number]['section']) => {
    setSection(section);
    router.push(path);
  };

  const hasExistingTokens = summary && (summary.colors + summary.typography + summary.spacing + summary.radius > 0);

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
        <div className={styles.section}>
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

          {/* 분석 진행 표시 */}
          {analyzeProgress.isRunning && (
            <div className={styles.progressWrap}>
              <ProgressCard
                percent={analyzeProgress.percent}
                label={analyzeProgress.label}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: 토큰 타입 선택 + 추출 ────── */}
      {step === 'select' && fileInfo && (
        <div className={styles.section}>
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
                {/* 파일명 */}
                <div className={styles.fileNameRow}>
                  <Icon icon="solar:figma-linear" width={13} height={13} className={styles.fileIcon} />
                  <span className={styles.fileName}>{fileInfo.fileName}</span>
                </div>

                {/* Token Types */}
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
      )}

      {/* ── 최근 파일 목록 ───────────────────── */}
      {step === 'url' && recentProjects.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>최근 파일</span>
          <div className={styles.recentList}>
            {recentProjects.map((project) => {
              const stats = [
                project.colors > 0 && `색상 ${project.colors}`,
                project.typography > 0 && `타이포 ${project.typography}`,
                project.spacing > 0 && `간격 ${project.spacing}`,
              ].filter(Boolean).join(' · ');
              return (
                <button
                  key={project.id}
                  type="button"
                  className={styles.recentItem}
                  onClick={() => handleLoadProject(project)}
                  disabled={analyzing}
                >
                  <Icon icon="solar:figma-linear" width={14} height={14} className={styles.recentIcon} />
                  <div className={styles.recentInfo}>
                    <span className={styles.recentName}>{project.name}</span>
                    <span className={styles.recentMeta}>{stats}{stats ? ' · ' : ''}{formatRelativeDate(project.updatedAt)}</span>
                  </div>
                  {project.pagesCache && (
                    <Icon icon="solar:database-linear" width={11} height={11} className={styles.recentCacheIcon} />
                  )}
                  <Icon icon="solar:arrow-right-linear" width={12} height={12} className={styles.recentArrow} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 추출 결과 / 기존 토큰 요약 ──────── */}
      {step === 'url' && (result || hasExistingTokens) && (
        <div className={styles.section}>
          <div className={styles.tokenSummaryHeader}>
            <span className={styles.sectionLabel}>{result ? 'Extracted Tokens' : 'Current Tokens'}</span>
            {!result && hasExistingTokens && (
              <button
                type="button"
                className={styles.deleteAllTokensBtn}
                onClick={() => setDeleteAllOpen(true)}
                aria-label="모든 토큰 삭제"
              >
                <Icon icon="solar:trash-bin-2-linear" width={12} height={12} />
                전체 삭제
              </button>
            )}
          </div>
          <div className={styles.resultGrid}>
            {RESULT_ITEMS.map((item) => {
              const count = result
                ? result[item.key]
                : (summary ? summary[item.key === 'radii' ? 'radius' : item.key] : 0);
              return (
                <button
                  key={item.key}
                  type="button"
                  className={styles.resultItem}
                  onClick={() => { setSection('tokens'); router.push(item.path); }}
                  aria-label={`${item.label} 토큰 상세 보기`}
                >
                  <div className={styles.resultIcon}><Icon icon={item.icon} width={14} height={14} /></div>
                  <span className={styles.resultLabel}>{item.label}</span>
                  <span className={styles.resultCount}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Quick Navigation ────────────────── */}
      <div className={styles.welcome}>
        <h2 className={styles.welcomeTitle}>Quick Navigation</h2>
        <div className={styles.shortcutList}>
          {SHORTCUTS.map((item) => (
            <button key={item.path} type="button" className={styles.shortcutItem} onClick={() => handleShortcut(item.path, item.section)}>
              <div className={styles.shortcutIcon}><Icon icon={item.icon} width={18} height={18} /></div>
              <div className={styles.shortcutText}>
                <span className={styles.shortcutLabel}>{item.label}</span>
                <span className={styles.shortcutDesc}>{item.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Empty state ──────────────────────── */}
      {step === 'url' && !hasExistingTokens && !result && !analyzeProgress.isRunning && (
        <div className={styles.emptySection}>
          <EmptyState icon="solar:figma-linear" title="아직 추출된 토큰이 없습니다" description="Figma URL을 입력하여 디자인 토큰을 추출해보세요." />
        </div>
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
