'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { type Section } from '@/components/layout/ActivityBar';
import { getTokenSummary, type TokenSummary } from '@/lib/actions/tokens';
import { getComponentsByProject } from '@/lib/actions/components';
import { TOKEN_TYPE_MAP, TOKEN_TYPES } from '@/lib/tokens/token-types';
import { useUIStore } from '@/stores/useUIStore';
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
  const tokenRevision = useUIStore((s) => s.tokenRevision);
  const [summary, setSummary] = useState<TokenSummary | null>(null);
  const [generatedNames, setGeneratedNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeSection === 'tokens') {
      getTokenSummary().then(setSummary);
    }
    if (activeSection === 'components') {
      getComponentsByProject().then((rows) =>
        setGeneratedNames(new Set(rows.filter((r) => r.tsx !== null).map((r) => r.name)))
      );
    }
  }, [activeSection, pathname, tokenRevision]);

  if (!(['tokens', 'components'] as const).includes(activeSection as never)) {
    return null;
  }

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
    <aside className={styles.sidebar}>
      {/* ── 토큰 패널 ── */}
      {activeSection === 'tokens' && (
        <>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>토큰</span>
          </div>
          <nav className={styles.nav}>
            {(() => {
              if (!summary) return null;
              // counts에 있는 타입 기준으로 TOKEN_TYPES 순서 유지, 없는 타입은 뒤에 추가
              const knownOrder = TOKEN_TYPES.map((t) => t.id);
              const allTypes = [
                ...knownOrder.filter((id) => (summary.counts[id] ?? 0) > 0),
                ...Object.keys(summary.counts).filter(
                  (id) => !knownOrder.includes(id) && summary.counts[id] > 0,
                ),
              ];
              return allTypes.map((typeId) => {
                const config = TOKEN_TYPE_MAP[typeId];
                const count = summary.counts[typeId] ?? 0;
                const label = config?.label ?? typeId;
                const icon = config?.icon ?? 'solar:box-linear';
                return (
                  <Link
                    key={typeId}
                    href={`/tokens/${typeId}`}
                    className={`${styles.navItem} ${pathname === `/tokens/${typeId}` ? styles.active : ''}`}
                  >
                    <Icon icon={icon} width={16} height={16} className={styles.icon} />
                    <span className={styles.navLabel}>{label}</span>
                    <span className={styles.badge}>{count}</span>
                  </Link>
                );
              });
            })()}
            {summary?.lastExtracted && (
              <span className={styles.lastSync}>
                <Icon icon="solar:clock-circle-linear" width={13} height={13} />
                {formatDate(summary.lastExtracted)}
              </span>
            )}
          </nav>
        </>
      )}

      {/* ── 화면 대시보드 패널 ── */}
      {activeSection === 'screens' && (
        <>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>화면 대시보드</span>
          </div>
          <nav className={styles.nav}>
            <Link
              href="/screens"
              className={`${styles.navItem} ${pathname === '/screens' ? styles.active : ''}`}
            >
              <Icon icon="solar:layers-minimalistic-linear" width={15} height={15} className={styles.icon} />
              <span className={styles.navLabel}>전체 화면 목록</span>
            </Link>
          </nav>
        </>
      )}

      {/* ── 컴포넌트 패널 ── */}
      {activeSection === 'components' && (
        <>
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
        </>
      )}
    </aside>
  );
}
