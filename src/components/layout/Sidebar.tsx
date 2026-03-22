'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { getTokenSummary, type TokenSummary } from '@/lib/actions/tokens';
import styles from './Sidebar.module.scss';

const TOKEN_TYPES = [
  { label: '색상', slug: 'color', icon: 'solar:pallete-linear', key: 'colors' as const },
  { label: '타이포', slug: 'typography', icon: 'solar:text-field-linear', key: 'typography' as const },
  { label: '간격', slug: 'spacing', icon: 'solar:ruler-linear', key: 'spacing' as const },
  { label: '반경', slug: 'radius', icon: 'solar:crop-linear', key: 'radius' as const },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [summary, setSummary] = useState<TokenSummary | null>(null);

  useEffect(() => {
    getTokenSummary().then(setSummary);
  }, [pathname]);

  const isActive = (href: string) => pathname === href;

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return null;
    }
  };

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
            {TOKEN_TYPES.map((token) => {
              const count = summary ? summary[token.key] : 0;
              const hasTokens = count > 0;

              return (
                <Link
                  key={token.slug}
                  href={`/tokens/${token.slug}`}
                  className={`${styles.navItem} ${styles.nested} ${isActive(`/tokens/${token.slug}`) ? styles.active : ''} ${!hasTokens ? styles.dimmed : ''}`}
                  onClick={onClose}
                >
                  <Icon icon={hasTokens ? token.icon : 'solar:lock-linear'} className={styles.icon} />
                  <span>{token.label}</span>
                  {hasTokens && (
                    <span className={styles.badge}>{count}</span>
                  )}
                </Link>
              );
            })}
            {summary?.lastExtracted && (
              <span className={styles.lastSync}>
                <Icon icon="solar:clock-circle-linear" width={12} height={12} />
                {formatDate(summary.lastExtracted)}
              </span>
            )}
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
