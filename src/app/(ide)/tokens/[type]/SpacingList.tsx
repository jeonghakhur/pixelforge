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

function parseSpacingData(value: string): SpacingData | null {
  try { return JSON.parse(value) as SpacingData; } catch { return null; }
}

function extractPxValue(token: TokenRow): number {
  const sp = parseSpacingData(token.value);
  if (sp) {
    const vals = [sp.gap, sp.paddingTop, sp.paddingRight, sp.paddingBottom, sp.paddingLeft]
      .filter((v): v is number => v !== undefined && v > 0);
    if (vals.length > 0) return Math.max(...vals);
  }
  const num = parseFloat(token.value);
  if (!isNaN(num)) return num;
  if (token.raw) {
    const m = token.raw.match(/[\d.]+/);
    if (m) return parseFloat(m[0]);
  }
  return 0;
}

function displayName(fullName: string): string {
  const slash = fullName.lastIndexOf('/');
  return slash >= 0 ? fullName.slice(slash + 1) : fullName;
}

interface EditState {
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  gap: string;
}

export default function SpacingList({ tokens: initial }: { tokens: TokenRow[] }) {
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const [tokens, setTokens] = useState<TokenRow[]>(() =>
    [...initial].sort((a, b) => extractPxValue(a) - extractPxValue(b))
  );
  const [deleteTarget, setDeleteTarget] = useState<TokenRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingToken, setEditingToken] = useState<TokenRow | null>(null);
  const [editState, setEditState] = useState<EditState>({
    paddingTop: '', paddingRight: '', paddingBottom: '', paddingLeft: '', gap: '',
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const pxValues = useMemo(() => tokens.map(extractPxValue), [tokens]);
  const maxVal = useMemo(() => Math.max(...pxValues, 1), [pxValues]);

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
    const sp = parseSpacingData(token.value);
    setEditingToken(token);
    setEditState({
      paddingTop: sp?.paddingTop != null ? String(sp.paddingTop) : '',
      paddingRight: sp?.paddingRight != null ? String(sp.paddingRight) : '',
      paddingBottom: sp?.paddingBottom != null ? String(sp.paddingBottom) : '',
      paddingLeft: sp?.paddingLeft != null ? String(sp.paddingLeft) : '',
      gap: sp?.gap != null ? String(sp.gap) : '',
    });
  };

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
      setEditingToken(null);
    }
  };

  const copyJSON = async () => {
    const json = JSON.stringify(
      tokens.reduce<Record<string, { value: string }>>((acc, t) => {
        acc[t.name] = { value: t.raw ?? t.value };
        return acc;
      }, {}),
      null, 2
    );
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const set = (field: keyof EditState) => (e: ChangeEvent<HTMLInputElement>) =>
    setEditState((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <>
      <div className={styles.spacingHeader}>
        <p className={styles.spacingSubtitle}>선(Line) 대신 여백으로 위계를 정의합니다.</p>
        <span className={styles.baseUnitBadge}>Base Unit: 4px</span>
      </div>
      <div className={styles.spacingLayout}>
        {/* ── 좌: 토큰 행 목록 ── */}
        <div className={styles.spacingRows}>
          {tokens.map((token, i) => {
            const px = pxValues[i];
            const rem = (px / 16).toFixed(px % 16 === 0 ? 0 : 2);
            const barPct = maxVal > 0 ? (px / maxVal) * 100 : 0;
            return (
              <div key={token.id} className={styles.spacingRow}>
                <div className={styles.spacingRowName}>
                  <span className={styles.spacingRowLabel}>{displayName(token.name)}</span>
                  <span className={styles.spacingRowRem}>({rem}rem)</span>
                </div>
                <div className={styles.spacingTrack}>
                  <div
                    className={styles.spacingFill}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span className={styles.spacingPx}>{px}px</span>
                <div className={styles.spacingRowActions}>
                  <button type="button" className={styles.actionBtn} onClick={() => openEdit(token)} aria-label="편집">
                    <Icon icon="solar:pen-2-linear" width={13} height={13} />
                  </button>
                  <button type="button" className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => setDeleteTarget(token)} aria-label="삭제">
                    <Icon icon="solar:trash-bin-2-linear" width={13} height={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 우: 사이드바 ── */}
        <aside className={styles.spacingSidebar}>
          <div className={styles.spacingInfoCard}>
            <Icon icon="solar:ruler-angular-linear" width={28} height={28} className={styles.spacingInfoIcon} />
            <h3 className={styles.spacingInfoTitle}>Grid Consistency</h3>
            <p className={styles.spacingInfoDesc}>
              모든 수직/수평 간격은 spacing 토큰을 사용하여 일관성을 유지합니다.
              이는 복잡한 대시보드에서도 시각적 피로를 최소화하는 핵심입니다.
            </p>
          </div>
          <button type="button" className={styles.copyJsonBtn} onClick={copyJSON}>
            <Icon icon={copied ? 'solar:check-read-linear' : 'solar:copy-linear'} width={14} height={14} />
            {copied ? 'Copied!' : 'Copy JSON Tokens'}
          </button>
        </aside>
      </div>

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
        onClose={() => setEditingToken(null)}
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
          <button type="button" className={styles.editCancelBtn} onClick={() => setEditingToken(null)}>취소</button>
          <button type="button" className={styles.editSaveBtn} onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </Modal>
    </>
  );
}
