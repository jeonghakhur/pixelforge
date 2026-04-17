'use client';

import { useState, useMemo, useTransition } from 'react';
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

export default function IconGrid({ icons, outputPath }: IconGridProps) {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // 개별 삭제 다이얼로그
  const [deleteTarget, setDeleteTarget] = useState<{ figmaName: string; componentName: string } | null>(null);

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

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.toLowerCase();
    return entries.filter(
      ({ entry, componentName }) =>
        entry.name.toLowerCase().includes(q) ||
        componentName.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const cat = item.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

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

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <Icon icon="solar:magnifer-linear" width={32} height={32} className={styles.emptyIcon} />
          <p>&quot;{query}&quot; 검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className={styles.categoryList}>
          {grouped.map(([category, items]) => (
            <section key={category} className={styles.categorySection}>
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
