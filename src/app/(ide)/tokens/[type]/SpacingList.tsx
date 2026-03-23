'use client';

import { useState, useMemo, type ChangeEvent } from 'react';
import { Icon } from '@iconify/react';
import type { TokenRow } from '@/lib/actions/tokens';
import { deleteTokenAction, updateTokenValueAction } from '@/lib/actions/tokens';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/stores/useUIStore';
import styles from './token-views.module.scss';

interface SpacingData {
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  gap?: number;
}

function parseSpacing(value: string): SpacingData | null {
  try {
    return JSON.parse(value) as SpacingData;
  } catch {
    return null;
  }
}

interface EditState {
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  gap: string;
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

export default function SpacingList({ tokens: initial }: { tokens: TokenRow[] }) {
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const [tokens, setTokens] = useState<TokenRow[]>(initial);
  const groups = useMemo(() => groupTokens(tokens), [tokens]);
  const [deleteTarget, setDeleteTarget] = useState<TokenRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingToken, setEditingToken] = useState<TokenRow | null>(null);
  const [editState, setEditState] = useState<EditState>({
    paddingTop: '', paddingRight: '', paddingBottom: '', paddingLeft: '', gap: '',
  });
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
    const sp = parseSpacing(token.value);
    setEditingToken(token);
    setEditState({
      paddingTop: sp?.paddingTop != null ? String(sp.paddingTop) : '',
      paddingRight: sp?.paddingRight != null ? String(sp.paddingRight) : '',
      paddingBottom: sp?.paddingBottom != null ? String(sp.paddingBottom) : '',
      paddingLeft: sp?.paddingLeft != null ? String(sp.paddingLeft) : '',
      gap: sp?.gap != null ? String(sp.gap) : '',
    });
  };

  const closeEdit = () => setEditingToken(null);

  const handleSave = async () => {
    if (!editingToken) return;
    const num = (v: string) => (v !== '' ? parseFloat(v) : undefined);
    const data: SpacingData = {
      paddingTop: num(editState.paddingTop),
      paddingRight: num(editState.paddingRight),
      paddingBottom: num(editState.paddingBottom),
      paddingLeft: num(editState.paddingLeft),
      gap: num(editState.gap),
    };
    const newValue = JSON.stringify(data);
    const raw = `${data.paddingTop ?? 0}/${data.paddingRight ?? 0}/${data.paddingBottom ?? 0}/${data.paddingLeft ?? 0} gap:${data.gap ?? 0}`;
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

  const set = (field: keyof EditState) => (e: ChangeEvent<HTMLInputElement>) =>
    setEditState((prev) => ({ ...prev, [field]: e.target.value }));

  const renderCard = (token: TokenRow) => {
    const sp = parseSpacing(token.value);
    if (!sp) return null;
    const maxVal = Math.max(sp.paddingTop ?? 0, sp.paddingRight ?? 0, sp.paddingBottom ?? 0, sp.paddingLeft ?? 0, sp.gap ?? 0);
    const barWidth = Math.min(maxVal, 200);
    return (
      <div key={token.id} className={styles.spacingCard}>
        <div className={styles.spacingCardInner}>
          <div className={styles.spacingVisual}>
            <div className={styles.spacingBar} style={{ width: `${barWidth}px` }} />
          </div>
          <div className={styles.spacingMeta}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className={styles.spacingName}>{displayName(token.name)}</span>
              <div className={styles.cardActions}>
                <button type="button" className={styles.actionBtn} onClick={() => openEdit(token)} aria-label="편집">
                  <Icon icon="solar:pen-2-linear" width={13} height={13} />
                </button>
                <button type="button" className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => setDeleteTarget(token)} aria-label="삭제">
                  <Icon icon="solar:trash-bin-2-linear" width={13} height={13} />
                </button>
              </div>
            </div>
            <div className={styles.spacingDetails}>
              {sp.paddingTop !== undefined && sp.paddingTop > 0 && <span>Top {sp.paddingTop}px</span>}
              {sp.paddingRight !== undefined && sp.paddingRight > 0 && <span>Right {sp.paddingRight}px</span>}
              {sp.paddingBottom !== undefined && sp.paddingBottom > 0 && <span>Bottom {sp.paddingBottom}px</span>}
              {sp.paddingLeft !== undefined && sp.paddingLeft > 0 && <span>Left {sp.paddingLeft}px</span>}
              {sp.gap !== undefined && sp.gap > 0 && <span>Gap {sp.gap}px</span>}
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
        <div className={styles.spacingList}>
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
              <div className={styles.spacingList}>
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
        message={`'${deleteTarget?.name}' 간격 토큰을 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        loading={deleting}
      />

      <Modal
        isOpen={editingToken !== null}
        onClose={closeEdit}
        title={`간격 편집 — ${editingToken?.name ?? ''}`}
        size="sm"
      >
        <div className={styles.editForm}>
          <div className={styles.editRow2}>
            <div className={styles.editField}>
              <label className={styles.editLabel} htmlFor="edit-pt">Padding Top</label>
              <input id="edit-pt" type="number" className={styles.editInput} value={editState.paddingTop} onChange={set('paddingTop')} min={0} placeholder="0" />
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel} htmlFor="edit-pr">Padding Right</label>
              <input id="edit-pr" type="number" className={styles.editInput} value={editState.paddingRight} onChange={set('paddingRight')} min={0} placeholder="0" />
            </div>
          </div>
          <div className={styles.editRow2}>
            <div className={styles.editField}>
              <label className={styles.editLabel} htmlFor="edit-pb">Padding Bottom</label>
              <input id="edit-pb" type="number" className={styles.editInput} value={editState.paddingBottom} onChange={set('paddingBottom')} min={0} placeholder="0" />
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel} htmlFor="edit-pl">Padding Left</label>
              <input id="edit-pl" type="number" className={styles.editInput} value={editState.paddingLeft} onChange={set('paddingLeft')} min={0} placeholder="0" />
            </div>
          </div>
          <div className={styles.editField}>
            <label className={styles.editLabel} htmlFor="edit-gap">Gap</label>
            <input id="edit-gap" type="number" className={styles.editInput} value={editState.gap} onChange={set('gap')} min={0} placeholder="0" />
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
