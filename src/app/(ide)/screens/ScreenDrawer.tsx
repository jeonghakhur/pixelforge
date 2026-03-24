'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import type { ScreenListItem, ScreenStatus } from '@/lib/actions/screens';
import { getFileGitLogAction, updateScreenOrderAction } from '@/lib/actions/screens';
import type { GitCommit } from '@/lib/screens/git-history';
import FigmaCompare from './FigmaCompare';
import CodeViewModal from './CodeViewModal';
import styles from './page.module.scss';

interface ScreenDrawerProps {
  screen: ScreenListItem | null;
  onClose: () => void;
  onStatusChange: (id: string, status: ScreenStatus) => Promise<void>;
  onUpdate: (updated: ScreenListItem) => void;
  onRefresh: () => Promise<void>;
}

const STATUS_OPTIONS: { value: ScreenStatus; label: string }[] = [
  { value: 'wip',      label: 'WIP'      },
  { value: 'dev-done', label: 'Dev Done' },
  { value: 'qa-ready', label: 'QA Ready' },
  { value: 'qa-done',  label: 'QA Done'  },
];

const PW_STATUS_CONFIG = {
  pass:    { icon: 'solar:check-circle-linear',  color: 'var(--success)'    },
  fail:    { icon: 'solar:close-circle-linear',  color: 'var(--danger)'     },
  skip:    { icon: 'solar:skip-next-linear',     color: 'var(--text-muted)' },
  pending: { icon: 'solar:clock-circle-linear',  color: 'var(--text-muted)' },
};

