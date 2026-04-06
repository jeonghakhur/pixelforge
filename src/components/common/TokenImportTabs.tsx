'use client';

import { useState, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import {
  importFromJsonAction,
  type PixelForgeJson,
} from '@/lib/actions/import-json';
import JsonAnalysisPanel from '@/app/(ide)/JsonAnalysisPanel';
import styles from './TokenImportTabs.module.scss';

type InputTab = 'file' | 'paste';
type Step = 'input' | 'review' | 'done';

interface ImportResult {
  colors: number;
  typography: number;
  radius: number;
  spacing: number;
  projectId: string;
}

interface Props {
  defaultTab?: InputTab;
  onImportSuccess?: (result: ImportResult) => void;
  /** 파싱 완료 시 즉시 호출 — 제공되면 내부 review 단계를 건너뜁니다 */
  onParsed?: (data: PixelForgeJson) => void;
}

// ── 임포트될 토큰 수 미리 계산 (클라이언트 사이드 프리뷰용)
export function previewTokenCounts(data: PixelForgeJson) {
  let colors = 0;

  if (data.variables) {
    const collMap = new Map(data.variables.collections.map((c) => [c.id, c]));
    for (const v of data.variables.variables) {
      if (v.resolvedType !== 'COLOR') continue;
      const col = collMap.get(v.collectionId);
      const modeId = col?.modes[0]?.modeId ?? Object.keys(v.valuesByMode)[0];
      if (!modeId) continue;
      const val = v.valuesByMode[modeId];
      if (!val || (typeof val === 'object' && val !== null && 'type' in val)) continue; // alias 제외
      colors++;
    }
  }

  if (colors === 0) colors = data.styles?.colors?.length ?? 0;

  const typography = data.styles?.texts?.length ?? 0;
  const radius = data.radius?.length ?? 0;
  const spacing = data.spacing?.length ?? 0;

  return { colors, typography, radius, spacing };
}

export default function TokenImportTabs({ defaultTab = 'file', onImportSuccess, onParsed }: Props) {
  const [step, setStep] = useState<Step>('input');
  const [activeTab, setActiveTab] = useState<InputTab>(defaultTab);
  const [parsedData, setParsedData] = useState<PixelForgeJson | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseJson = useCallback((text: string) => {
    try {
      const data = JSON.parse(text.trim()) as PixelForgeJson;
      if (!data.meta) throw new Error('올바른 PixelForge JSON 파일이 아닙니다.');
      if (onParsed) {
        onParsed(data);
        return;
      }
      setParsedData(data);
      setParseError(null);
      setStep('review');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'JSON 파싱에 실패했습니다.');
      setParsedData(null);
    }
  }, [onParsed]);

  const handleFileRead = useCallback((file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setParseError('.json 파일만 업로드할 수 있습니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => parseJson(e.target?.result as string);
    reader.onerror = () => setParseError('파일을 읽는 중 오류가 발생했습니다.');
    reader.readAsText(file);
  }, [parseJson]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileRead(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileRead(file);
  };

  const handleImport = async () => {
    if (!parsedData) return;
    setImporting(true);
    setImportError(null);
    const res = await importFromJsonAction(parsedData);
    setImporting(false);
    if (res.error) {
      setImportError(res.error);
      return;
    }
    const counts = previewTokenCounts(parsedData);
    const result: ImportResult = {
      colors: counts.colors,
      typography: counts.typography,
      radius: counts.radius,
      spacing: counts.spacing,
      projectId: res.projectId!,
    };
    setDone(result);
    setStep('done');
    onImportSuccess?.(result);
  };

  const handleReset = useCallback(() => {
    setParsedData(null);
    setParseError(null);
    setImportError(null);
    setJsonText('');
    setStep('input');
  }, []);

  const handleTabChange = (tab: InputTab) => {
    setActiveTab(tab);
    setParseError(null);
  };

  // ── Step: 완료 ───────────────────────────────────────────────────────────
  if (step === 'done' && done) {
    const chips = [
      { icon: 'solar:pallete-linear', label: 'Colors', count: done.colors },
      { icon: 'solar:text-field-linear', label: 'Typography', count: done.typography },
      { icon: 'solar:crop-minimalistic-linear', label: 'Radius', count: done.radius },
      { icon: 'solar:ruler-linear', label: 'Spacing', count: done.spacing },
    ].filter((c) => c.count > 0);

    return (
      <div className={styles.doneWrap}>
        <span className={styles.doneIcon}>
          <Icon icon="solar:check-circle-bold" width={32} height={32} />
        </span>
        <p className={styles.doneTitle}>토큰 생성 완료</p>
        <div className={styles.doneChips}>
          {chips.map((c) => (
            <span key={c.label} className={styles.doneChip}>
              <Icon icon={c.icon} width={11} height={11} />
              {c.label} {c.count}
            </span>
          ))}
        </div>
        <button type="button" className={styles.doneResetBtn} onClick={handleReset}>
          <Icon icon="solar:import-linear" width={13} height={13} />
          다른 파일 가져오기
        </button>
      </div>
    );
  }

  // ── Step: 분석 리뷰 ──────────────────────────────────────────────────────
  if (step === 'review' && parsedData) {
    const counts = previewTokenCounts(parsedData);
    const total = counts.colors + counts.typography + counts.radius + counts.spacing;
    const chips = [
      { icon: 'solar:pallete-linear', label: 'Colors', count: counts.colors },
      { icon: 'solar:text-field-linear', label: 'Typography', count: counts.typography },
      { icon: 'solar:crop-minimalistic-linear', label: 'Radius', count: counts.radius },
      { icon: 'solar:ruler-linear', label: 'Spacing', count: counts.spacing },
    ].filter((c) => c.count > 0);

    return (
      <div className={styles.reviewWrap}>
        <JsonAnalysisPanel
          data={parsedData}
          importing={false}
          error={null}
          onImport={handleImport}
          onReset={handleReset}
          hideFooter
        />

        {/* ── 확인 바 */}
        <div className={styles.confirmBar}>
          <div className={styles.confirmLeft}>
            <span className={styles.confirmLabel}>
              생성될 토큰
              <span className={styles.confirmTotal}>{total}개</span>
            </span>
            <div className={styles.confirmChips}>
              {chips.map((c) => (
                <span key={c.label} className={styles.confirmChip}>
                  <Icon icon={c.icon} width={10} height={10} />
                  {c.label} {c.count}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.confirmActions}>
            {importError && (
              <span className={styles.confirmError} role="alert">{importError}</span>
            )}
            <button
              type="button"
              className={styles.backBtn}
              onClick={handleReset}
              disabled={importing}
            >
              뒤로
            </button>
            <button
              type="button"
              className={styles.generateBtn}
              onClick={handleImport}
              disabled={importing || total === 0}
            >
              {importing ? (
                <>
                  <Icon icon="solar:loading-linear" width={14} height={14} className={styles.spinning} />
                  생성 중...
                </>
              ) : (
                <>
                  <Icon icon="solar:import-linear" width={14} height={14} />
                  토큰 생성하기
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: 입력 ───────────────────────────────────────────────────────────
  return (
    <div className={styles.wrap}>
      {/* 탭 헤더 */}
      <div className={styles.tabHeader} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'file'}
          className={`${styles.tab} ${activeTab === 'file' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('file')}
        >
          <Icon icon="solar:file-text-linear" width={13} height={13} />
          JSON 파일
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'paste'}
          className={`${styles.tab} ${activeTab === 'paste' ? styles.tabActive : ''}`}
          onClick={() => handleTabChange('paste')}
        >
          <Icon icon="solar:clipboard-text-linear" width={13} height={13} />
          JSON 붙여넣기
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      <div className={styles.tabContent}>
        {/* 파일 업로드 */}
        {activeTab === 'file' && (
          <div
            className={`${styles.dropZone} ${dragging ? styles.dropZoneDragging : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className={styles.fileInput}
              onChange={handleFileChange}
              aria-label="JSON 파일 선택"
            />
            <Icon
              icon={dragging ? 'solar:inbox-in-linear' : 'solar:file-text-linear'}
              width={28}
              height={28}
              className={styles.dropIcon}
            />
            <p className={styles.dropTitle}>
              {dragging ? '파일을 여기에 놓으세요' : 'JSON 파일을 드래그하거나'}
            </p>
            {!dragging && (
              <button
                type="button"
                className={styles.browseBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon icon="solar:folder-open-linear" width={13} height={13} />
                파일 선택
              </button>
            )}
          </div>
        )}

        {/* 붙여넣기 */}
        {activeTab === 'paste' && (
          <div className={styles.pasteArea}>
            <textarea
              className={styles.textarea}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                setTimeout(() => parseJson(pasted), 0);
              }}
              placeholder='{ "meta": { ... }, "variables": { ... } }'
              spellCheck={false}
              aria-label="PixelForge JSON 붙여넣기"
              rows={5}
            />
            <div className={styles.pasteFooter}>
              <span className={styles.hint}>
                <Icon icon="solar:info-circle-linear" width={11} height={11} />
                Figma 플러그인에서 내보낸 JSON을 붙여넣기
              </span>
              <button
                type="button"
                className={styles.parseBtn}
                onClick={() => parseJson(jsonText)}
                disabled={!jsonText.trim()}
              >
                <Icon icon="solar:magnifer-linear" width={13} height={13} />
                분석
              </button>
            </div>
          </div>
        )}

        {parseError && (
          <p className={styles.error} role="alert">{parseError}</p>
        )}
      </div>
    </div>
  );
}
