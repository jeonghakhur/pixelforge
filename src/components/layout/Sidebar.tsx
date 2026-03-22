'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@iconify/react';
import styles from './Sidebar.module.scss';

const TOKEN_TYPES = [
  { label: '색상', slug: 'color', icon: 'solar:pallete-linear' },
  { label: '타이포', slug: 'typography', icon: 'solar:text-field-linear' },
  { label: '간격', slug: 'spacing', icon: 'solar:ruler-linear' },
  { label: '반경', slug: 'radius', icon: 'solar:crop-linear' },
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
            <Icon icon="solar:stars-minimalistic-bold" className={styles.brandIcon} />
            PixelForge
          </Link>
        </div>

        <nav className={styles.nav}>
          <Link
            href="/"
            className={`${styles.navItem} ${isActive('/') ? styles.active : ''}`}
            onClick={onClose}
          >
            <Icon icon="solar:home-linear" className={styles.icon} />
            개요
          </Link>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>토큰</span>
            {TOKEN_TYPES.map((token) => (
              <Link
                key={token.slug}
                href={`/tokens/${token.slug}`}
                className={`${styles.navItem} ${styles.nested} ${isActive(`/tokens/${token.slug}`) ? styles.active : ''}`}
                onClick={onClose}
              >
                <Icon icon={token.icon} className={styles.icon} />
                {token.label}
              </Link>
            ))}
          </div>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>컴포넌트</span>
          </div>

          <Link
            href="/components/new"
            className={`${styles.navItem} ${styles.addBtn}`}
            onClick={onClose}
          >
            <Icon icon="solar:add-circle-linear" className={styles.icon} />
            컴포넌트 추가
          </Link>

          <div className={styles.section}>
            <span className={styles.sectionTitle}>히스토리</span>
          </div>
        </nav>

        <div className={styles.footer}>
          <Link href="/settings" className={styles.navItem} onClick={onClose}>
            <Icon icon="solar:settings-linear" className={styles.icon} />
            설정
          </Link>
        </div>
      </aside>
    </>
  );
}