function ScoreBar({ score }: { score: number }) {
  const fillCls = score >= 80 ? styles.scorePass : score >= 50 ? styles.scoreWarn : styles.scoreFail;
  return (
    <div className={styles.scoreRow}>
      <span className={styles.scoreBig}>{score}</span>
      <div className={styles.scoreBarLg}>
        <div className={`${styles.scoreBarFill} ${fillCls}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function ScreenDrawer({ screen, onClose, onStatusChange, onUpdate, onRefresh }: ScreenDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [gitLog, setGitLog] = useState<GitCommit[]>([]);
  const [gitLoading, setGitLoading] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [orderInput, setOrderInput] = useState<string>('');
  const [orderSaving, setOrderSaving] = useState(false);
  const [modalHash, setModalHash] = useState<string | null>(null);

  useEffect(() => {
    if (!screen) return;
    closeRef.current?.focus();
  }, [screen]);

  useEffect(() => {
    if (!screen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [screen, onClose]);

  useEffect(() => {
    if (screen) {
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [screen]);

  // screen이 바뀌면 모달 상태 초기화
  useEffect(() => {
    setModalHash(null);
  }, [screen?.id]);

  useEffect(() => {
    if (!screen) { setGitLog([]); return; }
    setGitLoading(true);
    getFileGitLogAction(screen.id)
      .then(setGitLog)
      .finally(() => setGitLoading(false));
  }, [screen?.id]);

  useEffect(() => {
    setOrderInput(screen?.displayOrder ?? '');
  }, [screen?.id, screen?.displayOrder]);

  const handleCommitClick = (hash: string) => {
    setModalHash(hash);
  };

  const handleOrderSave = async () => {
    if (!screen) return;
    const input = orderInput.trim();
    if (input !== '' && !/^\d+(-\d+)?$/.test(input)) return;
    setOrderSaving(true);
    const { assigned } = await updateScreenOrderAction(screen.id, input || null);
    setOrderInput(assigned ?? '');
    onUpdate({ ...screen, displayOrder: assigned });
    await onRefresh();
    setOrderSaving(false);
  };

  if (!screen) return null;

  const pwCfg = PW_STATUS_CONFIG[screen.playwrightStatus];

  // 좁은/넓은 모드 공통 본문 콘텐츠
  const drawerBodyContent = (
    <>
      {/* 메타 정보 */}
      <div className={styles.drawerMeta}>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>라우트</span>
          <span className={styles.metaVal}>
            <code className={styles.metaRoute}>{screen.route}</code>
          </span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>상태</span>
          <span className={styles.metaVal}>
            <select
              className={styles.statusSelect}
              value={screen.status}
              onChange={(e) => onStatusChange(screen.id, e.target.value as ScreenStatus)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </span>
        </div>
        {screen.authors.length > 0 && (
          <div className={styles.metaRow}>
            <span className={styles.metaKey}>담당자</span>
            <span className={styles.metaVal}>
              <div className={styles.authorList}>
                {screen.authors.map((a) => (
                  <span key={a} className={styles.authorChip}>{a}</span>
                ))}
              </div>
            </span>
          </div>
        )}
        {screen.sinceDate && (
          <div className={styles.metaRow}>
            <span className={styles.metaKey}>시작일</span>
            <span className={styles.metaVal}>
              <span className={styles.dateText}>{screen.sinceDate}</span>
            </span>
          </div>
        )}
        {screen.updatedDate && (
          <div className={styles.metaRow}>
            <span className={styles.metaKey}>최종수정</span>
            <span className={styles.metaVal}>
              <span className={styles.dateText}>{screen.updatedDate}</span>
            </span>
          </div>
        )}
        {screen.category && (
          <div className={styles.metaRow}>
            <span className={styles.metaKey}>카테고리</span>
            <span className={styles.metaVal}>
              <span className={styles.authorChip}>{screen.category}</span>
            </span>
          </div>
        )}
        <div className={styles.metaRow}>
          <span className={styles.metaKey}>노출 순위</span>
          <span className={styles.metaVal}>
            <div className={styles.orderInputGroup}>
              <input
                type="text"
                inputMode="numeric"
                className={styles.orderInput}
                placeholder="예: 1, 2-1"
                value={orderInput}
                onChange={(e) => setOrderInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleOrderSave(); }}
                aria-label="노출 순위"
              />
              <button
                type="button"
                className={styles.orderSaveBtn}
                onClick={handleOrderSave}
                disabled={orderSaving}
              >
                {orderSaving
                  ? <Icon icon="solar:refresh-linear" width={12} height={12} className={styles.spinning} />
                  : <Icon icon="solar:check-circle-linear" width={12} height={12} />}
                저장
              </button>
            </div>
          </span>
        </div>
        {screen.reviewedBy && (
          <div className={styles.metaRow}>
            <span className={styles.metaKey}>검수자</span>
            <span className={styles.metaVal}>
              <div className={styles.reviewerInfo}>
                <Icon icon="solar:user-check-linear" width={13} height={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span className={styles.reviewerEmail}>{screen.reviewedBy}</span>
                {screen.reviewedAt && (
                  <span className={styles.reviewerDate}>{screen.reviewedAt}</span>
                )}
              </div>
            </span>
          </div>
        )}
      </div>

      {/* Figma 비교 */}
      <FigmaCompare
        screenId={screen.id}
        figmaUrl={screen.figmaUrl}
        figmaScreenshot={screen.figmaScreenshot}
        implScreenshot={screen.implScreenshot}
        onCaptured={(path) => onUpdate({ ...screen, figmaScreenshot: path })}
        onUrlSaved={(url) => onUpdate({ ...screen, figmaUrl: url })}
        isWide={isWide}
      />

      {/* Playwright 섹션 */}
      <div className={styles.playwrightSection}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Icon icon={pwCfg.icon} width={16} height={16} style={{ color: pwCfg.color }} />
          <p className={styles.sectionTitle} style={{ margin: 0 }}>Playwright 검수</p>
        </div>
        {screen.playwrightStatus === 'pending' ? (
          <div className={styles.pwPending}>
            <Icon icon="solar:play-stream-linear" width={24} height={24} />
            <span className={styles.pwPendingText}>아직 검수가 실행되지 않았습니다</span>
            <button type="button" className={styles.pwBtn}>
              <Icon icon="solar:play-bold" width={13} height={13} />
              spec 생성 후 실행
            </button>
          </div>
        ) : (
          <>
            {screen.playwrightScore !== null && <ScoreBar score={screen.playwrightScore} />}
            <div className={styles.playwrightActions}>
              <button type="button" className={styles.pwBtn}>
                <Icon icon="solar:document-text-linear" width={13} height={13} />
                spec 보기
              </button>
              <button type="button" className={styles.pwBtn}>
                <Icon icon="solar:play-bold" width={13} height={13} />
                재실행
              </button>
              <button type="button" className={styles.pwBtn}>
                <Icon icon="solar:chart-linear" width={13} height={13} />
                결과 리포트
              </button>
            </div>
          </>
        )}
      </div>

      {/* Git 수정 이력 */}
      <div className={styles.gitSection}>
        <div className={styles.gitSectionHeader}>
          <Icon icon="solar:code-square-linear" width={15} height={15} style={{ color: 'var(--text-muted)' }} />
          <p className={styles.sectionTitle} style={{ margin: 0 }}>수정 이력</p>
        </div>
        {gitLoading ? (
          <div className={styles.gitLoading}>
            <Icon icon="solar:refresh-linear" width={14} height={14} className={styles.spinning} />
            <span>불러오는 중...</span>
          </div>
        ) : gitLog.length === 0 ? (
          <div className={styles.gitEmpty}>
            <Icon icon="solar:history-linear" width={20} height={20} />
            <span>커밋 이력이 없습니다</span>
          </div>
        ) : (
          <ol className={styles.gitTimeline}>
            {gitLog.map((commit, i) => (
              <li key={commit.hash} className={styles.gitCommit}>
                <div className={styles.gitDot} data-first={i === 0 ? 'true' : undefined} />
                <button
                  type="button"
                  className={styles.gitCommitBtn}
                  onClick={() => handleCommitClick(commit.hash)}
                >
                  <div className={styles.gitCommitMeta}>
                    <code className={styles.gitHash}>{commit.hash}</code>
                    <span className={styles.gitDate}>{commit.date}</span>
                    <span className={styles.gitAuthor}>{commit.author}</span>
                  </div>
                  <p className={styles.gitMessage}>{commit.message}</p>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );

  return createPortal(
    <>
      <div className={styles.drawerOverlay} onClick={onClose} aria-hidden="true" />
      <aside
        className={`${styles.drawer}${isWide ? ` ${styles.drawerWide}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${screen.name} 상세`}
      >
        {/* 헤더 */}
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitleGroup}>
            <Icon
              icon="solar:layers-minimalistic-linear"
              width={18}
              height={18}
              style={{ color: 'var(--accent)', flexShrink: 0 }}
            />
            <span className={styles.drawerTitle}>{screen.name}</span>
          </div>
          <div className={styles.drawerHeaderActions}>
            <button
              type="button"
              className={styles.drawerCloseBtn}
              onClick={() => setIsWide((w) => !w)}
              aria-label={isWide ? '좁게 보기' : '넓게 보기'}
              title={isWide ? '좁게 보기' : '넓게 보기'}
            >
              <Icon
                icon={isWide ? 'solar:arrow-right-linear' : 'solar:arrow-left-linear'}
                width={16}
                height={16}
              />
            </button>
            <button
              ref={closeRef}
              type="button"
              className={styles.drawerCloseBtn}
              onClick={onClose}
              aria-label="닫기"
            >
              <Icon icon="solar:close-circle-linear" width={16} height={16} />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className={styles.drawerBody}>
          {drawerBodyContent}
        </div>
      </aside>

      {/* 커밋 변경 내역 모달 */}
      {modalHash && (
        <CodeViewModal
          screenId={screen.id}
          mode="commit"
          hash={modalHash}
          commits={gitLog}
          onClose={() => setModalHash(null)}
        />
      )}
    </>,
    document.body,
  );
}
