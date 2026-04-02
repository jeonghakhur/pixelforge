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
  // JSON 포맷 { hex, rgba }
  try {
    const parsed = JSON.parse(value) as ColorData;
    if (parsed.hex) return parsed;
  } catch {
    // fall through
  }

  // plain hex: #rrggbb / #rrggbbaa
  const hexMatch = value.match(/^#([0-9a-fA-F]{6,8})$/);
  if (hexMatch) {
    const hex = value.slice(0, 7); // alpha 무시하고 6자리만
    return { hex, rgba: hexToRgba(hex) };
  }

  // rgba(r, g, b, a)
  const rgbaMatch = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    const toHex2 = (n: string) => parseInt(n).toString(16).padStart(2, '0');
    const hex = `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
    return {
      hex,
      rgba: { r: parseInt(r) / 255, g: parseInt(g) / 255, b: parseInt(b) / 255, a: parseFloat(a ?? '1') },
    };
  }

  return null;
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

/** 색상이 밝은지 판별 (텍스트 색 자동 결정용) */
function isLightColor(hex: string): boolean {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
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

  /** 가로 스트립용 칩 */
  const renderChip = (token: TokenRow) => {
    const color = parseColor(token.value);
    if (!color) return null;
    const name = displayName(token.name);
    const isCopied = copiedId === token.id;
    const isLight = isLightColor(color.hex);

    return (
      <div key={token.id} className={styles.colorChip}>
        {/* 스와치 영역 */}
        <div
          className={styles.chipSwatch}
          style={{ backgroundColor: color.hex }}
          title={color.hex}
        >
          {token.mode && (
            <span
              className={styles.chipMode}
              style={{ color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.55)' }}
            >
              {token.mode}
            </span>
          )}
        </div>

        {/* 정보 영역 */}
        <div className={styles.chipInfo}>
          <span className={styles.chipName} title={token.name}>{name}</span>
          <div className={styles.chipFooter}>
            <button
              type="button"
              className={styles.chipHex}
              onClick={() => handleCopy(color.hex, token.id)}
              aria-label={`${color.hex} 복사`}
            >
              {isCopied
                ? <Icon icon="solar:check-circle-linear" width={12} height={12} />
                : color.hex.toUpperCase()
              }
            </button>
            <div className={styles.chipActions}>
              <button
                type="button"
                className={styles.chipAction}
                onClick={() => openEdit(token)}
                aria-label="편집"
              >
                <Icon icon="solar:pen-2-linear" width={11} height={11} />
              </button>
              <button
                type="button"
                className={`${styles.chipAction} ${styles.chipActionDelete}`}
                onClick={() => setDeleteTarget(token)}
                aria-label="삭제"
              >
                <Icon icon="solar:trash-bin-2-linear" width={11} height={11} />
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
        <div className={styles.colorStrip}>
          {tokens.map(renderChip)}
        </div>
      ) : (
        <div className={styles.colorGroups}>
          {groups.map(([group, groupTokens]) => (
            <section key={group || '_ungrouped'} className={styles.colorGroupSection}>
              <div className={styles.colorGroupHeader}>
                <div className={styles.colorGroupHeaderLeft}>
                  <span className={styles.colorGroupLabel}>{group || 'uncategorized'}</span>
                  <span className={styles.colorGroupCount}>{groupTokens.length}</span>
                </div>
                {groupTokens.some((t) => t.collectionName) && (
                  <span className={styles.colorGroupCollection}>
                    <Icon icon="solar:layers-minimalistic-linear" width={11} height={11} />
                    {groupTokens[0].collectionName}
                  </span>
                )}
              </div>
              <div className={styles.colorStrip}>
                {groupTokens.map(renderChip)}
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
