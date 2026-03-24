'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { html as diff2html } from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';
import hljs from 'highlight.js/lib/core';
import cssLang from 'highlight.js/lib/languages/css';
import {
  getTokenCssHistoryAction,
  getTokenCssDiffAction,
  getTokenCssAtCommitAction,
  type TokenCommit,
} from '@/lib/actions/token-history';
import Spinner from '@/components/common/Spinner';
import styles from './token-commit-history.module.scss';

hljs.registerLanguage('css', cssLang);

function formatRelativeDate(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);

    const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
    if (days >= 1) return rtf.format(-days, 'day');
    if (hours >= 1) return rtf.format(-hours, 'hour');
    if (minutes >= 1) return rtf.format(-minutes, 'minute');
    return '방금';
  } catch {
    return iso.slice(0, 10);
  }
}

// ===========================
// CSS 보기 모달 (createPortal)
// ===========================

function CssViewModal({ content, hash, onClose }: { content: string; hash: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const lines = useMemo(
    () => content.split('\n').map((line) => hljs.highlight(line, { language: 'css' }).value),
    [content],
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tokens-${hash}.css`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose} aria-hidden="true">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`커밋 ${hash} CSS 보기`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <Icon icon="solar:file-code-linear" width={14} height={14} style={{ color: 'var(--accent)' }} />
          <span className={styles.modalTitle}>tokens.css @ {hash}</span>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleDownload}
            aria-label="파일 다운로드"
          >
            <Icon icon="solar:download-minimalistic-linear" width={12} height={12} />
            저장
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleCopy}
            aria-label="클립보드 복사"
          >
            <Icon icon="solar:copy-linear" width={12} height={12} />
            Raw
          </button>
          <button
            ref={closeRef}
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="닫기"
          >
            <Icon icon="solar:close-circle-linear" width={16} height={16} />
          </button>
        </div>
        <div className={styles.modalBody} tabIndex={0} role="region" aria-label="CSS 코드">
          <table>
            <tbody>
              {lines.map((html, i) => (
                <tr key={i}>
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
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ===========================
// Diff 패널
// ===========================

function DiffPanel({ hash }: { hash: string }) {
  const [diffHtml, setDiffHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDiffHtml(null);

    getTokenCssDiffAction(`${hash}~1`, hash).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
      } else if (!result.diff) {
        setDiffHtml('');
      } else {
        const html = diff2html(result.diff, {
          matching: 'lines',
          outputFormat: 'line-by-line',
          renderNothingWhenEmpty: false,
          drawFileList: false,
        });
        setDiffHtml(html);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [hash]);

  if (loading) {
    return (
      <div className={styles.diffLoading}>
        <Spinner size="sm" />
        <span>diff 불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return <div className={styles.diffEmpty}>{error}</div>;
  }

  if (diffHtml === '') {
    return <div className={styles.diffEmpty}>변경된 내용이 없습니다.</div>;
  }

  return (
    <div
      className={styles.diffPanel}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: diffHtml ?? '' }}
    />
  );
}

// ===========================
// 메인 컴포넌트
// ===========================

export default function TokenCommitHistory() {
  const [commits, setCommits] = useState<TokenCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const [cssModal, setCssModal] = useState<{ hash: string; content: string } | null>(null);
  const [cssLoading, setCssLoading] = useState<string | null>(null);

  useEffect(() => {
    getTokenCssHistoryAction().then((result) => {
      setCommits(result.commits);
      setLoading(false);
    });
  }, []);

  const handleToggleDiff = useCallback((hash: string) => {
    setExpandedHash((prev) => (prev === hash ? null : hash));
  }, []);

  const handleViewCss = useCallback(async (hash: string) => {
    setCssLoading(hash);
    const result = await getTokenCssAtCommitAction(hash);
    setCssLoading(null);
    if (!result.error && result.content) {
      setCssModal({ hash, content: result.content });
    }
  }, []);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <Icon icon="solar:history-linear" width={18} height={18} />
          커밋 이력
        </h2>
        <code className={styles.fileBadge}>design-tokens/tokens.css</code>
      </div>

      {loading ? (
        <div className={styles.emptyState}>
          <Spinner size="sm" />
          <span>불러오는 중...</span>
        </div>
      ) : commits.length === 0 ? (
        <div className={styles.emptyState}>
          <Icon icon="solar:info-circle-linear" width={16} height={16} />
          <span>아직 추출된 토큰이 없습니다. 토큰을 추출하면 자동으로 기록됩니다.</span>
        </div>
      ) : (
        <div className={styles.commitList}>
          {commits.map((commit) => (
            <div key={commit.hash}>
              <div className={styles.commitRow}>
                <span className={styles.hash}>{commit.hash}</span>
                <span className={styles.message} title={commit.message}>{commit.message}</span>
                <span className={styles.date}>{formatRelativeDate(commit.date)}</span>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${expandedHash === commit.hash ? styles.active : ''}`}
                    onClick={() => handleToggleDiff(commit.hash)}
                    aria-expanded={expandedHash === commit.hash}
                    aria-label={`${commit.hash} diff 보기`}
                  >
                    <Icon icon="solar:code-square-linear" width={12} height={12} />
                    diff
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => handleViewCss(commit.hash)}
                    disabled={cssLoading === commit.hash}
                    aria-label={`${commit.hash} CSS 보기`}
                  >
                    {cssLoading === commit.hash
                      ? <Spinner size="sm" />
                      : <Icon icon="solar:file-code-linear" width={12} height={12} />
                    }
                    CSS
                  </button>
                </div>
              </div>
              {expandedHash === commit.hash && (
                <DiffPanel hash={commit.hash} />
              )}
            </div>
          ))}
        </div>
      )}

      {cssModal && (
        <CssViewModal
          content={cssModal.content}
          hash={cssModal.hash}
          onClose={() => setCssModal(null)}
        />
      )}
    </section>
  );
}
