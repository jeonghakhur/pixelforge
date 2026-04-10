'use client';

import { useState, useMemo, type ChangeEvent } from 'react';
import { Icon } from '@iconify/react';
import type { TokenRow } from '@/lib/actions/tokens';
import { deleteTokenAction, updateTokenValueAction } from '@/lib/actions/tokens';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/stores/useUIStore';
import styles from './token-views.module.scss';

interface TypographyData {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight?: number;
  letterSpacing?: number;
}

function parseTypo(value: string): TypographyData | null {
  try {
    return JSON.parse(value) as TypographyData;
  } catch {
    return null;
  }
}

interface EditState {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
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

export default function TypographyList({ tokens: initial }: { tokens: TokenRow[] }) {
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const [tokens, setTokens] = useState<TokenRow[]>(initial);
  const groups = useMemo(() => groupTokens(tokens), [tokens]);
  const [deleteTarget, setDeleteTarget] = useState<TokenRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingToken, setEditingToken] = useState<TokenRow | null>(null);
  const [editState, setEditState] = useState<EditState>({
    fontFamily: '', fontSize: '', fontWeight: '', lineHeight: '', letterSpacing: '',
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
    const typo = parseTypo(token.value);
    setEditingToken(token);
    setEditState({
      fontFamily: typo?.fontFamily ?? '',
      fontSize: String(typo?.fontSize ?? ''),
      fontWeight: String(typo?.fontWeight ?? ''),
      lineHeight: typo?.lineHeight != null ? String(typo.lineHeight) : '',
      letterSpacing: typo?.letterSpacing != null ? String(typo.letterSpacing) : '',
    });
  };

  const closeEdit = () => {
    setEditingToken(null);
  };

  const handleSave = async () => {
    if (!editingToken) return;
    const data: TypographyData = {
      fontFamily: editState.fontFamily,
      fontSize: parseFloat(editState.fontSize) || 16,
      fontWeight: parseFloat(editState.fontWeight) || 400,
      lineHeight: editState.lineHeight ? parseFloat(editState.lineHeight) : undefined,
      letterSpacing: editState.letterSpacing ? parseFloat(editState.letterSpacing) : undefined,
    };
    const newValue = JSON.stringify(data);
    const raw = `${data.fontFamily} ${data.fontSize}px`;
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
    const typo = parseTypo(token.value);
    if (!typo) return null;
    return (
      <div key={token.id} className={styles.typoCard}>
        <div className={styles.typoCardInner}>
          <p
            className={styles.typoSample}
            style={{
              fontFamily: typo.fontFamily,
              fontSize: `${Math.min(typo.fontSize, 48)}px`,
              fontWeight: typo.fontWeight,
              lineHeight: typo.lineHeight ? `${typo.lineHeight}px` : undefined,
            }}
          >
            가나다라마바사 ABCDEFgh 1234567890
          </p>
          <div className={styles.typoMeta}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className={styles.typoName}>{displayName(token.name)}</span>
              <div className={styles.cardActions}>
                <button type="button" className={styles.actionBtn} onClick={() => openEdit(token)} aria-label="편집">
                  <Icon icon="solar:pen-2-linear" width={13} height={13} />
                </button>
                <button type="button" className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => setDeleteTarget(token)} aria-label="삭제">
                  <Icon icon="solar:trash-bin-2-linear" width={13} height={13} />
                </button>
              </div>
            </div>
            <div className={styles.typoDetails}>
              <span>{typo.fontFamily}</span>
              <span>{typo.fontSize}px</span>
              <span>w{typo.fontWeight}</span>
              {typo.lineHeight && <span>LH {Math.round(typo.lineHeight)}px</span>}
              {typo.letterSpacing && <span>LS {typo.letterSpacing}px</span>}
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
        <div className={styles.typoList}>
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
              <div className={styles.typoList}>
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
        message={`'${deleteTarget?.name}' 타이포그래피 토큰을 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        loading={deleting}
      />

      <Modal
        isOpen={editingToken !== null}
        onClose={closeEdit}
        title={`타이포 편집 — ${editingToken?.name ?? ''}`}
        size="sm"
      >
        <div className={styles.editForm}>
          <div className={styles.editField}>
            <label className={styles.editLabel} htmlFor="edit-font-family">Font Family</label>
            <input
              id="edit-font-family"
              type="text"
              className={styles.editInput}
              value={editState.fontFamily}
              onChange={set('fontFamily')}
              placeholder="Pretendard"
            />
          </div>
          <div className={styles.editRow3}>
            <div className={styles.editField}>
              <label className={styles.editLabel} htmlFor="edit-font-size">Size (px)</label>
              <input
                id="edit-font-size"
                type="number"
                className={styles.editInput}
                value={editState.fontSize}
                onChange={set('fontSize')}
                min={1}
              />
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel} htmlFor="edit-font-weight">Weight</label>
              <input
                id="edit-font-weight"
                type="number"
                className={styles.editInput}
                value={editState.fontWeight}
                onChange={set('fontWeight')}
                min={100}
                max={900}
                step={100}
              />
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel} htmlFor="edit-line-height">LH (px)</label>
              <input
                id="edit-line-height"
                type="number"
                className={styles.editInput}
                value={editState.lineHeight}
                onChange={set('lineHeight')}
                min={0}
                placeholder="—"
              />
            </div>
          </div>
          <div className={styles.editField}>
            <label className={styles.editLabel} htmlFor="edit-letter-spacing">Letter Spacing (px)</label>
            <input
              id="edit-letter-spacing"
              type="number"
              className={styles.editInput}
              value={editState.letterSpacing}
              onChange={set('letterSpacing')}
              step={0.1}
              placeholder="—"
            />
          </div>
        </div>
        <div className={styles.editFooter}>
          <button type="button" className={styles.editCancelBtn} onClick={closeEdit}>
            취소
          </button>
          <button
            type="button"
            className={styles.editSaveBtn}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </Modal>
    </>
  );
}
