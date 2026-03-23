'use client';

import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import type { TokenRow } from '@/lib/actions/tokens';
import { deleteTokenAction, updateTokenValueAction } from '@/lib/actions/tokens';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/stores/useUIStore';
import styles from './token-views.module.scss';

interface ColorData {
  hex: string;
  rgba: { r: number; g: number; b: number; a: number };
}

function parseColor(value: string): ColorData | null {
  try {
    return JSON.parse(value) as ColorData;
  } catch {
    return null;
  }
}

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return { r, g, b, a: 1 };
}

/** 토큰명의 첫 세그먼트(카테고리)로 그룹핑. 없으면 빈 문자열 키 */
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

/** 카드에 표시할 이름: "border/default" → "default", 단일명은 그대로 */
function displayName(fullName: string): string {
  const slash = fullName.indexOf('/');
  return slash >= 0 ? fullName.slice(slash + 1) : fullName;
}

export default function ColorGrid({ tokens: initial }: { tokens: TokenRow[] }) {
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const [tokens, setTokens] = useState<TokenRow[]>(initial);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const groups = useMemo(() => groupTokens(tokens), [tokens]);
  const [deleteTarget, setDeleteTarget] = useState<TokenRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingToken, setEditingToken] = useState<TokenRow | null>(null);
  const [editHex, setEditHex] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

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
    const color = parseColor(token.value);
    setEditingToken(token);
    setEditHex(color?.hex ?? '#000000');
  };

  const closeEdit = () => {
    setEditingToken(null);
    setEditHex('');
  };

  const handleSave = async () => {
    if (!editingToken) return;
    const hex = editHex.startsWith('#') ? editHex : `#${editHex}`;
    const rgba = hexToRgba(hex);
    const newValue = JSON.stringify({ hex, rgba });
    setSaving(true);
    const { error } = await updateTokenValueAction(editingToken.id, newValue, hex);
    setSaving(false);
    if (!error) {
      setTokens((prev) =>
        prev.map((t) =>
          t.id === editingToken.id ? { ...t, value: newValue, raw: hex } : t
        )
      );
      closeEdit();
    }
  };

  /** flat 그리드용 카드 (기존 스타일 유지) */
  const renderFlatCard = (token: TokenRow) => {
    const color = parseColor(token.value);
    if (!color) return null;
    return (
      <div key={token.id} className={styles.colorCard}>
        <div className={styles.colorCardInner}>
          <div className={styles.colorSwatch} style={{ backgroundColor: color.hex }} />
          <div className={styles.colorInfo}>
            <span className={styles.colorName}>{displayName(token.name)}</span>
            <div className={styles.colorValues}>
              <button type="button" className={styles.copyBtn} onClick={() => handleCopy(color.hex, token.id)} aria-label={`${token.name} ${color.hex} 복사`}>
                <span className={styles.hexValue}>{color.hex.toUpperCase()}</span>
                <Icon icon={copiedId === token.id ? 'solar:check-circle-linear' : 'solar:copy-linear'} width={14} height={14} />
              </button>
              <div className={styles.cardActions}>
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
      </div>
    );
  };

  const isFlat = groups.length === 1 && groups[0][0] === '';

  return (
    <>
      {isFlat ? (
        <div className={styles.colorGrid}>
          {tokens.map(renderFlatCard)}
        </div>
      ) : (
        <div className={styles.colorGroups}>
          {groups.map(([group, groupTokens]) => (
            <section key={group || '_ungrouped'} className={styles.colorGroupSection}>
              {group && (
                <div className={styles.colorGroupHeader}>
                  <span className={styles.colorGroupLabel}>{group}</span>
                </div>
              )}
              <div className={styles.colorGrid}>
                {groupTokens.map(renderFlatCard)}
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
        message={`'${deleteTarget?.name}' 색상 토큰을 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        loading={deleting}
      />

      <Modal
        isOpen={editingToken !== null}
        onClose={closeEdit}
        title={`색상 편집 — ${editingToken?.name ?? ''}`}
        size="sm"
      >
        <div className={styles.editForm}>
          <div className={styles.editField}>
            <label className={styles.editLabel} htmlFor="edit-hex">HEX 값</label>
            <div className={styles.editColorRow}>
              <input
                type="color"
                className={styles.editColorSwatch}
                value={editHex}
                onChange={(e) => setEditHex(e.target.value)}
                aria-label="색상 선택"
              />
              <input
                id="edit-hex"
                type="text"
                className={styles.editInput}
                value={editHex}
                onChange={(e) => setEditHex(e.target.value)}
                placeholder="#000000"
                spellCheck={false}
              />
            </div>
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
