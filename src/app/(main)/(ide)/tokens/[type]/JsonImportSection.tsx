'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { importFromJsonAction, type PixelForgeJson } from '@/lib/actions/import-json';
import JsonAnalysisPanel from '../../JsonAnalysisPanel';
import styles from './page.module.scss';

interface Props {
  /** true면 토글 버튼으로 접힌 상태로 시작 */
  collapsed?: boolean;
}

export default function JsonImportSection({ collapsed = false }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(!collapsed);
  const [jsonText, setJsonText] = useState('');
  const [jsonParsedData, setJsonParsedData] = useState<PixelForgeJson | null>(null);
  const [jsonImporting, setJsonImporting] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonImportDone, setJsonImportDone] = useState<{ colors: number; typography: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleParse = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const data = JSON.parse(trimmed) as PixelForgeJson;
      if (!data.meta) throw new Error('올바른 PixelForge JSON 파일이 아닙니다.');
      setJsonParsedData(data);
      setJsonError(null);
      setJsonImportDone(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'JSON 파싱에 실패했습니다.');
      setJsonParsedData(null);
    }
  }, []);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setJsonText(text);
      handleParse(text);
    };
    reader.readAsText(file);
  }, [handleParse]);

  const handleImport = async () => {
    if (!jsonParsedData) return;
    setJsonImporting(true);
    setJsonError(null);
    const res = await importFromJsonAction(jsonParsedData);
    setJsonImporting(false);
    if (res.error) { setJsonError(res.error); return; }
    setJsonImportDone({ colors: res.colors, typography: res.typography });
    setJsonParsedData(null);
    setJsonText('');
    router.refresh();
  };

  const handleReset = useCallback(() => {
    setJsonParsedData(null);
    setJsonError(null);
    setJsonText('');
  }, []);

  return (
    <div className={styles.jsonImportSection}>
      {collapsed && (
        <button
          type="button"
          className={styles.jsonImportToggle}
          onClick={() => setIsOpen((o) => !o)}
          aria-expanded={isOpen}
        >
          <Icon icon="solar:import-linear" width={13} height={13} />
          JSON으로 가져오기
          <Icon
            icon={isOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
            width={11}
            height={11}
            className={styles.jsonToggleChevron}
          />
        </button>
      )}

      {isOpen && (
        <div className={styles.jsonImportBody}>
          {!jsonParsedData ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                aria-hidden="true"
                tabIndex={-1}
              />

              <textarea
                className={styles.jsonImportTextarea}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  handleParse(pasted);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file?.name.endsWith('.json')) handleFile(file);
                }}
                onDragOver={(e) => e.preventDefault()}
                placeholder={'{ "meta": { ... }, "variables": { ... } }'}
                spellCheck={false}
                aria-label="PixelForge JSON 붙여넣기"
                rows={5}
              />

              <div className={styles.jsonImportBar}>
                <button
                  type="button"
                  className={styles.jsonFileBtn}
                  onClick={() => fileRef.current?.click()}
                >
                  <Icon icon="solar:file-text-linear" width={13} height={13} />
                  파일 선택
                </button>
                <span className={styles.jsonImportHint}>
                  <Icon icon="solar:info-circle-linear" width={11} height={11} />
                  Figma 플러그인에서 내보낸 JSON · 붙여넣기 또는 파일 첨부
                </span>
                <button
                  type="button"
                  className={styles.jsonParseBtn}
                  onClick={() => handleParse(jsonText)}
                  disabled={!jsonText.trim()}
                >
                  <Icon icon="solar:magnifer-linear" width={13} height={13} />
                  분석
                </button>
              </div>

              {jsonError && (
                <p className={styles.jsonImportError} role="alert">{jsonError}</p>
              )}
            </>
          ) : (
            <JsonAnalysisPanel
              data={jsonParsedData}
              importing={jsonImporting}
              error={jsonError}
              onImport={handleImport}
              onReset={handleReset}
            />
          )}

          {jsonImportDone && (
            <div className={styles.jsonImportDone} role="status">
              <Icon icon="solar:check-circle-linear" width={14} height={14} />
              <span>
                JSON 임포트 완료 — 색상 {jsonImportDone.colors}개, 타이포그래피 {jsonImportDone.typography}개
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
