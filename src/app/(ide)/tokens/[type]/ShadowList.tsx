'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import type { TokenRow } from '@/lib/actions/tokens';
import { deleteTokenAction } from '@/lib/actions/tokens';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/stores/useUIStore';
import styles from './token-views.module.scss';

interface ShadowLayer {
  type: string;
  offsetX: number;
  offsetY: number;
  radius: number;
  spread: number;
  color: { r: number; g: number; b: number; a: number };
}

function parseLayers(value: string): ShadowLayer[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as ShadowLayer[]) : [];
  } catch {
    return [];
  }
}

function toCssColor(c: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${Math.round(c.a * 100) / 100})`;
}

function displayName(fullName: string): string {
  const slash = fullName.lastIndexOf('/');
  return slash >= 0 ? fullName.slice(slash + 1) : fullName;
}

function groupTokens(tokens: TokenRow[]): [string, TokenRow[]][] {
  const map = new Map<string, TokenRow[]>();
  for (const token of tokens) {
    const slash = token.name.indexOf('/');
    const group = slash >= 0 ? token.name.slice(0, slash) : '';
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(token);
  }
  return Array.from(map.entries());
}

export default function ShadowList({ tokens: initial }: { tokens: TokenRow[] }) {
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const [tokens, setTokens] = useState<TokenRow[]>(initial);
  const [deleteTarget, setDeleteTarget] = useState<TokenRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const groups = groupTokens(tokens);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteTokenAction(deleteTarget.id);
    setDeleting(false);
    if (!error) {
      setTokens((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      invalidateTokens();
    }
    setDeleteTarget(null);
  };

  const renderCard = (token: TokenRow) => {
    const layers = parseLayers(token.value);
    const boxShadow = token.raw ?? layers.map((l) => {
      const inset = l.type === 'INNER_SHADOW' ? 'inset ' : '';
      return `${inset}${l.offsetX}px ${l.offsetY}px ${l.radius}px ${l.spread}px ${toCssColor(l.color)}`;
    }).join(', ');

    return (
      <div key={token.id} className={styles.shadowCard}>
        <div className={styles.shadowPreview} style={{ boxShadow }} />
        <div className={styles.shadowMeta}>
          <div className={styles.shadowNameRow}>
            <span className={styles.shadowName}>{displayName(token.name)}</span>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
              onClick={() => setDeleteTarget(token)}
              aria-label="삭제"
            >
              <Icon icon="solar:trash-bin-2-linear" width={13} height={13} />
            </button>
          </div>
          <div className={styles.shadowLayers}>
            {layers.map((l, i) => (
              <span key={i} className={styles.shadowLayerBadge}>
                {l.type === 'INNER_SHADOW' ? 'inset' : 'drop'} · blur {l.radius}px
              </span>
            ))}
            {layers.length === 0 && (
              <span className={styles.shadowRaw}>{boxShadow}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const isFlat = groups.length === 1 && groups[0][0] === '';

  return (
    <>
      {isFlat ? (
        <div className={styles.shadowGrid}>
          {tokens.map(renderCard)}
        </div>
      ) : (
        <div className={styles.colorGroups}>
          {groups.map(([group, groupTokens]) => (
            <section key={group || '_ungrouped'} className={styles.colorGroupSection}>
              {group && (
                <div className={styles.colorGroupHeader}>
                  <span className={styles.colorGroupLabel}>{group}</span>
                  <span className={styles.colorGroupCount}>{groupTokens.length}</span>
                </div>
              )}
              <div className={styles.shadowGrid}>
                {groupTokens.map(renderCard)}
              </div>
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="토큰 삭제"
        message={`'${deleteTarget?.name}' 그림자 토큰을 삭제합니다.`}
        confirmLabel="삭제"
        loading={deleting}
      />
    </>
  );
}
