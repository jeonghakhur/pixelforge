'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { captureFigmaScreenshotAction, updateFigmaUrlAction } from '@/lib/actions/screens';
import styles from './page.module.scss';

interface FigmaCompareProps {
  screenId: string;
  figmaUrl: string | null;
  figmaScreenshot: string | null;
  implScreenshot: string | null;
  onCaptured: (path: string) => void;
  onUrlSaved: (url: string) => void;
  isWide?: boolean;
}

export default function FigmaCompare({
  screenId,
  figmaUrl,
  figmaScreenshot,
  implScreenshot,
  onCaptured,
  onUrlSaved,
  isWide = false,
}: FigmaCompareProps) {
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!figmaUrl);
  const [urlInput, setUrlInput] = useState(figmaUrl ?? '');
  const [saving, setSaving] = useState(false);

  const handleCapture = async (url: string) => {
    setCapturing(true);
    setCaptureError(null);
    try {
      const result = await captureFigmaScreenshotAction(screenId, url);
      onCaptured(result.screenshotPath);
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : '캡처 실패');
    } finally {
      setCapturing(false);
    }
  };

  const handleSave = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setSaving(true);
    setCaptureError(null);
    try {
      await updateFigmaUrlAction(screenId, trimmed);
      onUrlSaved(trimmed);
      setEditing(false);
      await handleCapture(trimmed);
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className={styles.sectionTitle}>Figma 원본 vs 실제 구현</p>
      <div className={`${styles.compareGrid}${isWide ? ` ${styles.compareGridWide}` : ''}`}>
        {/* 왼쪽: Figma 원본 */}
        <div className={styles.comparePanel}>
          <span className={styles.compareLabel}>Figma 원본</span>
          <div className={styles.compareImgWrap}>
            <div className={styles.compareImgInner}>
              {figmaScreenshot ? (
                <>
                  <img src={figmaScreenshot} alt="Figma 원본" className={styles.compareImg} />
                  <div className={styles.figmaUrlCurrent}>
                    <Icon icon="solar:link-linear" width={11} height={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span className={styles.figmaUrlText}>{figmaUrl}</span>
                    <button
                      type="button"
                      className={styles.figmaUrlEditBtn}
                      onClick={() => { setEditing(true); setUrlInput(figmaUrl ?? ''); }}
                    >
                      <Icon icon="solar:pen-linear" width={10} height={10} />
                      수정
                    </button>
                    <button
                      type="button"
                      className={styles.captureBtn}
                      onClick={() => figmaUrl && handleCapture(figmaUrl)}
                      disabled={capturing}
                    >
                      <Icon
                        icon={capturing ? 'solar:refresh-linear' : 'solar:camera-linear'}
                        width={12}
                        height={12}
                        className={capturing ? styles.spinning : undefined}
                      />
                      {capturing ? '중...' : '재캡처'}
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.comparePlaceholder}>
                  <Icon icon="solar:figma-linear" width={24} height={24} />
                  {editing ? (
                    <div className={styles.figmaUrlForm}>
                      <input
                        type="url"
                        className={styles.figmaUrlInput}
                        placeholder="https://figma.com/design/..."
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                        autoFocus
                      />
                      <div className={styles.figmaUrlActions}>
                        <button
                          type="button"
                          className={styles.captureBtn}
                          onClick={handleSave}
                          disabled={saving || !urlInput.trim()}
                        >
                          <Icon
                            icon={saving ? 'solar:refresh-linear' : 'solar:camera-add-linear'}
                            width={13}
                            height={13}
                            className={saving ? styles.spinning : undefined}
                          />
                          {saving ? '저장 중...' : '저장 후 캡처'}
                        </button>
                        {figmaUrl && (
                          <button
                            type="button"
                            className={styles.figmaUrlEditBtn}
                            onClick={() => setEditing(false)}
                          >
                            취소
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className={styles.comparePlaceholderText}>Figma URL 없음</span>
                      <button
                        type="button"
                        className={styles.captureBtn}
                        onClick={() => setEditing(true)}
                      >
                        <Icon icon="solar:add-circle-linear" width={13} height={13} />
                        URL 등록
                      </button>
                    </>
                  )}
                  {captureError && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '4px', textAlign: 'center' }}>
                      {captureError}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* URL 수정 폼 (스크린샷 있는 상태에서 수정 클릭 시) */}
          {editing && figmaScreenshot && (
            <div className={styles.figmaUrlForm} style={{ marginTop: '8px' }}>
              <input
                type="url"
                className={styles.figmaUrlInput}
                placeholder="https://figma.com/design/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                autoFocus
              />
              <div className={styles.figmaUrlActions}>
                <button
                  type="button"
                  className={styles.captureBtn}
                  onClick={handleSave}
                  disabled={saving || !urlInput.trim()}
                >
                  <Icon
                    icon={saving ? 'solar:refresh-linear' : 'solar:camera-add-linear'}
                    width={13}
                    height={13}
                    className={saving ? styles.spinning : undefined}
                  />
                  {saving ? '저장 중...' : '저장 후 캡처'}
                </button>
                <button
                  type="button"
                  className={styles.figmaUrlEditBtn}
                  onClick={() => setEditing(false)}
                >
                  취소
                </button>
              </div>
              {captureError && (
                <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>
                  {captureError}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 오른쪽: 실제 구현 */}
        <div className={styles.comparePanel}>
          <span className={styles.compareLabel}>실제 구현</span>
          <div className={styles.compareImgWrap}>
            <div className={styles.compareImgInner}>
              {implScreenshot ? (
                <img src={implScreenshot} alt="실제 구현" className={styles.compareImg} />
              ) : (
                <div className={styles.comparePlaceholder}>
                  <Icon icon="solar:monitor-smartphone-linear" width={24} height={24} />
                  <span className={styles.comparePlaceholderText}>
                    Playwright 실행 후 생성
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
