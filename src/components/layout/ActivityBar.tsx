'use client';

import { Icon } from '@iconify/react';
import styles from './ActivityBar.module.scss';

export type Section = 'home' | 'tokens' | 'components' | 'settings';

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
];

const BOTTOM_ITEMS: { section: Section; icon: string; label: string }[] = [
  { section: 'settings', icon: 'solar:settings-linear', label: 'Settings' },
];

export default function ActivityBar({ activeSection, onSectionChange }: ActivityBarProps) {
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
