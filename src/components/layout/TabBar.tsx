'use client';

import { Icon } from '@iconify/react';
import type { Section } from './ActivityBar';
import styles from './TabBar.module.scss';

export interface TabItem {
  id: string;
  label: string;
  icon: string;
}

export interface TokenTab {
  id: string;
  label: string;
  icon: string;
  count: number;
}

const STATIC_SECTION_TABS: Partial<Record<Section, TabItem[]>> = {
  components: [
    { id: 'list', label: '목록', icon: 'solar:widget-2-linear' },
    { id: 'new', label: '+ 추가', icon: 'solar:add-circle-linear' },
  ],
  settings: [
    { id: 'general', label: '일반', icon: 'solar:settings-linear' },
    { id: 'account', label: '계정', icon: 'solar:shield-user-linear' },
    { id: 'team', label: '팀원', icon: 'solar:users-group-two-rounded-linear' },
    { id: 'figma', label: 'Figma', icon: 'solar:figma-linear' },
  ],
};

interface TabBarProps {
  section: Section;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  tokenTabs?: TokenTab[];
}

export default function TabBar({ section, activeTab, onTabChange, tokenTabs = [] }: TabBarProps) {
  if (section === 'tokens') {
    if (tokenTabs.length === 0) {
      return (
        <div className={styles.tabBar}>
          <span className={styles.empty}>Tokens</span>
        </div>
      );
    }
    return (
      <div className={styles.tabBar} role="tablist">
        {tokenTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
          >
            <Icon icon={tab.icon} width={14} height={14} />
            {tab.label}
            <span className={styles.tabCount}>{tab.count}</span>
          </button>
        ))}
      </div>
    );
  }

  const tabs: TabItem[] = STATIC_SECTION_TABS[section] ?? [];

  if (tabs.length === 0) {
    return (
      <div className={styles.tabBar}>
        <span className={styles.empty}>
          {section === 'home' && 'Welcome'}
          {section === 'diff' && 'Change Detection'}
          {section === 'admin' && 'Admin'}
          {section === 'screens' && 'Screens'}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.tabBar} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
        >
          <Icon icon={tab.icon} width={14} height={14} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
