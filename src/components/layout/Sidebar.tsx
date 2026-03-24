'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { type Section } from '@/components/layout/ActivityBar';
import { getTokenSummary, type TokenSummary } from '@/lib/actions/tokens';
import { getComponentsByProject } from '@/lib/actions/components';
import { getProjectList, type ProjectListItem } from '@/lib/actions/project';
import { useUIStore } from '@/stores/useUIStore';
import styles from './Sidebar.module.scss';

const TOKEN_TYPES = [
  { label: '색상',   slug: 'color',      icon: 'solar:palette-linear',     key: 'colors'     as const },
  { label: '타이포', slug: 'typography', icon: 'solar:text-field-linear',  key: 'typography' as const },
  { label: '간격',   slug: 'spacing',    icon: 'solar:ruler-linear',       key: 'spacing'    as const },
  { label: '반경',   slug: 'radius',     icon: 'solar:crop-linear',        key: 'radius'     as const },
];

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
  const [projectList, setProjectList] = useState<ProjectListItem[]>([]);

  useEffect(() => {
    if (activeSection === 'tokens') {
      getTokenSummary().then(setSummary);
    }
    if (activeSection === 'components') {
      getComponentsByProject().then((rows) =>
        setGeneratedNames(new Set(rows.filter((r) => r.tsx !== null).map((r) => r.name)))
      );
    }
    if (activeSection === 'pages') {
      getProjectList().then(setProjectList);
    }
  }, [activeSection, pathname, tokenRevision]);

  const driftSeverity = useUIStore((s) => s.driftSeverity);
  const driftCounts = useUIStore((s) => s.driftCounts);
  const lastDriftCheck = useUIStore((s) => s.lastDriftCheck);

  if (!(['tokens', 'components', 'pages', 'diff'] as const).includes(activeSection as never)) {
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
            {TOKEN_TYPES.map((token) => {
              const count = summary ? summary[token.key] : 0;
              const hasTokens = count > 0;
              return (
                <Link
                  key={token.slug}
                  href={`/tokens/${token.slug}`}
                  className={`${styles.navItem} ${pathname === `/tokens/${token.slug}` ? styles.active : ''} ${!hasTokens ? styles.dimmed : ''}`}
                >
                  <Icon
                    icon={hasTokens ? token.icon : 'solar:lock-linear'}
                    width={16}
                    height={16}
                    className={styles.icon}
                  />
                  <span className={styles.navLabel}>{token.label}</span>
                  {hasTokens && <span className={styles.badge}>{count}</span>}
                </Link>
              );
            })}
            {summary?.lastExtracted && (
              <span className={styles.lastSync}>
                <Icon icon="solar:clock-circle-linear" width={13} height={13} />
                {formatDate(summary.lastExtracted)}
              </span>
            )}
          </nav>
        </>
      )}

      {/* ── Figma 파일 패널 ── */}
      {activeSection === 'pages' && (
        <>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>파일</span>
          </div>
          <nav className={styles.nav}>
            {projectList.length === 0 ? (
              <span className={styles.emptyHint}>분석된 파일 없음</span>
            ) : (
              projectList.map((project) => (
                <Link
                  key={project.id}
                  href="/pages"
                  className={`${styles.navItem} ${pathname === '/pages' ? styles.active : ''}`}
                >
                  <Icon icon="solar:figma-linear" width={15} height={15} className={styles.icon} />
                  <span className={`${styles.navLabel} ${styles.projectNavLabel}`}>{project.name}</span>
                  {project.totalTokens > 0 && (
                    <span className={styles.badge}>{project.totalTokens}</span>
                  )}
                </Link>
              ))
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

      {/* ── Diff / Drift 패널 ── */}
      {activeSection === 'diff' && (
        <>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Change Detection</span>
          </div>
          <nav className={styles.nav}>
            <Link
              href="/diff"
              className={`${styles.navItem} ${pathname === '/diff' ? styles.active : ''}`}
            >
              <Icon icon="solar:history-linear" width={15} height={15} className={styles.icon} />
              <span className={styles.navLabel}>스냅샷 히스토리</span>
            </Link>
            <div className={styles.categoryGroup}>
              <span className={styles.categoryTitle}>Drift Detection</span>
              {driftSeverity === 'none' && !lastDriftCheck && (
                <span className={styles.emptyHint}>아직 감지 실행 전</span>
              )}
              {driftSeverity === 'none' && lastDriftCheck && (
                <span className={styles.driftClean}>
                  <Icon icon="solar:check-circle-linear" width={14} height={14} />
                  동기화 완료
                </span>
              )}
              {driftSeverity !== 'none' && (
                <>
                  {driftCounts.newInFigma > 0 && (
                    <div className={styles.driftRow}>
                      <Icon icon="solar:add-circle-linear" width={14} height={14} className={styles.driftIconNew} />
                      <span className={styles.navLabel}>Figma 신규</span>
                      <span className={styles.driftCount}>{driftCounts.newInFigma}</span>
                    </div>
                  )}
                  {driftCounts.removedFromFigma > 0 && (
                    <div className={styles.driftRow}>
                      <Icon icon="solar:minus-circle-linear" width={14} height={14} className={styles.driftIconRemoved} />
                      <span className={styles.navLabel}>Figma 삭제</span>
                      <span className={styles.driftCount}>{driftCounts.removedFromFigma}</span>
                    </div>
                  )}
                  {driftCounts.valueChanged > 0 && (
                    <div className={styles.driftRow}>
                      <Icon icon="solar:pen-new-square-linear" width={14} height={14} className={styles.driftIconChanged} />
                      <span className={styles.navLabel}>값 변경</span>
                      <span className={styles.driftCount}>{driftCounts.valueChanged}</span>
                    </div>
                  )}
                </>
              )}
              {lastDriftCheck && (
                <span className={styles.lastSync}>
                  <Icon icon="solar:clock-circle-linear" width={13} height={13} />
                  {formatDate(lastDriftCheck)}
                </span>
              )}
            </div>
          </nav>
        </>
      )}
    </aside>
  );
}
