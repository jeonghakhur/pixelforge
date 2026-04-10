// @page Screens View — 화면 목록 공유 뷰
'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import {
  getPublicScreenListAction,
  type ScreenListItem,
  type ScreenStatus,
} from '@/lib/actions/screens';
import styles from '../page.module.scss';
import viewStyles from './page.module.scss';

const STATUS_FILTERS: { value: ScreenStatus | 'all'; label: string }[] = [
  { value: 'all',      label: '전체'     },
  { value: 'wip',      label: 'WIP'      },
  { value: 'dev-done', label: 'Dev Done' },
  { value: 'qa-ready', label: 'QA Ready' },
  { value: 'qa-done',  label: 'QA Done'  },
];

const STATUS_CONFIG: Record<ScreenStatus, { label: string; cls: string }> = {
  'wip':      { label: 'WIP',      cls: styles.statusWip      },
  'dev-done': { label: 'Dev Done', cls: styles.statusDevDone  },
  'qa-ready': { label: 'QA Ready', cls: styles.statusQaReady  },
  'qa-done':  { label: 'QA Done',  cls: styles.statusQaDone   },
};

export default function ScreensViewPage() {
  const [screens, setScreens] = useState<ScreenListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ScreenStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getPublicScreenListAction().then(setScreens).finally(() => setLoading(false));
  }, []);

  const filtered = screens.filter((s) => {
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.route.includes(search);
    return matchStatus && matchSearch;
  });

  const stats = {
    total:   screens.length,
    qaDone:  screens.filter((s) => s.status === 'qa-done').length,
    devDone: screens.filter((s) => s.status === 'dev-done').length,
    wip:     screens.filter((s) => s.status === 'wip').length,
  };

  return (
    <div className={styles.page}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.eyebrow}>화면 목록</span>
          <h1 className={styles.title}>구현 현황</h1>
        </div>
        <div className={styles.headerActions}>
          <a
            href="/screens"
            className={viewStyles.adminLink}
          >
            <Icon icon="solar:settings-linear" width={13} height={13} />
            관리자 뷰
          </a>
        </div>
      </div>

      {/* 통계 */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statCardInner}>
            <div className={`${styles.statIconWrap} ${styles.statIconWrapAccent}`}>
              <Icon icon="solar:layers-minimalistic-linear" width={18} height={18} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statCount}>{stats.total}</span>
              <span className={styles.statLabel}>전체 화면</span>
            </div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardInner}>
            <div className={`${styles.statIconWrap} ${styles.statIconWrapSuccess}`}>
              <Icon icon="solar:check-circle-linear" width={18} height={18} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statCount}>{stats.qaDone}</span>
              <span className={styles.statLabel}>QA 완료</span>
            </div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardInner}>
            <div className={`${styles.statIconWrap} ${styles.statIconWrapInfo}`}>
              <Icon icon="solar:code-linear" width={18} height={18} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statCount}>{stats.devDone}</span>
              <span className={styles.statLabel}>개발 완료</span>
            </div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardInner}>
            <div className={`${styles.statIconWrap} ${styles.statIconWrapMuted}`}>
              <Icon icon="solar:pen-new-square-linear" width={18} height={18} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statCount}>{stats.wip}</span>
              <span className={styles.statLabel}>작업 중</span>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 + 검색 */}
      <div className={styles.filterBar}>
        <div className={styles.filterLeft}>
          <span className={styles.filterLabel}>상태</span>
          <div className={styles.statusChips}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`${styles.statusChip} ${statusFilter === f.value ? styles.statusChipActive : ''}`}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.filterRight}>
          <div className={viewStyles.searchWrap}>
            <Icon icon="solar:magnifer-linear" width={13} height={13} className={viewStyles.searchIcon} />
            <input
              type="search"
              className={viewStyles.searchInput}
              placeholder="화면명 또는 라우트 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="화면 검색"
            />
          </div>
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className={styles.loadingWrap}>
          <Icon icon="solar:refresh-linear" width={20} height={20} className={styles.spinning} />
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyWrap}>
          <Icon icon="solar:layers-minimalistic-linear" width={32} height={32} />
          <p>조건에 맞는 화면이 없습니다.</p>
        </div>
      ) : (
        <div className={viewStyles.cardGrid}>
          {filtered.map((screen) => {
            const sc = STATUS_CONFIG[screen.status];
            return (
              <div key={screen.id} className={viewStyles.card}>
                <div className={viewStyles.cardInner}>
                  {/* Figma 썸네일 */}
                  <div className={viewStyles.cardThumb}>
                    {screen.figmaScreenshot ? (
                      <img src={screen.figmaScreenshot} alt={`${screen.name} Figma`} />
                    ) : (
                      <div className={viewStyles.cardThumbEmpty}>
                        <Icon icon="solar:image-linear" width={20} height={20} />
                      </div>
                    )}
                  </div>

                  {/* 카드 콘텐츠 */}
                  <div className={viewStyles.cardContent}>
                    <div className={viewStyles.cardHeader}>
                      <span className={`${styles.statusBadge} ${sc.cls}`}>{sc.label}</span>
                      <a
                        href={screen.route}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={viewStyles.cardOpenBtn}
                        aria-label={`${screen.name} 새 탭으로 열기`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Icon icon="solar:arrow-up-right-linear" width={12} height={12} />
                      </a>
                    </div>

                    <p className={viewStyles.cardName}>{screen.name}</p>
                    {screen.description && (
                      <p className={viewStyles.cardDesc}>{screen.description}</p>
                    )}

                    <div className={viewStyles.cardMeta}>
                      <code className={viewStyles.cardRoute}>{screen.route}</code>
                      {screen.reviewedBy && (
                        <span className={viewStyles.cardReviewer}>
                          <Icon icon="solar:user-check-linear" width={11} height={11} />
                          {screen.reviewedBy.split('@')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
