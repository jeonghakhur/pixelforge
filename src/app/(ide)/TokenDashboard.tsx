'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { useUIStore } from '@/stores/useUIStore';
import type { TokenSummary, HistoryEntry } from '@/lib/actions/tokens';
import type { TokenMenuEntry } from '@/lib/actions/token-menu';
import TokenImportTabs from '@/components/common/TokenImportTabs';
import SnapshotHistory from './SnapshotHistory';
import styles from './TokenDashboard.module.scss';

interface Props {
  summary: TokenSummary;
  tokenMenu: TokenMenuEntry[];
  histories: HistoryEntry[];
  tokenVersion: number | null;
  lastSyncedAt: string | null;
}

const TYPE_COLORS = [
  'var(--accent)',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#60a5fa',
];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function actionLabel(action: string): string {
  if (action === 'extract_tokens') return '토큰 추출';
  if (action === 'generate_component') return '컴포넌트 생성';
  return action;
}

export default function TokenDashboard({
  summary,
  tokenMenu,
  histories,
  tokenVersion,
  lastSyncedAt,
}: Props) {
  const router = useRouter();
  const setSection = useUIStore((s) => s.setSection);
  const setTab = useUIStore((s) => s.setTab);
  const [isImportOpen, setIsImportOpen] = useState(false);

  useEffect(() => {
    if (!isImportOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsImportOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isImportOpen]);

  const total = Object.values(summary.counts).reduce((a, b) => a + b, 0);

  const handleTypeClick = (type: string) => {
    setSection('tokens');
    setTab(type);
    router.push(`/tokens/${type}`);
  };

  // 도넛 세그먼트
  const RADIUS = 13;
  const CIRC = 2 * Math.PI * RADIUS;
  const segments = tokenMenu
    .filter((t) => (summary.counts[t.type] ?? 0) > 0)
    .map((t, i) => ({ ...t, count: summary.counts[t.type] ?? 0, color: TYPE_COLORS[i % TYPE_COLORS.length] }));

  let offset = 0;
  const arcs = segments.map((seg) => {
    const pct = total > 0 ? (seg.count / total) * 100 : 0;
    const arc = {
      ...seg, pct,
      dashArray: `${(pct / 100) * CIRC} ${CIRC}`,
      dashOffset: -((offset / 100) * CIRC),
    };
    offset += pct;
    return arc;
  });

  return (
    <div className={styles.canvas}>

      {/* ── Top Bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={styles.statusIndicator} />
          <span className={styles.topBarText}>System Status: Healthy</span>
          <span className={styles.topBarDivider} />
          <span className={styles.topBarMuted}>
            {lastSyncedAt
              ? `Last sync: ${formatDate(lastSyncedAt)}`
              : 'No sync yet'}
          </span>
          {tokenVersion !== null && (
            <>
              <span className={styles.topBarDivider} />
              <span className={styles.topBarMuted}>Version: v{tokenVersion}</span>
            </>
          )}
        </div>
        <div className={styles.topBarRight}>
          <button
            type="button"
            className={styles.syncBtn}
            onClick={() => setIsImportOpen(true)}
          >
            <Icon icon="solar:import-linear" width={14} height={14} />
            Import Tokens
          </button>
        </div>
      </div>

      {/* ── 페이지 타이틀 ── */}
      <div className={styles.titleArea}>
        <h1 className={styles.title}>Token Management</h1>
        <p className={styles.subtitle}>Global Design System Central Console</p>
      </div>

      {/* ── 통계 벤토 그리드 (12열) ── */}
      <div className={styles.statsGrid}>
        {/* 총합 카드 */}
        <div className={styles.totalCard}>
          <div>
            <span className={styles.totalEyebrow}>Total Active Tokens</span>
            <div className={styles.totalNum}>{total > 0 ? `${total}+` : '—'}</div>
          </div>
          <div className={styles.totalSub}>
            <Icon icon="solar:trending-up-linear" width={14} height={14} />
            <span>{segments.length}가지 타입 활성</span>
          </div>
        </div>

        {/* 타입 카드 행 */}
        <div className={styles.typeCards}>
          {tokenMenu.map((t, i) => {
            const count = summary.counts[t.type] ?? 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            const color = TYPE_COLORS[i % TYPE_COLORS.length];
            return (
              <button
                key={t.type}
                type="button"
                className={`${styles.typeCard} ${count === 0 ? styles.typeCardEmpty : ''}`}
                onClick={() => count > 0 && handleTypeClick(t.type)}
                style={{ '--tc': color } as React.CSSProperties}
              >
                <span className={styles.typeEyebrow}>{t.label}</span>
                <div className={styles.typeCount}>{count}</div>
                <div className={styles.typeBar}>
                  <div
                    className={styles.typeBarFill}
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 하단 2단 (분포 차트 + 로그) ── */}
      <div className={styles.bottomGrid}>

        {/* 토큰 분포 */}
        <div className={styles.chartCard}>
          <h2 className={styles.cardTitle}>Token Distribution</h2>

          <div className={styles.donutWrap}>
            <svg className={styles.donut} viewBox="0 0 36 36">
              <circle cx="18" cy="18" r={RADIUS} fill="transparent"
                stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              {arcs.map((arc) => (
                <circle key={arc.type} cx="18" cy="18" r={RADIUS}
                  fill="transparent" stroke={arc.color} strokeWidth="8"
                  strokeDasharray={arc.dashArray}
                  strokeDashoffset={arc.dashOffset}
                />
              ))}
            </svg>
            <div className={styles.donutCenter}>
              <span className={styles.donutPct}>{total > 0 ? '100%' : '0%'}</span>
              <span className={styles.donutLabel}>Defined</span>
            </div>
          </div>

          <ul className={styles.legend}>
            {arcs.map((arc) => (
              <li key={arc.type} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: arc.color }} />
                <span className={styles.legendName}>{arc.label}</span>
                <span className={styles.legendPct}>{arc.pct.toFixed(0)}%</span>
              </li>
            ))}
            {arcs.length === 0 && (
              <li className={styles.legendEmpty}>토큰 없음</li>
            )}
          </ul>
        </div>

        {/* 토큰 변경 이력 */}
        <SnapshotHistory />

        {/* 활동 로그 */}
        <div className={styles.logCard}>
          <div className={styles.logHeader}>
            <h2 className={styles.cardTitle}>Audit Log: Recent Changes</h2>
          </div>

          {histories.length === 0 ? (
            <div className={styles.logEmpty}>
              <Icon icon="solar:history-linear" width={22} height={22} className={styles.logEmptyIcon} />
              <p>아직 활동 기록이 없습니다</p>
            </div>
          ) : (
            <table className={styles.logTable}>
              <thead>
                <tr>
                  <th className={styles.logTh}>Action</th>
                  <th className={styles.logTh}>Summary</th>
                  <th className={styles.logTh}>Author</th>
                  <th className={styles.logTh}>Time</th>
                </tr>
              </thead>
              <tbody>
                {histories.map((h) => (
                  <tr key={h.id} className={styles.logRow}>
                    <td className={styles.logTd}>
                      <div className={styles.logAction}>
                        <span className={styles.logDot} />
                        <span className={styles.logActionText}>{actionLabel(h.action)}</span>
                      </div>
                    </td>
                    <td className={styles.logTd}>
                      <span className={styles.logMono}>{h.summary}</span>
                    </td>
                    <td className={styles.logTd}>
                      <div className={styles.logAuthor}>
                        <Icon icon="solar:user-circle-linear" width={18} height={18} className={styles.logAvatar} />
                        <span>System</span>
                      </div>
                    </td>
                    <td className={`${styles.logTd} ${styles.logTime}`}>
                      {formatRelative(h.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── JSON 임포트 모달 ── */}
      {isImportOpen && (
        <div className={styles.modalOverlay} aria-hidden="true">
          <button
            type="button"
            className={styles.modalBackdrop}
            onClick={() => setIsImportOpen(false)}
            aria-label="모달 닫기"
          />
          <div
            className={styles.modalContainer}
            role="dialog"
            aria-modal="true"
            aria-label="토큰 가져오기"
          >
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Import Tokens</span>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setIsImportOpen(false)}
                aria-label="닫기"
              >
                <Icon icon="solar:close-linear" width={16} height={16} />
              </button>
            </div>
            <TokenImportTabs
              onImportSuccess={() => {
                setIsImportOpen(false);
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
