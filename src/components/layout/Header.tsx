'use client';

import Link from 'next/link';
import styles from './Header.module.scss';

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button
          className={styles.menuBtn}
          onClick={onMenuToggle}
          aria-label="메뉴 토글"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <Link href="/" className={styles.logo}>
          PixelForge
        </Link>
      </div>
      <nav className={styles.right}>
        <Link href="/settings" className={styles.settingsBtn} aria-label="설정">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16.17 12.5a1.39 1.39 0 00.28 1.53l.05.05a1.69 1.69 0 11-2.39 2.39l-.05-.05a1.39 1.39 0 00-1.53-.28 1.39 1.39 0 00-.84 1.27v.14a1.69 1.69 0 11-3.38 0v-.07a1.39 1.39 0 00-.91-1.27 1.39 1.39 0 00-1.53.28l-.05.05a1.69 1.69 0 11-2.39-2.39l.05-.05a1.39 1.39 0 00.28-1.53 1.39 1.39 0 00-1.27-.84h-.14a1.69 1.69 0 110-3.38h.07a1.39 1.39 0 001.27-.91 1.39 1.39 0 00-.28-1.53l-.05-.05a1.69 1.69 0 112.39-2.39l.05.05a1.39 1.39 0 001.53.28h.07a1.39 1.39 0 00.84-1.27v-.14a1.69 1.69 0 113.38 0v.07a1.39 1.39 0 00.84 1.27 1.39 1.39 0 001.53-.28l.05-.05a1.69 1.69 0 112.39 2.39l-.05.05a1.39 1.39 0 00-.28 1.53v.07a1.39 1.39 0 001.27.84h.14a1.69 1.69 0 110 3.38h-.07a1.39 1.39 0 00-1.27.84z" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </Link>
      </nav>
    </header>
  );
}
