'use client';

import Link from 'next/link';
import { Icon } from '@iconify/react';
import styles from './Header.module.scss';

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
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
