'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.scss';

const TOKEN_TYPES = [
  { label: '색상', slug: 'color' },
  { label: '타이포', slug: 'typography' },
  { label: '간격', slug: 'spacing' },
  { label: '반경', slug: 'radius' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {isOpen && (
        <div
          className={styles.overlay}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.brand}>
          <Link href="/" className={styles.brandLink}>
            PixelForge
          </Link>
        </div>

        <nav className={styles.nav}>
          <Link
            href="/"
            className={`${styles.navItem} ${isActive('/') ? styles.active : ''}`}
            onClick={onClose}
          >
            <span className={styles.icon}>📋</span>
            개요
          </Link>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>🎨 토큰</span>
            {TOKEN_TYPES.map((token) => (
              <Link
                key={token.slug}
                href={`/tokens/${token.slug}`}
                className={`${styles.navItem} ${styles.nested} ${isActive(`/tokens/${token.slug}`) ? styles.active : ''}`}
                onClick={onClose}
              >
                {token.label}
              </Link>
            ))}
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>🧩 컴포넌트</span>
            {/* 동적으로 등록된 컴포넌트 목록이 여기에 렌더링됨 */}
          </div>

          <Link
            href="/components/new"
            className={`${styles.navItem} ${styles.addBtn}`}
            onClick={onClose}
          >
            + 컴포넌트 추가
          </Link>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>📜 히스토리</span>
          </div>
        </nav>
      </aside>
    </>
  );
}
