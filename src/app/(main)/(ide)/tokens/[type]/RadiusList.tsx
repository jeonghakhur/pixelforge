'use client';

import { useState } from 'react';
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
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'number') return { value: parsed };
    if (typeof parsed === 'object' && parsed !== null) return parsed as RadiusData;
  } catch {}
  const num = parseFloat(value);
  return isNaN(num) ? null : { value: num };
}

function displayName(fullName: string): string {
  const slash = fullName.lastIndexOf('/');
  return slash >= 0 ? fullName.slice(slash + 1) : fullName;
}

interface RadiusDesc { title: string; description: string; }

const RADIUS_DESC_MAP: Record<number, RadiusDesc> = {
  0:  { title: 'Sharp',            description: '날카로운 모서리, 테이블 셀 등 정밀한 레이아웃에 사용합니다.' },
  2:  { title: 'Subtle',           description: '거의 직각에 가까운 미묘한 곡률입니다.' },
  4:  { title: 'Micro Components', description: '체크박스, 소형 입력란 등 아주 작은 요소에 사용합니다.' },
  8:  { title: 'Default Elements', description: '버튼, 카드 등 시스템의 표준적인 곡률입니다.' },
  12: { title: 'Floating Cards',   description: '모달, 대형 카드 섹션 등 깊이감이 필요한 요소에 적용합니다.' },
  16: { title: 'Large Panels',     description: '패널, 시트 등 대형 컨테이너에 사용합니다.' },
  24: { title: 'Pill Elements',    description: '검색 바, 태그, 칩 등 부드러운 감초가 필요한 곳에 사용합니다.' },
  9999: { title: 'Full Circle',    description: '원형 버튼, 아바타 등 완전한 원에 사용합니다.' },
};

function getRadiusDesc(px: number): RadiusDesc {
  if (px >= 999) return RADIUS_DESC_MAP[9999];
  const keys = Object.keys(RADIUS_DESC_MAP).map(Number).sort((a, b) => a - b);
  let best = keys[0];
  for (const k of keys) {
    if (k <= px) best = k;
  }
  return RADIUS_DESC_MAP[best] ?? { title: 'Custom Radius', description: `${px}px 곡률을 적용합니다.` };
}

export default function RadiusList({ tokens: initial }: { tokens: TokenRow[] }) {
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const [tokens, setTokens] = useState<TokenRow[]>(() =>
    [...initial].sort((a, b) => {
      const aVal = parseRadius(a.value)?.value ?? 0;
      const bVal = parseRadius(b.value)?.value ?? 0;
      return aVal - bVal;
    })
  );
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

  const handleSave = async () => {
    if (!editingToken) return;
    const num = parseFloat(editValue) || 0;
    const existing = parseRadius(editingToken.value);
    const data: RadiusData = { value: num, corners: existing?.corners };
    const newValue = JSON.stringify(data);
    const raw = `${num}px`;
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

  return (
    <>
      <div className={styles.radiusGrid}>
        {tokens.map((token) => {
          const rad = parseRadius(token.value);
          if (!rad) return null;
          const borderRadius = rad.corners
            ? rad.corners.map((c) => `${c}px`).join(' ')
            : `${rad.value}px`;
          const desc = getRadiusDesc(rad.value);
          return (
            <div key={token.id} className={styles.radiusCard2}>
              <div className={styles.radiusPreview}>
                <div className={styles.radiusRect} style={{ borderRadius }}>
                  <span className={styles.radiusPreviewVal}>{rad.value}px</span>
                </div>
              </div>
              <div className={styles.radiusCardBody}>
                <span className={styles.radiusTokenName}>{displayName(token.name)}</span>
                <span className={styles.radiusUsageTitle}>{desc.title}</span>
                <p className={styles.radiusUsageDesc}>{desc.description}</p>
              </div>
              <div className={styles.radiusCardActions}>
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
        onClose={() => setEditingToken(null)}
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
          <button type="button" className={styles.editCancelBtn} onClick={() => setEditingToken(null)}>취소</button>
          <button type="button" className={styles.editSaveBtn} onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </Modal>
    </>
  );
}
