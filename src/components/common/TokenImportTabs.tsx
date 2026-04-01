'use client';

import { useState, useCallback, useRef } from 'react';
import { Icon } from '@iconify/react';
import {
  importFromJsonAction,
  type PixelForgeJson,
} from '@/lib/actions/import-json';
import JsonAnalysisPanel from '@/app/(ide)/JsonAnalysisPanel';
import styles from './TokenImportTabs.module.scss';

type Tab = 'file' | 'paste';

interface ImportResult {
  colors: number;
  typography: number;
  projectId: string;
}

interface Props {
  defaultTab?: Tab;
  onImportSuccess?: (result: ImportResult) => void;
}

export default function TokenImportTabs({ defaultTab = 'paste', onImportSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [parsedData, setParsedData] = useState<PixelForgeJson | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseJson = useCallback((text: string) => {
    try {
      const data = JSON.parse(text.trim()) as PixelForgeJson;
      if (!data.meta) throw new Error('올바른 PixelForge JSON 파일이 아닙니다.');
      setParsedData(data);
      setError(null);
      setDone(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'JSON 파싱에 실패했습니다.');
      setParsedData(null);
    }
  }, []);

  const handleFileRead = useCallback((file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setError('.json 파일만 업로드할 수 있습니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseJson(text);
    };
    reader.onerror = () => setError('파일을 읽는 중 오류가 발생했습니다.');
    reader.readAsText(file);
  }, [parseJson]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileRead(file);
    // reset so same file can be re-selected
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
    setError(null);
    const res = await importFromJsonAction(parsedData);
    setImporting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const result = { colors: res.colors, typography: res.typography, projectId: res.projectId! };
    setDone(result);
    setParsedData(null);
    setJsonText('');
    onImportSuccess?.(result);
  };

  const handleReset = useCallback(() => {
    setParsedData(null);
    setError(null);
    setJsonText('');
    setDone(null);
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    handleReset();
  };

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
        {!parsedData ? (
          <>
            {/* 파일 업로드 탭 */}
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

            {/* 붙여넣기 탭 */}
            {activeTab === 'paste' && (
              <div className={styles.pasteArea}>
                <textarea
                  className={styles.textarea}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text');
                    // setTimeout으로 textarea 값이 업데이트된 후 파싱
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

            {error && (
              <p className={styles.error} role="alert">{error}</p>
            )}

            {done && (
              <div className={styles.success} role="status">
                <Icon icon="solar:check-circle-linear" width={14} height={14} />
                JSON 임포트 완료 — 색상 {done.colors}개, 타이포그래피 {done.typography}개
              </div>
            )}
          </>
        ) : (
          <JsonAnalysisPanel
            data={parsedData}
            importing={importing}
            error={error}
            onImport={handleImport}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}
