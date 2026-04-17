'use client';

import { useState, useMemo, useEffect, useRef, useTransition, useCallback } from 'react';
import * as GeneratedIcons from '@/generated/icons';
import { Icon } from '@iconify/react';
import { deleteIcon } from '@/lib/actions/icons';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import styles from './page.module.scss';

export interface IconEntry {
  name: string;
  svg: string;
  section?: string;
}

interface IconGridProps {
  icons: IconEntry[];
  outputPath: string;
}

const STORAGE_KEY = 'pixelforge:icon-category-order';

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toUpperCase());
}

function toComponentName(figmaName: string): string {
  let name = figmaName.trim();
  if (name.includes('=')) {
    const firstProp = name.split(',')[0];
    name = firstProp.split('=')[1]?.trim() ?? name;
  }
  const segment = name.split('/').pop() ?? name;
  return toPascalCase(segment);
}

function extractCategory(icon: IconEntry): string {
  if (icon.section) return icon.section;
  const parts = icon.name.split('/');
  if (parts.length > 1) return parts.slice(0, -1).join('/');
  return icon.name.split('-')[0] || '기타';
}

type IconComponents = typeof GeneratedIcons;

function IconPreview({ componentName }: { componentName: string }) {
  const key = `Icon${componentName}` as keyof IconComponents;
  const Comp = GeneratedIcons[key] as React.ComponentType<{ width: number; height: number }> | undefined;
  if (!Comp) return <div className={styles.iconPlaceholder} />;
  return <Comp width={32} height={32} />;
}

