'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { type Section } from '@/components/layout/ActivityBar';
import { getComponentsByProject, type ComponentRow as ComponentRowFull } from '@/lib/actions/components';
import { useUIStore } from '@/stores/useUIStore';
import AddComponentModal from '@/app/(ide)/components/AddComponentModal';
import ToastContainer, { type ToastItem } from '@/components/common/Toast';
import styles from './Sidebar.module.scss';

const CATEGORY_LABEL: Record<string, string> = {
  action:     '액션',
  form:       '폼',
  navigation: '내비게이션',
  feedback:   '피드백',
};

const CATEGORY_ORDER = ['action', 'form', 'navigation', 'feedback'];

interface ComponentRow {
  id: string;
  name: string;
  category: string;
  tsx: string | null;
}

interface SidebarProps {
  activeSection: Section;
}

export default function Sidebar({ activeSection }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const componentRevision = useUIStore((s) => s.componentRevision);
  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (toast: Omit<ToastItem, 'id'>) =>
    setToasts((prev) => [...prev, { ...toast, id: crypto.randomUUID() }]);
  const removeToast = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  useEffect(() => {
    if (activeSection === 'components') {
      getComponentsByProject().then((data) =>
        setRows(data.filter((r) => r.tsx !== null) as ComponentRow[])
      );
    }
  }, [activeSection, pathname, componentRevision]);

  const handleCreated = (comp: ComponentRowFull) => {
    setRows((prev) => [...prev, { id: comp.id, name: comp.name, category: comp.category, tsx: comp.tsx }]);
    addToast({
      variant: 'success',
      title: '컴포넌트 추가 완료',
      message: `${comp.name} 컴포넌트가 성공적으로 등록되었습니다.`,
      duration: 4000,
    });
    router.push(`/components/${comp.name}`);
  };

  if (activeSection !== 'components') {
    return null;
  }

  const grouped = CATEGORY_ORDER.reduce<Record<string, ComponentRow[]>>((acc, cat) => {
    acc[cat] = rows.filter((r) => r.category === cat);
    return acc;
  }, {});

  const hasAny = rows.length > 0;

  return (
    <>
    <aside className={styles.sidebar}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>컴포넌트</span>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setAddOpen(true)}
          aria-label="컴포넌트 추가"
          title="수동으로 컴포넌트 추가"
        >
          <Icon icon="solar:add-circle-linear" width={16} height={16} />
        </button>
      </div>
      <nav className={styles.nav}>
        {!hasAny && (
          <p className={styles.emptyHint}>
            Figma 플러그인에서 컴포넌트를 전송하면 여기에 표시됩니다.
          </p>
        )}
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          return (
            <div key={cat} className={styles.categoryGroup}>
              <span className={styles.categoryTitle}>{CATEGORY_LABEL[cat] ?? cat}</span>
              {items.map((comp) => (
                <Link
                  key={comp.id}
                  href={`/components/${comp.name}`}
                  className={`${styles.navItem} ${styles.componentItem} ${pathname === `/components/${comp.name}` ? styles.active : ''}`}
                >
                  <span className={`${styles.compDot} ${styles.compDotGenerated}`} aria-hidden="true" />
                  <span className={styles.compName}>{comp.name}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
    <AddComponentModal
      isOpen={addOpen}
      onClose={() => setAddOpen(false)}
      onCreated={handleCreated}
    />
    <ToastContainer toasts={toasts} onRemove={removeToast} />
</>
  );
}
