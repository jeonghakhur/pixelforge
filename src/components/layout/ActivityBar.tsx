'use client';

import { Icon } from '@iconify/react';
import { useUIStore } from '@/stores/useUIStore';
import { logout } from '@/lib/actions/auth';
import styles from './ActivityBar.module.scss';

export type Section = 'home' | 'tokens' | 'components' | 'pages' | 'screens' | 'diff' | 'settings' | 'admin';

interface ActivityBarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  userRole: 'admin' | 'member';
}

const TOP_ITEMS: { section: Section; icon: string; label: string }[] = [
  { section: 'home', icon: 'solar:home-2-linear', label: 'Home' },
];

const MID_ITEMS: { section: Section; icon: string; label: string }[] = [
  { section: 'tokens', icon: 'solar:palette-linear', label: 'Tokens' },
  { section: 'components', icon: 'solar:widget-2-linear', label: 'Components' },
  { section: 'pages',   icon: 'solar:documents-linear',             label: 'Pages'   },
  { section: 'screens', icon: 'solar:layers-minimalistic-linear',   label: 'Screens' },
  { section: 'diff',    icon: 'solar:code-scan-linear',             label: 'Diff'    },
];

const BOTTOM_ITEMS: { section: Section; icon: string; label: string }[] = [
  { section: 'settings', icon: 'solar:settings-linear', label: 'Settings' },
];

const THEME_ICONS: Record<string, string> = {
  light: 'solar:sun-2-linear',
  dark: 'solar:moon-linear',
  system: 'solar:laptop-minimalistic-linear',
};

const THEME_LABELS: Record<string, string> = {
  light: '라이트 모드',
  dark: '다크 모드',
  system: '시스템 설정',
};

const THEME_CYCLE = ['light', 'dark', 'system'] as const;

export default function ActivityBar({ activeSection, onSectionChange, userRole }: ActivityBarProps) {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const driftSeverity = useUIStore((s) => s.driftSeverity);
  const driftTotal = useUIStore((s) => s.driftCounts.total);

  const cycleTheme = () => {
    const currentIdx = THEME_CYCLE.indexOf(theme);
    const nextIdx = (currentIdx + 1) % THEME_CYCLE.length;
    setTheme(THEME_CYCLE[nextIdx]);
  };

  return (
    <aside className={styles.activityBar} aria-label="Activity Bar">
      <div className={styles.topGroup}>
        {TOP_ITEMS.map((item) => (
          <button
            key={item.section}
            type="button"
            className={`${styles.iconBtn} ${activeSection === item.section ? styles.active : ''}`}
            onClick={() => onSectionChange(item.section)}
            aria-label={item.label}
            aria-current={activeSection === item.section ? 'page' : undefined}
          >
            <Icon icon={item.icon} width={20} height={20} />
            <span className={styles.tooltip}>{item.label}</span>
          </button>
        ))}
        <div className={styles.separator} />
        {MID_ITEMS.map((item) => {
          const showDriftBadge = item.section === 'diff' && driftSeverity !== 'none' && driftTotal > 0;
          return (
            <button
              key={item.section}
              type="button"
              className={`${styles.iconBtn} ${activeSection === item.section ? styles.active : ''}`}
              onClick={() => onSectionChange(item.section)}
              aria-label={showDriftBadge ? `${item.label} (${driftTotal}건 drift)` : item.label}
              aria-current={activeSection === item.section ? 'page' : undefined}
            >
              <Icon icon={item.icon} width={20} height={20} />
              {showDriftBadge && (
                <span className={`${styles.driftBadge} ${styles[`drift_${driftSeverity}`]}`}>
                  {driftTotal > 99 ? '99+' : driftTotal}
                </span>
              )}
              <span className={styles.tooltip}>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.bottomGroup}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={cycleTheme}
          aria-label={`테마 전환: ${THEME_LABELS[theme]}`}
          title={THEME_LABELS[theme]}
        >
          <Icon icon={THEME_ICONS[theme]} width={20} height={20} />
          <span className={styles.tooltip}>{THEME_LABELS[theme]}</span>
        </button>
        <div className={styles.separator} />
        {BOTTOM_ITEMS.map((item) => (
          <button
            key={item.section}
            type="button"
            className={`${styles.iconBtn} ${activeSection === item.section ? styles.active : ''}`}
            onClick={() => onSectionChange(item.section)}
            aria-label={item.label}
            aria-current={activeSection === item.section ? 'page' : undefined}
          >
            <Icon icon={item.icon} width={20} height={20} />
            <span className={styles.tooltip}>{item.label}</span>
          </button>
        ))}
        {userRole === 'admin' && (
          <button
            type="button"
            className={`${styles.iconBtn} ${activeSection === 'admin' ? styles.active : ''}`}
            onClick={() => onSectionChange('admin')}
            aria-label="관리자"
            aria-current={activeSection === 'admin' ? 'page' : undefined}
          >
            <Icon icon="solar:shield-user-linear" width={20} height={20} />
            <span className={styles.tooltip}>관리자</span>
          </button>
        )}
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.logoutBtn}`}
          onClick={() => logout()}
          aria-label="로그아웃"
        >
          <Icon icon="solar:logout-3-linear" width={20} height={20} />
          <span className={styles.tooltip}>로그아웃</span>
        </button>
      </div>
    </aside>
  );
}
