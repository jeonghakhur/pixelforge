'use client';

import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import type { TokenRow } from '@/lib/actions/tokens';
import { deleteTokenAction, updateTokenValueAction } from '@/lib/actions/tokens';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/stores/useUIStore';
import styles from './token-views.module.scss';

interface RadiusData {
  value: number;
  corners?: number[];
}

function parseRadius(value: string): RadiusData | null {
  try {
    return JSON.parse(value) as RadiusData;
  } catch {
    return null;
  }
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

function displayName(fullName: string): string {
  const slash = fullName.indexOf('/');
  return slash >= 0 ? fullName.slice(slash + 1) : fullName;
}

export default function RadiusList({ tokens: initial }: { tokens: TokenRow[] }) {
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const [tokens, setTokens] = useState<TokenRow[]>(initial);
  const groups = useMemo(() => groupTokens(tokens), [tokens]);
  const [deleteTarget, setDeleteTarget] = useState<TokenRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingToken, setEditingToken] = useState<TokenRow | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

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

  const openEdit = (token: TokenRow) => {
    const rad = parseRadius(token.value);
    setEditingToken(token);
    setEditValue(rad ? String(rad.value) : '');
  };

  const closeEdit = () => setEditingToken(null);

  const handleSave = async () => {
    if (!editingToken) return;
    const num = parseFloat(editValue) || 0;
    const existing = parseRadius(editingToken.value);
    const data: RadiusData = {
      value: num,
      corners: existing?.corners,
    };
    const newValue = JSON.stringify(data);
    const raw = `${num}px`;
    setSaving(true);
    const { error } = await updateTokenValueAction(editingToken.id, newValue, raw);
    setSaving(false);
    if (!error) {
      setTokens((prev) =>
        prev.map((t) => (t.id === editingToken.id ? { ...t, value: newValue, raw } : t))
      );
      closeEdit();
    }
  };

  const renderCard = (token: TokenRow) => {
    const rad = parseRadius(token.value);
    if (!rad) return null;
    const borderRadius = rad.corners ? rad.corners.map((c) => `${c}px`).join(' ') : `${rad.value}px`;
    return (
      <div key={token.id} className={styles.radiusCard}>
        <div className={styles.radiusCardInner}>
          <div className={styles.radiusVisual}>
            <div className={styles.radiusBox} style={{ borderRadius }} />
          </div>
          <div className={styles.radiusMeta}>
            <span className={styles.radiusName}>{displayName(token.name)}</span>
            <span className={styles.radiusValue}>{rad.value}px</span>
            <div className={styles.cardActions} style={{ justifyContent: 'center', marginTop: '4px' }}>
              <button type="button" className={styles.actionBtn} onClick={() => openEdit(token)} aria-label="편집">
                <Icon icon="solar:pen-2-linear" width={13} height={13} />
              </button>
              <button type="button" className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => setDeleteTarget(token)} aria-label="삭제">
                <Icon icon="solar:trash-bin-2-linear" width={13} height={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const isFlat = groups.length === 1 && groups[0][0] === '';

  return (
    <>
      {isFlat ? (
        <div className={styles.radiusList}>
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
              <div className={styles.radiusList}>
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
        message={`'${deleteTarget?.name}' 반경 토큰을 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        loading={deleting}
      />

      <Modal
        isOpen={editingToken !== null}
        onClose={closeEdit}
        title={`반경 편집 — ${editingToken?.name ?? ''}`}
        size="sm"
      >
        <div className={styles.editForm}>
          <div className={styles.editField}>
            <label className={styles.editLabel} htmlFor="edit-radius">반경 값 (px)</label>
            <input
              id="edit-radius"
              type="number"
              className={styles.editInput}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              min={0}
              placeholder="0"
            />
          </div>
        </div>
        <div className={styles.editFooter}>
          <button type="button" className={styles.editCancelBtn} onClick={closeEdit}>취소</button>
          <button type="button" className={styles.editSaveBtn} onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </Modal>
    </>
  );
}
