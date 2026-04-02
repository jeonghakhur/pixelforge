'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { type Section } from '@/components/layout/ActivityBar';
import { getComponentsByProject } from '@/lib/actions/components';
import styles from './Sidebar.module.scss';

const COMPONENT_CATALOG = [
  { slug: 'button',        name: 'Button',       category: 'action'     },
  { slug: 'badge',         name: 'Badge',        category: 'action'     },
  { slug: 'card',          name: 'Card',         category: 'action'     },
  { slug: 'chip',          name: 'Chip',         category: 'action'     },
  { slug: 'spinner',       name: 'Spinner',      category: 'feedback'   },
  { slug: 'modal',         name: 'Modal',        category: 'feedback'   },
  { slug: 'toast',         name: 'Toast',        category: 'feedback'   },
  { slug: 'form-group',    name: 'FormGroup',    category: 'form'       },
  { slug: 'form-select',   name: 'FormSelect',   category: 'form'       },
  { slug: 'form-check',    name: 'FormCheck',    category: 'form'       },
  { slug: 'form-textarea', name: 'FormTextarea', category: 'form'       },
  { slug: 'nav',           name: 'Nav',          category: 'navigation' },
  { slug: 'pagination',    name: 'Pagination',   category: 'navigation' },
  { slug: 'dropdown',      name: 'Dropdown',     category: 'navigation' },
] as const;

const CATEGORY_META: Record<string, { label: string }> = {
  action:     { label: '액션'       },
  form:       { label: '폼'         },
  navigation: { label: '내비게이션' },
  feedback:   { label: '피드백'     },
};

const CATEGORY_ORDER = ['action', 'form', 'navigation', 'feedback'];

interface SidebarProps {
  activeSection: Section;
}

export default function Sidebar({ activeSection }: SidebarProps) {
  const pathname = usePathname();
  const [generatedNames, setGeneratedNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeSection === 'components') {
      getComponentsByProject().then((rows) =>
        setGeneratedNames(new Set(rows.filter((r) => r.tsx !== null).map((r) => r.name)))
      );
    }
  }, [activeSection, pathname]);

  if (activeSection !== 'components') {
    return null;
  }

  return (
    <aside className={styles.sidebar}>
      {/* ── 컴포넌트 패널 ── */}
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>컴포넌트</span>
        <Link
          href="/components/new"
          className={styles.addBtn}
          aria-label="컴포넌트 생성"
          title="컴포넌트 생성"
        >
          <Icon icon="solar:add-circle-linear" width={15} height={15} />
        </Link>
      </div>
      <nav className={styles.nav}>
        {CATEGORY_ORDER.map((cat) => {
          const items = COMPONENT_CATALOG.filter((c) => c.category === cat);
          return (
            <div key={cat} className={styles.categoryGroup}>
              <span className={styles.categoryTitle}>{CATEGORY_META[cat].label}</span>
              {items.map((comp) => {
                const isGenerated = generatedNames.has(comp.name);
                return (
                  <Link
                    key={comp.slug}
                    href={`/components/${comp.slug}`}
                    className={`${styles.navItem} ${styles.componentItem} ${pathname === `/components/${comp.slug}` ? styles.active : ''}`}
                  >
                    <span
                      className={`${styles.compDot} ${isGenerated ? styles.compDotGenerated : ''}`}
                      aria-hidden="true"
                    />
                    <span className={styles.compName}>{comp.name}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
