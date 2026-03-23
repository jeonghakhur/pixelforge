'use client';

import { Icon } from '@iconify/react';
import { useUIStore } from '@/stores/useUIStore';
import styles from './ActivityBar.module.scss';

export type Section = 'home' | 'tokens' | 'components' | 'pages' | 'diff' | 'settings';

interface ActivityBarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
}

const TOP_ITEMS: { section: Section; icon: string; label: string }[] = [
  { section: 'home', icon: 'solar:home-2-linear', label: 'Home' },
];

const MID_ITEMS: { section: Section; icon: string; label: string }[] = [
  { section: 'tokens', icon: 'solar:pallete-linear', label: 'Tokens' },
  { section: 'components', icon: 'solar:widget-2-linear', label: 'Components' },
  { section: 'pages', icon: 'solar:documents-linear', label: 'Pages' },
  { section: 'diff', icon: 'solar:code-scan-linear', label: 'Diff' },
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

export default function ActivityBar({ activeSection, onSectionChange }: ActivityBarProps) {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

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
        {MID_ITEMS.map((item) => (
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
      </div>
    </aside>
  );
}
