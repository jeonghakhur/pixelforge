'use client';

import { createPortal } from 'react-dom';
import { useState, useEffect, useMemo, useRef } from 'react';
import hljs from 'highlight.js/lib/core';
import cssLang from 'highlight.js/lib/languages/css';
import 'highlight.js/styles/github-dark.css';
import { Icon } from '@iconify/react';
import { getAllTokensAction, type TokenRow } from '@/lib/actions/tokens';
import { generateAllCssCode } from '@/lib/tokens/css-generator';
import styles from './css-preview.module.scss';

hljs.registerLanguage('css', cssLang);

interface CssPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CssPreviewModal({ isOpen, onClose }: CssPreviewModalProps) {
  const [allTokens, setAllTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getAllTokensAction()
      .then(setAllTokens)
      .finally(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const cssCode = useMemo(() => generateAllCssCode(allTokens), [allTokens]);

  const lines = useMemo(
    () => cssCode.split('\n').map((line) => hljs.highlight(line, { language: 'css' }).value),
    [cssCode],
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cssCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([cssCode], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tokens.css';
    a.click();
    URL.revokeObjectURL(url);
  };

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\. /g, '-').replace('.', '');

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="CSS Variables 미리보기"
      >
        {/* 상단 정보 바 */}
        <div className={styles.commitBar}>
          <div className={styles.commitBarLeft}>
            <Icon icon="solar:palette-linear" width={14} height={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span className={styles.commitAuthor}>PixelForge</span>
            <span className={styles.commitMessage}>Design Token Export</span>
          </div>
          <div className={styles.commitBarRight}>
            <code className={styles.commitHash}>
              <Icon icon="solar:calendar-linear" width={11} height={11} />
              {today}
            </code>
            <button
              ref={closeRef}
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="닫기"
            >
              <Icon icon="solar:close-circle-linear" width={16} height={16} />
            </button>
          </div>
        </div>

        {/* 파일 툴바 */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <Icon icon="solar:file-code-linear" width={14} height={14} style={{ color: '#8b949e' }} />
            <span className={styles.toolbarFilename}>tokens.css</span>
            {!loading && allTokens.length > 0 && (
              <>
                <span className={styles.toolbarMeta}>{allTokens.length} tokens</span>
                <span className={styles.toolbarMeta}>{lines.length} lines</span>
              </>
            )}
          </div>
          <div className={styles.toolbarRight}>
            <button
              type="button"
              className={styles.copyBtn}
              onClick={handleDownload}
              disabled={loading || allTokens.length === 0}
              aria-label="tokens.css 파일 다운로드"
            >
              <Icon icon="solar:download-minimalistic-linear" width={13} height={13} />
              저장
            </button>
            <button
              type="button"
              className={styles.copyBtn}
              onClick={handleCopy}
              disabled={loading || allTokens.length === 0}
              aria-label={copied ? '복사 완료!' : 'CSS 클립보드 복사'}
            >
              <Icon
                icon={copied ? 'solar:check-circle-linear' : 'solar:copy-linear'}
                width={13}
                height={13}
              />
              {copied ? 'Copied!' : 'Raw'}
            </button>
          </div>
        </div>

        {/* 코드 본문 */}
        <div className={styles.body} tabIndex={0} role="region" aria-label="CSS 코드">
          {loading ? (
            <div className={styles.centerWrap}>
              <Icon icon="solar:refresh-linear" width={20} height={20} className={styles.spinning} />
              <span>불러오는 중...</span>
            </div>
          ) : (
            <table className={styles.codeTable}>
              <tbody>
                {lines.map((html, i) => (
                  // highlight.js HTML 출력 (XSS 위험 없음 — 토큰 CSS만 처리)
                  <tr key={i} className={styles.codeRow}>
                    <td className={styles.lineNum}>{i + 1}</td>
                    <td
                      className={styles.codeLine}
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: html || ' ' }}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
