'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import hljs from 'highlight.js/lib/core';
import cssLang from 'highlight.js/lib/languages/css';
import 'highlight.js/styles/github-dark.css';
import { Icon } from '@iconify/react';
import {
  getCssHistoryForTypeAction,
  type CssHistoryEntry,
} from '@/lib/actions/snapshots';
import { TYPE_PREFIX } from '@/lib/tokens/css-generator';
import styles from './token-css-section.module.scss';

hljs.registerLanguage('css', cssLang);

// ── 상수 ────────────────────────────────────────────────────
const EXPAND_STEP = 14;

// ── 헬퍼 ────────────────────────────────────────────────────
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

// ── full CSS → focus/above/below 분리 ───────────────────────
interface CssSplit {
  above: string[];
  focus: string[];
  below: string[];
}

function splitFullCss(fullCss: string, prefix: string): CssSplit | null {
  const lines = fullCss.split('\n');
  const re = new RegExp(`^\\s+--${prefix}-`);

  // 해당 prefix의 첫 번째 변수 라인 찾기
  const firstVarIdx = lines.findIndex((l) => re.test(l));
  if (firstVarIdx === -1) return null;

  // 섹션 시작: 앞으로 돌아가며 `  /* ── X ── */` 주석 탐색
  let sectionStart = firstVarIdx;
  for (let i = firstVarIdx - 1; i >= 0; i--) {
    if (lines[i].trim() === '') continue;
    if (/^\s+\/\* ──/.test(lines[i])) {
      sectionStart = i;
      // 바로 위 빈 줄도 섹션에 포함
      if (sectionStart > 0 && lines[sectionStart - 1].trim() === '') {
        sectionStart--;
      }
    }
    break;
  }

  // 섹션 끝: 다음 타입 섹션 주석 또는 닫는 중괄호
  let sectionEnd = lines.length;
  for (let i = sectionStart + 2; i < lines.length; i++) {
    if (/^\s+\/\* ──/.test(lines[i]) || lines[i] === '}') {
      sectionEnd = i;
      break;
    }
  }

  return {
    above: lines.slice(0, sectionStart),
    focus: lines.slice(sectionStart, sectionEnd),
    below: lines.slice(sectionEnd),
  };
}

