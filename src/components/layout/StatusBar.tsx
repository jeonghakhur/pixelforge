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
  const driftSeverity = useUIStore((s) => s.driftSeverity);
  const driftTotal = useUIStore((s) => s.driftCounts.total);
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

  const countEntries = summary ? Object.entries(summary.counts).filter(([, v]) => v > 0) : [];
  const hasTokens = countEntries.length > 0;

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
            {countEntries.map(([typeId, count], i) => (
              <span key={typeId} className={styles.stat}>
                {i > 0 && <span className={styles.separator}>&middot;</span>}
                {typeId} {count}
              </span>
            ))}
          </>
        )}
        {driftSeverity !== 'none' && driftTotal > 0 && (
          <>
            <span className={styles.separator}>&middot;</span>
            <span className={`${styles.driftIndicator} ${styles[`drift_${driftSeverity}`]}`}>
              <Icon icon="solar:radar-2-linear" width={12} height={12} />
              Drift {driftTotal}
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