function IconCard({
  entry,
  componentName,
  onDeleteRequest,
}: {
  entry: IconEntry;
  componentName: string;
  onDeleteRequest: (figmaName: string, componentName: string) => void;
}) {
  const [svgCopied, setSvgCopied] = useState(false);
  const [importCopied, setImportCopied] = useState(false);

  const copySvg = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(entry.svg);
    setSvgCopied(true);
    setTimeout(() => setSvgCopied(false), 1500);
  };

  const copyImport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const stmt = `import { Icon${componentName} } from '@/generated/icons';`;
    await navigator.clipboard.writeText(stmt);
    setImportCopied(true);
    setTimeout(() => setImportCopied(false), 1500);
  };

  return (
    <div className={styles.iconCard} title={`Icon${componentName}`}>
      <div className={styles.iconPreview}>
        <IconPreview componentName={componentName} />
      </div>
      <div className={styles.iconMeta}>
        <span className={styles.iconName}>{componentName}</span>
        <span className={styles.iconFigmaName}>{entry.name}</span>
      </div>
      <div className={styles.cardActions}>
        <button
          type="button"
          className={`${styles.actionBtn} ${svgCopied ? styles.success : ''}`}
          onClick={copySvg}
          title="SVG 복사"
          aria-label="SVG 복사"
        >
          <Icon icon={svgCopied ? 'solar:check-circle-linear' : 'solar:copy-linear'} width={13} height={13} />
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${importCopied ? styles.success : ''}`}
          onClick={copyImport}
          title="import 복사"
          aria-label="import 구문 복사"
        >
          <Icon icon={importCopied ? 'solar:check-circle-linear' : 'solar:code-linear'} width={13} height={13} />
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={(e) => { e.stopPropagation(); onDeleteRequest(entry.name, componentName); }}
          title="아이콘 삭제"
          aria-label="아이콘 삭제"
        >
          <Icon icon="solar:trash-bin-2-linear" width={13} height={13} />
        </button>
      </div>
    </div>
  );
}

// ── 카테고리 탭 네비게이션 ────────────────────────────────────────────

interface CategoryNavProps {
  categories: string[];
  counts: Record<string, number>;
  order: string[];
  onOrderChange: (next: string[]) => void;
  onTabClick: (category: string) => void;
}

function CategoryNav({ categories, counts, order, onOrderChange, onTabClick }: CategoryNavProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragFrom(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOver !== index) setDragOver(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragFrom === null || dragFrom === index) return;
    const next = [...order];
    const [moved] = next.splice(dragFrom, 1);
    next.splice(index, 0, moved);
    onOrderChange(next);
    setDragFrom(null);
    setDragOver(null);
  };

  const handleDragEnd = () => {
    setDragFrom(null);
    setDragOver(null);
  };

  // 탭에 없는 카테고리(신규)는 뒤에 append
  const visibleOrder = [
    ...order.filter((c) => categories.includes(c)),
    ...categories.filter((c) => !order.includes(c)),
  ];

  return (
    <nav className={styles.categoryNav} aria-label="카테고리 탭">
      {visibleOrder.map((cat, index) => {
        const isDragging = dragFrom === index;
        const isOver = dragOver === index && dragFrom !== index;
        return (
          <button
            key={cat}
            type="button"
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onTabClick(cat)}
            className={[
              styles.categoryTab,
              isDragging ? styles.categoryTabDragging : '',
              isOver ? styles.categoryTabOver : '',
            ].filter(Boolean).join(' ')}
            aria-label={`${cat} 섹션으로 이동`}
          >
            <Icon icon="solar:menu-dots-bold" width={10} height={10} className={styles.dragHandle} />
            <span className={styles.categoryTabName}>{cat}</span>
            <span className={styles.categoryTabCount}>{counts[cat] ?? 0}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────

export default function IconGrid({ icons, outputPath }: IconGridProps) {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<{ figmaName: string; componentName: string } | null>(null);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const router = useRouter();

  const entries = useMemo(() => {
    const nameCount = new Map<string, number>();
    return icons.map((icon) => {
      const base = toComponentName(icon.name);
      const count = nameCount.get(base) ?? 0;
      nameCount.set(base, count + 1);
      const componentName = count === 0 ? base : `${base}${count + 1}`;
      return { entry: icon, componentName, category: extractCategory(icon) };
    });
  }, [icons]);

  // 전체 카테고리 & 개수 (검색 필터 무관)
  const { allCategories, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      counts[e.category] = (counts[e.category] ?? 0) + 1;
    }
    return { allCategories: Object.keys(counts), categoryCounts: counts };
  }, [entries]);

  // localStorage에서 순서 초기화
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedOrder: string[] = stored ? (JSON.parse(stored) as string[]) : [];
    const merged = [
      ...storedOrder.filter((c) => allCategories.includes(c)),
      ...allCategories.filter((c) => !storedOrder.includes(c)),
    ];
    setCategoryOrder(merged);
  }, [allCategories.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOrderChange = useCallback((next: string[]) => {
    setCategoryOrder(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const handleTabClick = useCallback((category: string) => {
    const el = sectionRefs.current.get(category);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter(
      ({ entry, componentName }) =>
        entry.name.toLowerCase().includes(q) ||
        componentName.toLowerCase().includes(q),
    );
  }, [entries, query]);

  // 카테고리별 그룹 — categoryOrder 순서 반영
  const orderedGroups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    const ordered = [
      ...categoryOrder.filter((c) => map.has(c)),
      ...[...map.keys()].filter((c) => !categoryOrder.includes(c)),
    ];
    return ordered.map((c) => [c, map.get(c)!] as [string, typeof filtered]);
  }, [filtered, categoryOrder]);

  const handleDeleteOne = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      await deleteIcon(deleteTarget.figmaName, deleteTarget.componentName);
      setDeleteTarget(null);
      router.refresh();
    });
  };

  return (
    <>
      {/* 카테고리 탭 */}
      <CategoryNav
        categories={allCategories}
        counts={categoryCounts}
        order={categoryOrder}
        onOrderChange={handleOrderChange}
        onTabClick={handleTabClick}
      />

      {/* 검색 툴바 */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Icon icon="solar:magnifer-linear" width={14} height={14} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="아이콘 검색..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="아이콘 검색"
          />
        </div>
        <span className={styles.resultCount}>
          {filtered.length} / {icons.length}개
        </span>
      </div>

      {/* 섹션 목록 */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <Icon icon="solar:magnifer-linear" width={32} height={32} className={styles.emptyIcon} />
          <p>&quot;{query}&quot; 검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className={styles.categoryList}>
          {orderedGroups.map(([category, items]) => (
            <section
              key={category}
              className={styles.categorySection}
              ref={(el) => {
                if (el) sectionRefs.current.set(category, el);
                else sectionRefs.current.delete(category);
              }}
            >
              <div className={styles.categoryHeader}>
                <h2 className={styles.categoryTitle}>{category}</h2>
                <span className={styles.categoryCount}>{items.length}</span>
              </div>
              <div className={styles.grid}>
                {items.map(({ entry, componentName }) => (
                  <IconCard
                    key={entry.name}
                    entry={entry}
                    componentName={componentName}
                    onDeleteRequest={(figmaName, name) => setDeleteTarget({ figmaName, componentName: name })}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
        저장 경로: <code style={{ fontFamily: 'monospace' }}>{outputPath}</code>
      </p>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteOne}
        title="아이콘 삭제"
        message={deleteTarget ? `Icon${deleteTarget.componentName}을 삭제합니다. 생성된 파일과 DB 항목이 함께 제거됩니다.` : ''}
        confirmLabel="삭제"
        variant="destructive"
        loading={isPending}
      />
    </>
  );
}
