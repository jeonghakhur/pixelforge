'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useUIStore } from '@/stores/useUIStore';
import { getTokenSummary, getProjectInfo, type TokenSummary } from '@/lib/actions/tokens';
import styles from './StatusBar.module.scss';

const THEME_ICONS: Record<string, string> = {
  light: 'solar:sun-2-linear',
  dark: 'solar:moon-linear',
  system: 'solar:laptop-minimalistic-linear',
};

const THEME_CYCLE = ['light', 'dark', 'system'] as const;

export default function StatusBar() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const [summary, setSummary] = useState<TokenSummary | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

  useEffect(() => {
    getTokenSummary().then(setSummary);
    getProjectInfo().then((info) => {
      if (info) setProjectName(info.name);
    });
  }, []);

  const cycleTheme = () => {
    const currentIdx = THEME_CYCLE.indexOf(theme);
    const nextIdx = (currentIdx + 1) % THEME_CYCLE.length;
    setTheme(THEME_CYCLE[nextIdx]);
  };

  const hasTokens = summary && (summary.colors + summary.typography + summary.spacing + summary.radius > 0);

  return (
    <footer className={styles.statusBar}>
      <div className={styles.left}>
        <span className={styles.brand}>PixelForge</span>
        {projectName && (
          <>
            <span className={styles.separator}>|</span>
            <span className={styles.fileName}>{projectName}</span>
          </>
        )}
      </div>
      <div className={styles.right}>
        {hasTokens && summary && (
          <>
            <span className={styles.stat}>
              색상 {summary.colors}개
            </span>
            <span className={styles.separator}>&middot;</span>
            <span className={styles.stat}>
              타이포 {summary.typography}개
            </span>
            <span className={styles.separator}>&middot;</span>
            <span className={styles.stat}>
              간격 {summary.spacing}개
            </span>
            <span className={styles.separator}>&middot;</span>
            <span className={styles.stat}>
              반경 {summary.radius}개
            </span>
          </>
        )}
        <button
          type="button"
          className={styles.themeBtn}
          onClick={cycleTheme}
          aria-label={`테마 전환: ${theme}`}
        >
          <Icon icon={THEME_ICONS[theme]} width={14} height={14} />
        </button>
      </div>
    </footer>
  );
}
