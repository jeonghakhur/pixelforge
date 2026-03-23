'use client';

import { Icon } from '@iconify/react';
import type { FigmaPageInfo } from '@/lib/figma/api';
import { TOKEN_TYPES, ALL_TOKEN_TYPE_IDS } from '@/lib/tokens/token-types';
import type { TokenType } from '@/lib/tokens/token-types';
import styles from './page.module.scss';

export type { TokenType };

interface FrameSelectorProps {
  fileName: string;
  pages: FigmaPageInfo[];
  selectedNodeIds: string[];
  selectedTypes: TokenType[];
  onNodeIdsChange: (ids: string[]) => void;
  onTypesChange: (types: TokenType[]) => void;
}

export default function FrameSelector({
  fileName,
  pages,
  selectedNodeIds,
  selectedTypes,
  onNodeIdsChange,
  onTypesChange,
}: FrameSelectorProps) {
  const allFrameIds = pages.flatMap((p) => p.frames.map((f) => f.id));

  const toggleFrame = (id: string) => {
    if (selectedNodeIds.includes(id)) {
      onNodeIdsChange(selectedNodeIds.filter((n) => n !== id));
    } else {
      onNodeIdsChange([...selectedNodeIds, id]);
    }
  };

  const togglePage = (page: FigmaPageInfo) => {
    const pageIds = page.frames.map((f) => f.id);
    const allSelected = pageIds.every((id) => selectedNodeIds.includes(id));
    if (allSelected) {
      onNodeIdsChange(selectedNodeIds.filter((id) => !pageIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedNodeIds, ...pageIds]));
      onNodeIdsChange(merged);
    }
  };

  const toggleType = (type: TokenType) => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length === 1) {
        onTypesChange(ALL_TOKEN_TYPE_IDS);
      } else {
        onTypesChange(selectedTypes.filter((t) => t !== type));
      }
    } else {
      onTypesChange([...selectedTypes, type]);
    }
  };

  const isPageChecked = (page: FigmaPageInfo) =>
    page.frames.length > 0 && page.frames.every((f) => selectedNodeIds.includes(f.id));
  const isPageIndeterminate = (page: FigmaPageInfo) =>
    !isPageChecked(page) && page.frames.some((f) => selectedNodeIds.includes(f.id));

  const totalFrames = allFrameIds.length;
  const noFrames = totalFrames === 0;

  return (
    <div className={styles.selectorPanel}>
      {/* 파일명 */}
      <div className={styles.fileNameRow}>
        <Icon icon="solar:figma-linear" width={14} height={14} className={styles.fileIcon} />
        <span className={styles.fileName}>{fileName}</span>
      </div>

      {/* 토큰 타입 필터 */}
      <div className={styles.filterBlock}>
        <span className={styles.filterLabel}>Token Types</span>
        <div className={styles.typeChips}>
          {TOKEN_TYPES.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              className={`${styles.typeChip}${selectedTypes.includes(id) ? ` ${styles.typeChipActive}` : ''}`}
              onClick={() => toggleType(id)}
              aria-pressed={selectedTypes.includes(id)}
            >
              <Icon icon={icon} width={12} height={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 프레임 선택 */}
      <div className={styles.filterBlock}>
        <div className={styles.filterLabelRow}>
          <span className={styles.filterLabel}>Frames</span>
          {!noFrames && (
            <div className={styles.selectActions}>
              <button
                type="button"
                className={styles.selectActionBtn}
                onClick={() => onNodeIdsChange(allFrameIds)}
              >
                전체 선택
              </button>
              <span className={styles.selectActionDivider}>·</span>
              <button
                type="button"
                className={styles.selectActionBtn}
                onClick={() => onNodeIdsChange([])}
              >
                전체 해제
              </button>
            </div>
          )}
        </div>

        {noFrames ? (
          <p className={styles.noFrames}>선택 가능한 프레임이 없습니다</p>
        ) : (
          <div className={styles.frameTree}>
            {pages.map((page) => {
              if (page.frames.length === 0) return null;
              const checked = isPageChecked(page);
              const indeterminate = isPageIndeterminate(page);
              return (
                <div key={page.id} className={styles.pageGroup}>
                  <label className={styles.pageHeader}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={checked}
                      ref={(el) => { if (el) el.indeterminate = indeterminate; }}
                      onChange={() => togglePage(page)}
                      aria-label={`${page.name} 전체 선택`}
                    />
                    <Icon icon="solar:layers-linear" width={12} height={12} className={styles.pageIcon} />
                    <span className={styles.pageName}>{page.name}</span>
                    <span className={styles.pageCount}>{page.frames.length}</span>
                  </label>
                  <div className={styles.frameList}>
                    {page.frames.map((frame) => (
                      <label key={frame.id} className={styles.frameItem}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={selectedNodeIds.includes(frame.id)}
                          onChange={() => toggleFrame(frame.id)}
                          aria-label={frame.name}
                        />
                        <span className={styles.frameName}>{frame.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
