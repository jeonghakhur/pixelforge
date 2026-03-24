'use client';

import { Icon } from '@iconify/react';
import type { ScreenListItem, ScreenStatus } from '@/lib/actions/screens';
import styles from './page.module.scss';

export type { ScreenListItem, ScreenStatus };

interface ScreenTableProps {
  screens: ScreenListItem[];
  onRowClick: (screen: ScreenListItem) => void;
  onStatusChange: (id: string, status: ScreenStatus) => void;
  onVisibilityChange?: (id: string, visible: boolean) => void;
  isAdmin?: boolean;
  readOnly?: boolean;
}

const STATUS_CONFIG: Record<ScreenStatus, { label: string; cls: string }> = {
  'wip':      { label: 'WIP',      cls: styles.statusWip      },
  'dev-done': { label: 'Dev Done', cls: styles.statusDevDone  },
  'qa-ready': { label: 'QA Ready', cls: styles.statusQaReady  },
  'qa-done':  { label: 'QA Done',  cls: styles.statusQaDone   },
};

const STATUS_OPTIONS: ScreenStatus[] = ['wip', 'dev-done', 'qa-ready', 'qa-done'];

function QaScore({ score, status }: { score: number | null; status: string }) {
  if (status === 'pending' || score === null) {
    return <span className={styles.qaPending}>-</span>;
  }
  const fillCls = score >= 80 ? styles.qaBarPass : score >= 50 ? styles.qaBarWarn : styles.qaBarFail;
  return (
    <div className={styles.qaScore}>
      <div className={styles.qaBar}>
        <div className={`${styles.qaBarFill} ${fillCls}`} style={{ width: `${score}%` }} />
      </div>
      <span className={styles.qaNum}>{score}</span>
    </div>
  );
}

export default function ScreenTable({
  screens,
  onRowClick,
  onStatusChange,
  onVisibilityChange,
  isAdmin = false,
  readOnly = false,
}: ScreenTableProps) {
  return (
    <div className={styles.tableWrap}>
      <div className={styles.tableInner}>
        <table className={styles.screenTable}>
          <thead>
            <tr>
              <th className={styles.colName}>화면명</th>
              <th className={styles.colRoute}>라우트</th>
              <th className={styles.colAuthors}>담당자</th>
              <th className={styles.colStatus}>검수 상태</th>
              <th className={styles.colUpdated}>최종수정</th>
              <th className={styles.colFigma}>Figma</th>
              <th className={styles.colQa}>QA 점수</th>
              {isAdmin && <th className={styles.colVisible}>노출</th>}
              <th className={styles.colAction} />
            </tr>
          </thead>
          <tbody>
            {screens.map((screen) => {
              const sc = STATUS_CONFIG[screen.status];
              return (
                <tr
                  key={screen.id}
                  onClick={() => onRowClick(screen)}
                  data-hidden={!screen.visible ? 'true' : undefined}
                >
                  {/* 화면명 */}
                  <td>
                    <div className={styles.screenName}>{screen.name}</div>
                    {screen.description && (
                      <div className={styles.screenDesc}>{screen.description}</div>
                    )}
                  </td>
                  {/* 라우트 */}
                  <td>
                    <code className={styles.routeCode}>{screen.route}</code>
                  </td>
                  {/* 담당자 */}
                  <td>
                    <div className={styles.authorList}>
                      {screen.authors.slice(0, 2).map((a) => (
                        <span key={a} className={styles.authorChip}>{a}</span>
                      ))}
                      {screen.authors.length > 2 && (
                        <span className={styles.authorMore}>+{screen.authors.length - 2}</span>
                      )}
                    </div>
                  </td>
                  {/* 검수 상태 */}
                  <td onClick={(e) => e.stopPropagation()}>
                    {readOnly ? (
                      <span className={`${styles.statusBadge} ${sc.cls}`}>{sc.label}</span>
                    ) : (
                      <select
                        className={`${styles.statusSelect} ${sc.cls}`}
                        value={screen.status}
                        onChange={(e) => onStatusChange(screen.id, e.target.value as ScreenStatus)}
                        aria-label={`${screen.name} 검수 상태`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_CONFIG[s].label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  {/* 최종수정 */}
                  <td>
                    <span className={styles.dateText}>{screen.updatedDate ?? '-'}</span>
                  </td>
                  {/* Figma 등록 여부 */}
                  <td>
                    <div
                      className={screen.figmaScreenshot ? styles.figmaRegistered : styles.figmaEmpty}
                      title={screen.figmaScreenshot ? 'Figma 원본 등록됨' : '미등록'}
                    >
                      <Icon icon="solar:figma-linear" width={13} height={13} />
                    </div>
                  </td>
                  {/* QA 점수 */}
                  <td>
                    <QaScore score={screen.playwrightScore} status={screen.playwrightStatus} />
                  </td>
                  {/* 노출 토글 — 관리자만 */}
                  {isAdmin && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`${styles.visibilityBtn} ${screen.visible ? styles.visibilityBtnOn : styles.visibilityBtnOff}`}
                        aria-label={screen.visible ? `${screen.name} 숨기기` : `${screen.name} 노출하기`}
                        title={screen.visible ? '노출 중 — 클릭하면 숨김' : '숨김 — 클릭하면 노출'}
                        onClick={() => onVisibilityChange?.(screen.id, !screen.visible)}
                      >
                        <Icon
                          icon={screen.visible ? 'solar:eye-linear' : 'solar:eye-closed-linear'}
                          width={14}
                          height={14}
                        />
                      </button>
                    </td>
                  )}
                  {/* 액션 */}
                  <td>
                    <div className={styles.rowActionGroup}>
                      <button
                        type="button"
                        className={styles.rowActionBtn}
                        aria-label={`${screen.name} 새 탭으로 열기`}
                        title={screen.route}
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(screen.route, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <Icon icon="solar:link-linear" width={13} height={13} />
                      </button>
                      <button
                        type="button"
                        className={styles.rowActionBtn}
                        aria-label={`${screen.name} 상세 보기`}
                        onClick={(e) => { e.stopPropagation(); onRowClick(screen); }}
                      >
                        <Icon icon="solar:arrow-right-linear" width={13} height={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
