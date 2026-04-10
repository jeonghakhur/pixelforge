'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import hljs from 'highlight.js/lib/core';
import hljsTypescript from 'highlight.js/lib/languages/typescript';
import hljsJavascript from 'highlight.js/lib/languages/javascript';
import hljsScss from 'highlight.js/lib/languages/scss';
import hljsJson from 'highlight.js/lib/languages/json';
import hljsMarkdown from 'highlight.js/lib/languages/markdown';
import hljsCss from 'highlight.js/lib/languages/css';
import { html as diff2html } from 'diff2html';
import 'highlight.js/styles/github-dark.css';
import type { GitCommit } from '@/lib/screens/git-history';
import { getCommitSourceAction, getCommitDiffAction } from '@/lib/actions/screens';
import styles from './InlineCodePanel.module.scss';

hljs.registerLanguage('typescript', hljsTypescript);
hljs.registerLanguage('javascript', hljsJavascript);
hljs.registerLanguage('scss', hljsScss);
hljs.registerLanguage('json', hljsJson);
hljs.registerLanguage('markdown', hljsMarkdown);
hljs.registerLanguage('css', hljsCss);

interface InlineCodePanelProps {
  screenId: string;
  mode: 'source' | 'diff';
  hash?: string;
  hashA?: string;
  hashB?: string;
  commits: GitCommit[];
}

export default function InlineCodePanel({
  screenId,
  mode,
  hash,
  hashA,
  hashB,
  commits,
}: InlineCodePanelProps) {
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [diffViewType, setDiffViewType] = useState<'side-by-side' | 'line-by-line'>('line-by-line');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        : getCommitDiffAction(screenId, hashA!, hashB!);

    load
      .then(setContent)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }, [screenId, mode, hash, hashA, hashB]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const sourceLines =
    mode === 'source' && content
      ? hljs.highlight(content, { language }).value.split('\n')
      : [];

  const diffHtml =
    mode === 'diff' && content
      ? diff2html(content, {
          drawFileList: false,
          matching: 'lines',
          outputFormat: diffViewType,
          renderNothingWhenEmpty: false,
        } as Parameters<typeof diff2html>[1])
      : '';

  const commitMeta = mode === 'source' ? commits.find((c) => c.hash === hash) : null;
  const commitA = mode === 'diff' ? commits.find((c) => c.hash === hashA) : null;
  const commitB = mode === 'diff' ? commits.find((c) => c.hash === hashB) : null;

  return (
    <div className={styles.panel}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {mode === 'source' && commitMeta ? (
            <>
              <div className={styles.avatar}>
                {commitMeta.author.slice(0, 1).toUpperCase()}
              </div>
              <span className={styles.author}>{commitMeta.author}</span>
              <span className={styles.message}>{commitMeta.message}</span>
              <code className={styles.hashBadge}>
                <Icon icon="solar:code-square-linear" width={11} height={11} />
                {commitMeta.hash}
              </code>
              <span className={styles.date}>{commitMeta.date}</span>
            </>
          ) : mode === 'diff' ? (
            <>
              <Icon icon="solar:code-scan-linear" width={13} height={13} style={{ color: '#79c0ff', flexShrink: 0 }} />
              <span className={styles.diffLabel}>커밋 비교</span>
              <code className={styles.hashBadge}>
                <Icon icon="solar:code-square-linear" width={11} height={11} />
                {commitA?.hash ?? hashA}
              </code>
              <Icon icon="solar:arrow-right-linear" width={10} height={10} style={{ color: '#6e7681', flexShrink: 0 }} />
              <code className={styles.hashBadge}>
                <Icon icon="solar:code-square-linear" width={11} height={11} />
                {commitB?.hash ?? hashB}
              </code>
            </>
          ) : null}
        </div>
        <div className={styles.headerRight}>
          {mode === 'diff' && (
            <div className={styles.toggle}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${diffViewType === 'line-by-line' ? styles.toggleBtnActive : ''}`}
                onClick={() => setDiffViewType('line-by-line')}
              >
                Unified
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${diffViewType === 'side-by-side' ? styles.toggleBtnActive : ''}`}
                onClick={() => setDiffViewType('side-by-side')}
              >
                Split
              </button>
            </div>
          )}
          {mode === 'source' && sourceLines.length > 0 && (
            <span className={styles.lineCount}>{sourceLines.length} lines</span>
          )}
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleCopy}
            disabled={loading || !content}
          >
            <Icon
              icon={copied ? 'solar:check-circle-linear' : 'solar:copy-linear'}
              width={12}
              height={12}
            />
            {copied ? 'Copied!' : 'Raw'}
          </button>
        </div>
      </div>

      {/* 코드 영역 */}
      <div className={styles.body}>
        {loading && (
          <div className={styles.center}>
            <Icon icon="solar:refresh-linear" width={18} height={18} className={styles.spin} />
            <span>불러오는 중...</span>
          </div>
        )}

        {error && (
          <div className={`${styles.center} ${styles.error}`}>
            <Icon icon="solar:danger-circle-linear" width={18} height={18} />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && mode === 'source' && (
          sourceLines.length > 0 ? (
            <table className={styles.codeTable}>
              <tbody>
                {sourceLines.map((line, i) => (
                  // highlight.js HTML 출력 (XSS 위험 없음 — git 소스만 처리)
                  <tr key={i} className={styles.codeRow}>
                    <td className={styles.lineNum}>{i + 1}</td>
                    <td
                      className={styles.codeLine}
                      dangerouslySetInnerHTML={{ __html: line || ' ' }}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.center}>
              <Icon icon="solar:file-text-linear" width={20} height={20} />
              <span>해당 커밋에 파일이 없습니다</span>
            </div>
          )
        )}

        {!loading && !error && mode === 'diff' && (
          <div
            className={styles.diffWrap}
            // diff2html HTML 출력 (XSS 위험 없음 — git diff만 처리)
            dangerouslySetInnerHTML={{ __html: diffHtml || '<p class="gh-empty">변경 사항이 없습니다</p>' }}
          />
        )}
      </div>
    </div>
  );
}
