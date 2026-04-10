// @page Screens — 화면 대시보드
'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { Icon } from '@iconify/react';
import {
  getScreenListAction,
  refreshScreenDatesAction,
  syncScreensAction,
  updateScreenStatusAction,
  updateScreenVisibilityAction,
  deleteScreenAction,
  getCurrentUserAction,
  type ScreenListItem,
  type ScreenStatus,
  type SyncResult,
} from '@/lib/actions/screens';
import ScreenTable from './ScreenTable';
import ScreenDrawer from './ScreenDrawer';
import AddScreenModal from './AddScreenModal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import styles from './page.module.scss';

const STATUS_FILTERS: { value: ScreenStatus | 'all'; label: string }[] = [
  { value: 'all',      label: '전체'     },
  { value: 'wip',      label: 'WIP'      },
  { value: 'dev-done', label: 'Dev Done' },
  { value: 'qa-ready', label: 'QA Ready' },
  { value: 'qa-done',  label: 'QA Done'  },
];

export default function ScreensPage() {
  const [screens, setScreens] = useState<ScreenListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ScreenStatus | 'all'>('all');
  const [selectedScreen, setSelectedScreen] = useState<ScreenListItem | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    Promise.all([
      getScreenListAction(),
      getCurrentUserAction(),
    ]).then(([list, user]) => {
      setScreens(list);
      if (user) {
        setIsAdmin(user.role === 'admin');
        setCurrentUserEmail(user.email);
      }
      // git 날짜 백그라운드 갱신 → 완료 후 목록 재조회
      refreshScreenDatesAction().then(() =>
        getScreenListAction().then(setScreens)
      );
    }).finally(() => setLoading(false));
  }, []);

  const handleSync = () => {
    startTransition(async () => {
      const result = await syncScreensAction();
      setSyncResult(result);
      const updated = await getScreenListAction();
      setScreens(updated);
    });
  };

  const handleStatusChange = async (id: string, status: ScreenStatus) => {
    await updateScreenStatusAction(id, status);
    setScreens((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );
    if (selectedScreen?.id === id) {
      setSelectedScreen((prev) => prev ? { ...prev, status } : null);
    }
  };

  const handleVisibilityChange = async (id: string, visible: boolean) => {
    await updateScreenVisibilityAction(id, visible);
    setScreens((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible } : s))
    );
  };

  const handleScreenUpdate = (updated: ScreenListItem) => {
    setScreens((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelectedScreen(updated);
  };

  const handleRefresh = useCallback(async () => {
    const updated = await getScreenListAction();
    setScreens(updated);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    const res = await deleteScreenAction(deleteTargetId);
    setDeleting(false);
    if (res.error) { setDeleteTargetId(null); return; }
    setScreens((prev) => prev.filter((s) => s.id !== deleteTargetId));
    setSelectedScreen((prev) => (prev?.id === deleteTargetId ? null : prev));
    setDeleteTargetId(null);
  };

  // 비관리자는 노출 화면만, 관리자는 showHidden 토글로 전체 가능
  const visibleScreens = (isAdmin && showHidden) ? screens : screens.filter((s) => s.visible);

  const statusFiltered = statusFilter === 'all'
    ? visibleScreens
    : visibleScreens.filter((s) => s.status === statusFilter);

  const filtered = searchQuery.trim()
    ? statusFiltered.filter((s) => {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.route.toLowerCase().includes(q) ||
          s.authors.some((a) => a.toLowerCase().includes(q))
        );
      })
    : statusFiltered;

  const stats = {
    total:   screens.filter((s) => s.visible).length,
    hidden:  screens.filter((s) => !s.visible).length,
    qaDone:  screens.filter((s) => s.visible && s.status === 'qa-done').length,
    devDone: screens.filter((s) => s.visible && s.status === 'dev-done').length,
    wip:     screens.filter((s) => s.visible && s.status === 'wip').length,
  };

  return (
    <div className={styles.page}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.eyebrow}>화면 관리</span>
          <h1 className={styles.title}>화면 대시보드</h1>
        </div>
        <div className={styles.headerActions}>
          {syncResult && (
            <span className={styles.syncResult}>
              +{syncResult.added} 추가 · {syncResult.updated} 업데이트{syncResult.removed > 0 ? ` · ${syncResult.removed} 삭제` : ''}
            </span>
          )}
          <button
            type="button"
            className={styles.syncBtn}
            onClick={handleSync}
            disabled={isPending}
            aria-label="화면 목록 동기화"
          >
            <Icon
              icon="solar:refresh-linear"
              width={14}
              height={14}
              className={isPending ? styles.spinning : undefined}
            />
            {isPending ? '동기화 중...' : '동기화'}
          </button>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setAddModalOpen(true)}
            aria-label="화면 추가"
          >
            <Icon icon="solar:add-circle-linear" width={14} height={14} />
            화면 추가
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
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

      {/* 필터 바 */}
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
          <div className={styles.searchWrap}>
            <Icon icon="solar:magnifer-linear" width={14} height={14} className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="화면명, 라우트, 담당자 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="화면 검색"
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setSearchQuery('')}
                aria-label="검색어 지우기"
              >
                <Icon icon="solar:close-circle-linear" width={13} height={13} />
              </button>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className={styles.filterRight}>
            <button
              type="button"
              className={`${styles.hiddenToggle} ${showHidden ? styles.hiddenToggleActive : ''}`}
              onClick={() => setShowHidden((v) => !v)}
              aria-pressed={showHidden}
            >
              <Icon
                icon={showHidden ? 'solar:eye-linear' : 'solar:eye-closed-linear'}
                width={13}
                height={13}
              />
              {showHidden ? `숨김 포함 (${stats.hidden})` : `숨김 ${stats.hidden}개`}
            </button>
          </div>
        )}
      </div>

      {/* 로딩 / 빈 상태 / 테이블 */}
      {loading ? (
        <div className={styles.loadingWrap}>
          <Icon icon="solar:refresh-linear" width={20} height={20} className={styles.spinning} />
        </div>
      ) : screens.length === 0 ? (
        <div className={styles.emptyWrap}>
          <Icon icon="solar:layers-minimalistic-linear" width={32} height={32} />
          <p>등록된 화면이 없습니다. 동기화 버튼을 눌러 주석을 스캔하세요.</p>
        </div>
      ) : (
        <ScreenTable
          screens={filtered}
          onRowClick={setSelectedScreen}
          onStatusChange={handleStatusChange}
          onVisibilityChange={handleVisibilityChange}
          onDelete={setDeleteTargetId}
          isAdmin={isAdmin}
        />
      )}

      {/* 화면 추가 모달 */}
      <AddScreenModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onCreated={(screen) => setScreens((prev) => [...prev, screen])}
      />

      {/* 화면 삭제 확인 */}
      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleDeleteConfirm}
        title="화면 삭제"
        message="이 화면을 삭제합니다. DB에서 제거되며 되돌릴 수 없습니다."
        confirmLabel="삭제"
        loading={deleting}
      />

      {/* 상세 Drawer */}
      <ScreenDrawer
        screen={selectedScreen}
        onClose={() => setSelectedScreen(null)}
        onStatusChange={handleStatusChange}
        onUpdate={handleScreenUpdate}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
