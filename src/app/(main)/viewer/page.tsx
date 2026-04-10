// @page Viewer — 읽기 전용 뷰어 (로그인 불필요)
'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useUIStore } from '@/stores/useUIStore';
import EmptyState from '@/components/common/EmptyState';
import styles from './page.module.scss';

type ViewerTab = 'pages' | 'components';

export default function ViewerPage() {
  const initTheme = useUIStore((s) => s.initTheme);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const [activeTab, setActiveTab] = useState<ViewerTab>('pages');

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  const cycleTheme = () => {
    const cycle = ['light', 'dark', 'system'] as const;
    const idx = cycle.indexOf(theme);
    setTheme(cycle[(idx + 1) % cycle.length]);
  };

  const THEME_ICONS: Record<string, string> = {
    light: 'solar:sun-2-linear',
    dark: 'solar:moon-linear',
    system: 'solar:laptop-minimalistic-linear',
  };

  const TABS: { id: ViewerTab; label: string; icon: string }[] = [
    { id: 'pages', label: '화면 목록', icon: 'solar:documents-linear' },
    { id: 'components', label: '컴포넌트', icon: 'solar:widget-2-linear' },
  ];

  return (
    <div className={styles.viewer}>
      {/* Top bar */}
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <Icon icon="solar:code-square-linear" width={20} height={20} className={styles.logo} />
          <span className={styles.brand}>PixelForge</span>
          <span className={styles.badge}>Viewer</span>
        </div>
        <div className={styles.topRight}>
          <button
            type="button"
            className={styles.themeBtn}
            onClick={cycleTheme}
            aria-label="테마 전환"
          >
            <Icon icon={THEME_ICONS[theme]} width={16} height={16} />
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className={styles.tabBar} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon icon={tab.icon} width={14} height={14} />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className={styles.content}>
        {activeTab === 'pages' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>화면 목록</h2>
              <p className={styles.sectionDesc}>
                프로젝트에 등록된 화면을 확인합니다.
              </p>
            </div>
            <div className={styles.stage}>
              <div className={styles.stageInner}>
                <EmptyState
                  icon="solar:documents-linear"
                  title="등록된 화면이 없습니다"
                  description="프로젝트에 화면을 추가하면 여기에 표시됩니다."
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'components' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>컴포넌트 목록</h2>
              <p className={styles.sectionDesc}>
                생성된 컴포넌트를 확인합니다.
              </p>
            </div>
            <div className={styles.stage}>
              <div className={styles.stageInner}>
                <EmptyState
                  icon="solar:widget-2-linear"
                  title="등록된 컴포넌트가 없습니다"
                  description="컴포넌트를 생성하면 여기에 표시됩니다."
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <span>PixelForge Viewer</span>
        <span className={styles.footerDot}>&middot;</span>
        <span>읽기 전용</span>
      </footer>
    </div>
  );
}
