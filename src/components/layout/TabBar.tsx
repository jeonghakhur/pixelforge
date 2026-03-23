'use client';

import { Icon } from '@iconify/react';
import type { Section } from './ActivityBar';
import styles from './TabBar.module.scss';

export interface TabItem {
  id: string;
  label: string;
  icon: string;
}

const SECTION_TABS: Record<Section, TabItem[]> = {
  home: [],
  tokens: [
    { id: 'color', label: '색상', icon: 'solar:pallete-linear' },
    { id: 'typography', label: '타이포', icon: 'solar:text-field-linear' },
    { id: 'spacing', label: '간격', icon: 'solar:ruler-linear' },
    { id: 'radius', label: '반경', icon: 'solar:crop-linear' },
  ],
  components: [
    { id: 'list', label: '목록', icon: 'solar:widget-2-linear' },
    { id: 'new', label: '+ 추가', icon: 'solar:add-circle-linear' },
  ],
  pages: [],
  diff: [],
  settings: [
    { id: 'general', label: '일반', icon: 'solar:settings-linear' },
    { id: 'team', label: '팀원', icon: 'solar:users-group-two-rounded-linear' },
    { id: 'figma', label: 'Figma', icon: 'solar:figma-linear' },
  ],
};

interface TabBarProps {
  section: Section;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function TabBar({ section, activeTab, onTabChange }: TabBarProps) {
  const tabs = SECTION_TABS[section];

  if (tabs.length === 0) {
    return (
      <div className={styles.tabBar}>
        <span className={styles.empty}>
          {section === 'home' && 'Welcome'}
          {section === 'pages' && 'Pages'}
          {section === 'diff' && 'Change Detection'}
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
          <Icon icon={tab.icon} className={styles.tabIcon} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
