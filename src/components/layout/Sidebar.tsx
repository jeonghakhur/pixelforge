'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { type Section } from '@/components/layout/ActivityBar';
import { getComponentsByProject, type ComponentRow as ComponentRowFull } from '@/lib/actions/components';
import { useUIStore } from '@/stores/useUIStore';
import AddComponentModal from '@/app/(main)/(ide)/components/AddComponentModal';
import ToastContainer, { type ToastItem } from '@/components/common/Toast';
import styles from './Sidebar.module.scss';

interface ComponentRow {
  id: string;
  name: string;
  category: string;
  tsx: string | null;
  nodePayload: string | null;
}

/** nodePayload에서 Figma 원본 경로를 추출 */
function extractFigmaPath(nodePayload: string | null): string | null {
  if (!nodePayload) return null;
  try {
    const data = JSON.parse(nodePayload) as { name?: string };
    return data.name ?? null;
  } catch {
    return null;
  }
}

/** "Buttons/Button" → { group: "Buttons", name: "Button" } */
/** "Button" → { group: "", name: "Button" } */
function splitFigmaPath(figmaPath: string | null, fallbackName: string): { group: string; name: string } {
  if (!figmaPath || !figmaPath.includes('/')) {
    return { group: '', name: fallbackName };
  }
  const segments = figmaPath.split('/');
  const name = segments.pop()!;
  return { group: segments.join('/'), name };
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
    setRows((prev) => [...prev, { id: comp.id, name: comp.name, category: comp.category, tsx: comp.tsx, nodePayload: comp.nodePayload ?? null }]);
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

  // Figma 경로 기준 그룹핑
  const grouped = rows.reduce<Record<string, Array<{ row: ComponentRow; displayName: string }>>>((acc, r) => {
    const figmaPath = extractFigmaPath(r.nodePayload);
    const { group, name } = splitFigmaPath(figmaPath, r.name);
    const key = group || '_root';
    if (!acc[key]) acc[key] = [];
    acc[key].push({ row: r, displayName: name });
    return acc;
  }, {});

  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === '_root') return 1;
    if (b === '_root') return -1;
    return a.localeCompare(b);
  });

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
        {groupKeys.map((groupKey) => {
          const items = grouped[groupKey];
          if (!items || items.length === 0) return null;
          return (
            <div key={groupKey} className={styles.categoryGroup}>
              {groupKey !== '_root' && (
                <span className={styles.categoryTitle}>{groupKey}</span>
              )}
              {items.map(({ row: comp, displayName }) => (
                <Link
                  key={comp.id}
                  href={`/components/${comp.name}`}
                  className={`${styles.navItem} ${styles.componentItem} ${pathname === `/components/${comp.name}` ? styles.active : ''}`}
                >
                  <span className={`${styles.compDot} ${styles.compDotGenerated}`} aria-hidden="true" />
                  <span className={styles.compName}>{displayName}</span>
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
