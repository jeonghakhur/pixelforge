'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import Card from '@/components/common/Card';
import {
  getTokenMenuAdminAction,
  type TokenMenuAdminEntry,
} from '@/lib/actions/token-menu';
import {
  updateTokenTypeConfigAction,
  toggleTokenTypeVisibilityAction,
  reorderTokenTypeConfigsAction,
  deleteTokenTypeConfigAction,
} from '@/lib/actions/token-type-admin';
import styles from './page.module.scss';

export default function TokenTypeManager() {
  const [items, setItems] = useState<TokenMenuAdminEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const data = await getTokenMenuAdminAction();
    setItems(data);
  };

  useEffect(() => { load(); }, []);

  const handleLabelClick = (item: TokenMenuAdminEntry) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditIcon(item.icon);
    setError(null);
  };

  const handleSave = async () => {
    if (!editingId) return;
    const res = await updateTokenTypeConfigAction(editingId, {
      label: editLabel.trim() || undefined,
      icon: editIcon.trim() || undefined,
    });
    if (res.error) { setError(res.error); return; }
    setEditingId(null);
    await load();
  };

  const handleToggle = async (id: string) => {
    const res = await toggleTokenTypeVisibilityAction(id);
    if (res.error) { setError(res.error); return; }
    await load();
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const newItems = [...items];
    const target = index + dir;
    if (target < 0 || target >= newItems.length) return;
    [newItems[index], newItems[target]] = [newItems[target], newItems[index]];
    setItems(newItems);
    const res = await reorderTokenTypeConfigsAction(newItems.map((i) => i.id));
    if (res.error) { setError(res.error); await load(); }
  };

  const handleDelete = async (item: TokenMenuAdminEntry) => {
    if (item.tokenCount > 0) return;
    const res = await deleteTokenTypeConfigAction(item.id);
    if (res.error) { setError(res.error); return; }
    await load();
  };

  return (
    <Card className={styles.tableCard}>
      <div className={styles.cardHeader}>
        <Icon icon="solar:layers-minimalistic-linear" width={18} height={18} />
        <h2 className={styles.cardTitle}>토큰 타입 메뉴</h2>
      </div>
      <p className={styles.settingsDesc}>
        Figma sync 시 자동 등록됩니다. 라벨·아이콘·순서·표시여부를 수정할 수 있습니다.
      </p>

      {error && (
        <p className={styles.formError} role="alert">
          <Icon icon="solar:danger-circle-linear" width={14} height={14} />
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className={styles.settingsDesc} style={{ marginTop: '12px' }}>
          아직 등록된 타입이 없습니다. Figma sync를 먼저 실행하세요.
        </p>
      ) : (
        <ul className={styles.tokenTypeList} aria-label="토큰 타입 목록">
          {items.map((item, index) => (
            <li
              key={item.id}
              className={`${styles.tokenTypeItem} ${!item.isVisible ? styles.dimmed : ''}`}
            >
              <Icon icon={item.icon} width={16} height={16} className={styles.tokenTypeIcon} />

              {editingId === item.id ? (
                <span className={styles.tokenTypeEditRow}>
                  <input
                    className={styles.input}
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="라벨"
                    style={{ width: '100px' }}
                    aria-label="라벨 수정"
                  />
                  <input
                    className={styles.input}
                    value={editIcon}
                    onChange={(e) => setEditIcon(e.target.value)}
                    placeholder="solar:icon-name"
                    style={{ width: '160px' }}
                    aria-label="아이콘 수정"
                  />
                  <button type="button" className={styles.tokenTypeDeleteBtn} onClick={handleSave} aria-label="저장">
                    <Icon icon="solar:check-read-linear" width={14} height={14} />
                  </button>
                  <button type="button" className={styles.tokenTypeDeleteBtn} onClick={() => setEditingId(null)} aria-label="취소">
                    <Icon icon="solar:close-circle-linear" width={14} height={14} />
                  </button>
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.tokenTypeLabelBtn}
                    onClick={() => handleLabelClick(item)}
                    aria-label={`${item.label} 수정`}
                  >
                    {item.label}
                  </button>
                  <code className={styles.tokenTypeId}>{item.type}</code>
                  <span className={styles.tokenTypeBadge}>{item.tokenCount}</span>
                </>
              )}

              <span className={styles.tokenTypeActions}>
                <button
                  type="button"
                  className={styles.tokenTypeDeleteBtn}
                  onClick={() => handleToggle(item.id)}
                  aria-label={item.isVisible ? '숨기기' : '표시'}
                  title={item.isVisible ? '숨기기' : '표시'}
                >
                  <Icon
                    icon={item.isVisible ? 'solar:eye-linear' : 'solar:eye-closed-linear'}
                    width={14}
                    height={14}
                  />
                </button>
                <button
                  type="button"
                  className={styles.tokenTypeDeleteBtn}
                  onClick={() => handleMove(index, -1)}
                  disabled={index === 0}
                  aria-label="위로"
                >
                  <Icon icon="solar:alt-arrow-up-linear" width={14} height={14} />
                </button>
                <button
                  type="button"
                  className={styles.tokenTypeDeleteBtn}
                  onClick={() => handleMove(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="아래로"
                >
                  <Icon icon="solar:alt-arrow-down-linear" width={14} height={14} />
                </button>
                <button
                  type="button"
                  className={styles.tokenTypeDeleteBtn}
                  onClick={() => handleDelete(item)}
                  disabled={item.tokenCount > 0}
                  aria-label={`${item.label} 삭제`}
                  title={item.tokenCount > 0 ? `토큰 ${item.tokenCount}개가 있어 삭제 불가` : '삭제'}
                >
                  <Icon icon="solar:trash-bin-2-linear" width={14} height={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
