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
    { id: 'color', label: 'Colors', icon: 'solar:pallete-linear' },
    { id: 'typography', label: 'Typography', icon: 'solar:text-field-linear' },
    { id: 'spacing', label: 'Spacing', icon: 'solar:ruler-linear' },
    { id: 'radius', label: 'Radius', icon: 'solar:crop-linear' },
  ],
  components: [
    { id: 'list', label: '목록', icon: 'solar:widget-2-linear' },
    { id: 'new', label: '+ 추가', icon: 'solar:add-circle-linear' },
  ],
  screens: [],
  diff: [],
  settings: [
    { id: 'general', label: '일반', icon: 'solar:settings-linear' },
    { id: 'account', label: '계정', icon: 'solar:shield-user-linear' },
    { id: 'team', label: '팀원', icon: 'solar:users-group-two-rounded-linear' },
    { id: 'figma', label: 'Figma', icon: 'solar:figma-linear' },
    { id: 'tokens', label: '토큰 타입', icon: 'solar:layers-minimalistic-linear' },
  ],
  admin: [],
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
          {section === 'diff' && 'Change Detection'}
          {section === 'admin' && 'Admin'}
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
