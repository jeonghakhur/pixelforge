'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import hljs from 'highlight.js/lib/core';
import hljsTypescript from 'highlight.js/lib/languages/typescript';
import hljsJavascript from 'highlight.js/lib/languages/javascript';
import hljsScss from 'highlight.js/lib/languages/scss';
import hljsJson from 'highlight.js/lib/languages/json';
import hljsMarkdown from 'highlight.js/lib/languages/markdown';
import hljsCss from 'highlight.js/lib/languages/css';
import { Diff2HtmlUI } from 'diff2html/lib/ui/js/diff2html-ui-base';
import 'diff2html/bundles/css/diff2html.min.css';
import 'highlight.js/styles/github-dark.css';
import type { GitCommit } from '@/lib/screens/git-history';
import { getCommitSourceAction, getCommitDiffAction, getCommitParentDiffAction } from '@/lib/actions/screens';
import { CommitBar } from './CommitBar';
import { DiffToolbar } from './DiffToolbar';
import styles from './CodeViewModal.module.scss';

hljs.registerLanguage('typescript', hljsTypescript);
hljs.registerLanguage('javascript', hljsJavascript);
hljs.registerLanguage('scss', hljsScss);
hljs.registerLanguage('json', hljsJson);
hljs.registerLanguage('markdown', hljsMarkdown);
hljs.registerLanguage('css', hljsCss);
hljs.registerAliases(['tsx', 'ts'], { languageName: 'typescript' });
hljs.registerAliases(['jsx'], { languageName: 'javascript' });

interface CodeViewModalProps {
  screenId: string;
  mode: 'source' | 'diff' | 'commit';
  hash?: string;
  hashA?: string;
  hashB?: string;
  commits: GitCommit[];
  onClose: () => void;
}

export default function CodeViewModal({
  screenId,
  mode,
  hash,
  hashA,
  hashB,
  commits,
  onClose,
}: CodeViewModalProps) {
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('typescript');
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

    const load =
      mode === 'source'
        ? getCommitSourceAction(screenId, hash!).then(({ source, language: lang }) => {
            setLanguage(lang);
            return source;
          })
        : mode === 'commit'
        ? getCommitParentDiffAction(screenId, hash!)
        : getCommitDiffAction(screenId, hashA!, hashB!);

    load
      .then(setContent)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }, [screenId, mode, hash, hashA, hashB]);

  useEffect(() => {
    if (!diffContainerRef.current || loading || error) return;
    if (mode !== 'diff' && mode !== 'commit') return;
    if (showSource) return;
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
  }, [content, mode, diffViewType, loading, error, showSource]);

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
      const targetHash = hash ?? hashB;
      if (!targetHash) return;
      setExpandLoading(true);
      try {
        const { source, language: lang } = await getCommitSourceAction(screenId, targetHash);
        const lines = hljs.highlight(source, { language: lang }).value.split('\n');
        setExpandedLines(lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines);
      } finally {
        setExpandLoading(false);
      }
    }
    setShowSource(true);
  };

  const sourceLines = (() => {
    if (mode !== 'source' || !content) return [];
    const lines = hljs.highlight(content, { language }).value.split('\n');
    return lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
  })();

  const commitMeta = (mode === 'source' || mode === 'commit') ? commits.find((c) => c.hash === hash) : null;
  const commitA = mode === 'diff' ? commits.find((c) => c.hash === hashA) : null;
  const commitB = mode === 'diff' ? commits.find((c) => c.hash === hashB) : null;

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'source' ? '소스 보기' : mode === 'commit' ? '변경 내역' : '커밋 비교'}
      >
        <CommitBar mode={mode} commitMeta={commitMeta} commitA={commitA} commitB={commitB} hashA={hashA} hashB={hashB} />
        <DiffToolbar
          screenId={screenId} mode={mode}
          sourceLineCount={sourceLines.length} expandedLineCount={expandedLines.length}
          showSource={showSource} expandLoading={expandLoading} loading={loading}
          hasContent={!!content} copied={copied} diffViewType={diffViewType}
          closeRef={closeRef}
          onExpandSource={handleExpandSource} onCopy={handleCopy}
          onDiffViewChange={setDiffViewType} onClose={onClose}
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
          {!loading && !error && mode === 'source' && (
            sourceLines.length > 0 ? (
              <table className={styles.codeTable}>
                <tbody>
                  {sourceLines.map((line, i) => (
                    <tr key={i} className={styles.codeRow}>
                      <td className={styles.lineNum}>{i + 1}</td>
                      <td className={styles.codeLine} dangerouslySetInnerHTML={{ __html: line || ' ' }} />
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.centerWrap}>
                <Icon icon="solar:file-text-linear" width={20} height={20} />
                <span>해당 커밋에 파일이 없습니다</span>
              </div>
            )
          )}
          {(mode === 'diff' || mode === 'commit') && !showSource && (
            <div ref={diffContainerRef} className={styles.diffWrap} />
          )}
          {(mode === 'diff' || mode === 'commit') && showSource && !expandLoading && (
            expandedLines.length > 0 ? (
              <table className={styles.codeTable}>
                <tbody>
                  {expandedLines.map((line, i) => (
                    <tr key={i} className={styles.codeRow}>
                      <td className={styles.lineNum}>{i + 1}</td>
                      <td className={styles.codeLine} dangerouslySetInnerHTML={{ __html: line || ' ' }} />
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.centerWrap}>
                <Icon icon="solar:file-text-linear" width={20} height={20} />
                <span>해당 커밋에 파일이 없습니다</span>
              </div>
            )
          )}
          {(mode === 'diff' || mode === 'commit') && showSource && expandLoading && (
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
