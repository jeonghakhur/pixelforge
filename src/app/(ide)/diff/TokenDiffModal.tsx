'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import hljs from 'highlight.js/lib/core';
import cssLang from 'highlight.js/lib/languages/css';
import { Diff2HtmlUI } from 'diff2html/lib/ui/js/diff2html-ui-base';
import 'diff2html/bundles/css/diff2html.min.css';
import 'highlight.js/styles/github-dark.css';
import {
  getTokenCssDiffAction,
  getTokenCssAtCommitAction,
  type TokenCommit,
} from '@/lib/actions/token-history';
import { DiffToolbar } from '@/app/(ide)/screens/DiffToolbar';
import styles from '@/app/(ide)/screens/CodeViewModal.module.scss';

hljs.registerLanguage('css', cssLang);

interface TokenDiffModalProps {
  commit: TokenCommit;
  onClose: () => void;
}

export default function TokenDiffModal({ commit, onClose }: TokenDiffModalProps) {
  const [content, setContent] = useState('');
  const [diffViewType, setDiffViewType] = useState<'side-by-side' | 'line-by-line'>('line-by-line');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [expandedLines, setExpandedLines] = useState<string[]>([]);
  const [expandLoading, setExpandLoading] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const diffContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setContent('');

    getTokenCssDiffAction(`${commit.hash}~1`, commit.hash)
      .then((result) => {
        if (result.error) throw new Error(result.error);
        setContent(result.diff);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }, [commit.hash]);

  useEffect(() => {
    if (!diffContainerRef.current || loading || error || showSource) return;
    if (!content) {
      diffContainerRef.current.innerHTML = '<p class="gh-empty">변경 사항이 없습니다</p>';
      return;
    }
    diffContainerRef.current.innerHTML = '';
    const ui = new Diff2HtmlUI(diffContainerRef.current, content, {
      drawFileList: false,
      matching: 'lines',
      outputFormat: diffViewType,
      renderNothingWhenEmpty: false,
      highlight: true,
      synchronisedScroll: diffViewType === 'side-by-side',
      fileListToggle: false,
      smartSelection: false,
      fileContentToggle: false,
      stickyFileHeaders: false,
    }, hljs);
    ui.draw();
  }, [content, diffViewType, loading, error, showSource]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleExpandSource = async () => {
    if (showSource) { setShowSource(false); return; }
    if (expandedLines.length === 0) {
      setExpandLoading(true);
      try {
        const result = await getTokenCssAtCommitAction(commit.hash);
        if (!result.error && result.content) {
          const lines = hljs.highlight(result.content, { language: 'css' }).value.split('\n');
          setExpandedLines(lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines);
        }
      } finally {
        setExpandLoading(false);
      }
    }
    setShowSource(true);
  };

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="토큰 변경 내역"
      >
        <div className={styles.commitBar}>
          <div className={styles.commitBarLeft}>
            <div className={styles.commitAvatar}>
              {commit.author.slice(0, 1).toUpperCase()}
            </div>
            <span className={styles.commitAuthor}>{commit.author}</span>
            <span className={styles.commitMessage}>{commit.message}</span>
          </div>
          <div className={styles.commitBarRight}>
            <span className={styles.commitHash}>
              <Icon icon="solar:git-commit-linear" width={12} height={12} />
              {commit.hash}
            </span>
          </div>
        </div>
        <DiffToolbar
          screenId="design-tokens/tokens.css"
          mode="commit"
          sourceLineCount={0}
          expandedLineCount={expandedLines.length}
          showSource={showSource}
          expandLoading={expandLoading}
          loading={loading}
          hasContent={!!content}
          copied={copied}
          diffViewType={diffViewType}
          closeRef={closeRef}
          onExpandSource={handleExpandSource}
          onCopy={handleCopy}
          onDiffViewChange={setDiffViewType}
          onClose={onClose}
        />
        <div className={styles.body}>
          {loading && (
            <div className={styles.centerWrap}>
              <Icon icon="solar:refresh-linear" width={20} height={20} className={styles.spinning} />
              <span>불러오는 중...</span>
            </div>
          )}
          {error && (
            <div className={`${styles.centerWrap} ${styles.errorWrap}`}>
              <Icon icon="solar:danger-circle-linear" width={20} height={20} />
              <span>{error}</span>
            </div>
          )}
          {!loading && !error && !showSource && (
            <div ref={diffContainerRef} className={styles.diffWrap} />
          )}
          {!loading && !error && showSource && !expandLoading && (
            expandedLines.length > 0 ? (
              <table className={styles.codeTable}>
                <tbody>
                  {expandedLines.map((line, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <tr key={i} className={styles.codeRow}>
                      <td className={styles.lineNum}>{i + 1}</td>
                      <td
                        className={styles.codeLine}
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{ __html: line || '\u00a0' }}
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.centerWrap}>
                <Icon icon="solar:file-text-linear" width={20} height={20} />
                <span>소스를 불러올 수 없습니다</span>
              </div>
            )
          )}
          {!loading && !error && showSource && expandLoading && (
            <div className={styles.centerWrap}>
              <Icon icon="solar:refresh-linear" width={20} height={20} className={styles.spinning} />
              <span>불러오는 중...</span>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