// ── CSS 뷰어 ────────────────────────────────────────────────
function CssPreview({
  css,
  fullCss,
  type,
}: {
  css: string;
  fullCss?: string;
  type?: string;
}) {
  const prefix = type ? (TYPE_PREFIX[type] ?? type) : null;

  const split = useMemo<CssSplit>(() => {
    if (fullCss && prefix) {
      const result = splitFullCss(fullCss, prefix);
      if (result) return result;
    }
    return { above: [], focus: css.split('\n'), below: [] };
  }, [fullCss, prefix, css]);

  const [aboveVisible, setAboveVisible] = useState(0);
  const [belowVisible, setBelowVisible] = useState(0);
  const [copied, setCopied] = useState(false);

  // 타입이 바뀌면 컨텍스트 초기화
  useEffect(() => {
    setAboveVisible(0);
    setBelowVisible(0);
  }, [type]);

  const hl = useCallback(
    (line: string) => hljs.highlight(line, { language: 'css' }).value,
    [],
  );

  const aboveHl  = useMemo(() => split.above.map(hl), [split.above, hl]);
  const focusHl  = useMemo(() => split.focus.map(hl), [split.focus, hl]);
  const belowHl  = useMemo(() => split.below.map(hl), [split.below, hl]);

  const shownAboveStart = Math.max(0, split.above.length - aboveVisible);
  const shownAbove = aboveHl.slice(shownAboveStart);
  const shownBelow = belowHl.slice(0, belowVisible);

  const focusOffset = split.above.length;
  const belowOffset = focusOffset + split.focus.length;
  const total       = split.above.length + split.focus.length + split.below.length;

  const hiddenAbove = split.above.length - aboveVisible;
  const hiddenBelow = split.below.length - belowVisible;

  const canExpandUp   = aboveVisible < split.above.length;
  const canExpandDown = belowVisible < split.below.length;

  const expandUp   = () => setAboveVisible((n) => Math.min(n + EXPAND_STEP, split.above.length));
  const expandDown = () => setBelowVisible((n) => Math.min(n + EXPAND_STEP, split.below.length));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const renderRows = (htmlLines: string[], startGlobalIdx: number, isFocus = false) =>
    htmlLines.map((html, i) => (
      <tr
        key={`${startGlobalIdx}-${i}`}
        className={`${styles.codeRow} ${isFocus ? styles.focusRow : ''}`}
      >
        <td className={styles.lineNum}>{startGlobalIdx + i + 1}</td>
        <td
          className={styles.codeLine}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html || ' ' }}
        />
      </tr>
    ));

  return (
    <div className={styles.block}>
      <div className={styles.blockHeader}>
        <span className={styles.blockTitle}>
          <Icon icon="solar:file-code-linear" width={13} height={13} />
          CSS Variables
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={styles.blockMeta}>{total} lines</span>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={handleCopy}
            aria-label={copied ? '복사 완료!' : 'CSS 복사'}
          >
            <Icon
              icon={copied ? 'solar:check-circle-linear' : 'solar:copy-linear'}
              width={12} height={12}
            />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <div className={styles.expandBtns}>
            <button
              type="button"
              className={styles.expandBtn}
              onClick={expandUp}
              disabled={!canExpandUp}
              aria-label="위 더 보기"
            >
              <Icon icon="solar:alt-arrow-up-linear" width={11} height={11} />
            </button>
            <button
              type="button"
              className={styles.expandBtn}
              onClick={expandDown}
              disabled={!canExpandDown}
              aria-label="아래 더 보기"
            >
              <Icon icon="solar:alt-arrow-down-linear" width={11} height={11} />
            </button>
          </div>
        </div>
      </div>

      <div className={styles.codeWrap}>
        <table className={styles.codeTable}>
          <tbody>
            {hiddenAbove > 0 && (
              <tr>
                <td colSpan={2} className={styles.foldCell}>
                  <Icon icon="solar:alt-arrow-up-linear" width={10} height={10} />
                  {hiddenAbove} lines hidden
                </td>
              </tr>
            )}
            {renderRows(shownAbove, shownAboveStart)}
            {renderRows(focusHl, focusOffset, true)}
            {renderRows(shownBelow, belowOffset)}
            {hiddenBelow > 0 && (
              <tr>
                <td colSpan={2} className={styles.foldCell}>
                  <Icon icon="solar:alt-arrow-down-linear" width={10} height={10} />
                  {hiddenBelow} lines hidden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 히스토리 엔트리 ─────────────────────────────────────────
function HistoryEntry({
  entry,
  defaultOpen,
}: {
  entry: CssHistoryEntry;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={styles.entry}>
      <button
        type="button"
        className={styles.entryHeader}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.entryVersion}>v{entry.version}</span>
        <span className={styles.entryDate}>{formatDate(entry.createdAt)}</span>

        <div className={styles.chips}>
          {entry.added   > 0 && <span className={`${styles.chip} ${styles.chipAdd}`}>+{entry.added}</span>}
          {entry.removed > 0 && <span className={`${styles.chip} ${styles.chipRemove}`}>-{entry.removed}</span>}
          {entry.changed > 0 && <span className={`${styles.chip} ${styles.chipChange}`}>~{entry.changed}</span>}
        </div>

        <span className={`${styles.entryToggle} ${open ? styles.open : ''}`}>
          <Icon icon="solar:alt-arrow-down-linear" width={12} height={12} />
        </span>
      </button>

      {open && (
        <table className={styles.diffTable} aria-label={`v${entry.version} 변경 내역`}>
          <tbody>
            {entry.lines.map((line, i) => (
              <tr
                key={i}
                className={`${styles.diffRow} ${line.kind === 'add' ? styles.add : styles.remove}`}
              >
                <td className={styles.diffSign}>{line.kind === 'add' ? '+' : '-'}</td>
                <td className={styles.diffLineNum}>{i + 1}</td>
                <td className={styles.diffCode}>{line.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── 히스토리 블록 ────────────────────────────────────────────
function HistoryBlock({ type }: { type: string }) {
  const [history, setHistory] = useState<CssHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCssHistoryForTypeAction(type)
      .then(setHistory)
      .finally(() => setLoading(false));
  }, [type]);

  return (
    <div className={styles.block}>
      <div className={styles.blockHeader}>
        <span className={styles.blockTitle}>
          <Icon icon="solar:clock-circle-linear" width={13} height={13} />
          변경 이력
        </span>
        {!loading && history.length > 0 && (
          <span className={styles.blockMeta}>{history.length}건</span>
        )}
      </div>

      {loading ? (
        <div className={styles.historyLoading}>
          <Icon icon="solar:refresh-linear" width={14} height={14} className={styles.spinning} />
          <span>불러오는 중…</span>
        </div>
      ) : history.length === 0 ? (
        <p className={styles.historyEmpty}>변경 이력이 없습니다.</p>
      ) : (
        <div className={styles.entryList}>
          {history.map((entry, idx) => (
            <HistoryEntry key={entry.id} entry={entry} defaultOpen={idx === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 메인 내보내기 ────────────────────────────────────────────
export default function TokenCssSection({
  type,
  initialCss,
  fullCss,
}: {
  type: string;
  initialCss: string;
  fullCss?: string;
}) {
  if (!initialCss || initialCss.trim() === '/* 토큰이 없습니다. */') return null;

  return (
    <section className={styles.section} aria-label="CSS 및 변경 이력">
      <CssPreview css={initialCss} fullCss={fullCss} type={type} />
      <HistoryBlock type={type} />
    </section>
  );
}
