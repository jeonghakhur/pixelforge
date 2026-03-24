'use client';

import { RefObject } from 'react';
import { Icon } from '@iconify/react';
import styles from './CodeViewModal.module.scss';

interface DiffToolbarProps {
  screenId: string;
  mode: 'source' | 'diff' | 'commit';
  sourceLineCount: number;
  expandedLineCount: number;
  showSource: boolean;
  expandLoading: boolean;
  loading: boolean;
  hasContent: boolean;
  copied: boolean;
  diffViewType: 'side-by-side' | 'line-by-line';
  closeRef: RefObject<HTMLButtonElement | null>;
  onExpandSource: () => void;
  onCopy: () => void;
  onDiffViewChange: (type: 'side-by-side' | 'line-by-line') => void;
  onClose: () => void;
}

export function DiffToolbar({
  screenId,
  mode,
  sourceLineCount,
  expandedLineCount,
  showSource,
  expandLoading,
  loading,
  hasContent,
  copied,
  diffViewType,
  closeRef,
  onExpandSource,
  onCopy,
  onDiffViewChange,
  onClose,
}: DiffToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <Icon icon="solar:file-code-linear" width={14} height={14} style={{ color: '#8b949e' }} />
        <span className={styles.toolbarFilename}>{screenId}</span>
        {mode === 'source' && sourceLineCount > 0 && (
          <span className={styles.toolbarMeta}>{sourceLineCount} lines</span>
        )}
        {showSource && expandedLineCount > 0 && (
          <span className={styles.toolbarMeta}>{expandedLineCount} lines</span>
        )}
      </div>
      <div className={styles.toolbarRight}>
        {(mode === 'diff' || mode === 'commit') && (
          <button
            type="button"
            className={`${styles.copyBtn} ${showSource ? styles.viewToggleBtnActive : ''}`}
            onClick={onExpandSource}
            disabled={expandLoading || loading}
            aria-label={showSource ? 'diff 보기' : '전체 소스 보기'}
            title={showSource ? 'Diff 보기' : '전체 소스 보기'}
          >
            <Icon
              icon={expandLoading ? 'solar:refresh-linear' : showSource ? 'solar:code-2-linear' : 'solar:maximize-square-2-linear'}
              width={13}
              height={13}
              className={expandLoading ? styles.spinning : undefined}
            />
            {showSource ? 'Diff' : 'Source'}
          </button>
        )}
        {(mode === 'diff' || mode === 'commit') && !showSource && (
          <div className={styles.viewToggle}>
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${diffViewType === 'side-by-side' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => onDiffViewChange('side-by-side')}
            >
              <Icon icon="solar:sidebar-minimalistic-linear" width={12} height={12} />
              Split
            </button>
            <button
              type="button"
              className={`${styles.viewToggleBtn} ${diffViewType === 'line-by-line' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => onDiffViewChange('line-by-line')}
            >
              <Icon icon="solar:list-linear" width={12} height={12} />
              Unified
            </button>
          </div>
        )}
        <button
          type="button"
          className={styles.copyBtn}
          onClick={onCopy}
          disabled={loading || !hasContent}
          aria-label="소스 복사"
        >
          <Icon
            icon={copied ? 'solar:check-circle-linear' : 'solar:copy-linear'}
            width={13}
            height={13}
          />
          {copied ? 'Copied!' : 'Raw'}
        </button>
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
  );
}
