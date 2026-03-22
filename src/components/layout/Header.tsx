'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';
import { useUIStore } from '@/stores/useUIStore';
import styles from './Header.module.scss';

const THEME_CYCLE = ['light', 'dark', 'system'] as const;
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

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  const cycleTheme = () => {
    const currentIdx = THEME_CYCLE.indexOf(theme);
    const nextIdx = (currentIdx + 1) % THEME_CYCLE.length;
    setTheme(THEME_CYCLE[nextIdx]);
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <button
            className={styles.menuBtn}
            onClick={onMenuToggle}
            aria-label="메뉴 토글"
            type="button"
          >
            <Icon icon="solar:hamburger-menu-linear" width={20} height={20} />
          </button>
          <Link href="/" className={styles.logo}>
            PixelForge
          </Link>
        </div>
        <nav className={styles.right}>
          <button
            className={styles.iconBtn}
            type="button"
            onClick={cycleTheme}
            aria-label={`테마 전환: ${THEME_LABELS[theme]}`}
            title={THEME_LABELS[theme]}
          >
            <Icon icon={THEME_ICONS[theme]} width={18} height={18} />
          </button>
          <button className={styles.iconBtn} type="button" aria-label="검색">
            <Icon icon="solar:magnifer-linear" width={18} height={18} />
          </button>
          <button className={styles.iconBtn} type="button" aria-label="알림">
            <Icon icon="solar:bell-linear" width={18} height={18} />
          </button>
          <Link href="/settings" className={styles.iconBtn} aria-label="설정">
            <Icon icon="solar:settings-linear" width={18} height={18} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
