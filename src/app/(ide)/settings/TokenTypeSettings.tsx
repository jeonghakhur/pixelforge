'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Icon } from '@iconify/react';
import Button from '@/components/common/Button';
import type { StoredTokenType } from '@/lib/config';
import {
  getActiveTokenTypesAction,
  addTokenTypeAction,
  deleteTokenTypeAction,
} from '@/lib/actions/token-type-config';
import styles from './page.module.scss';

const addSchema = z.object({
  label: z.string().min(1, '이름을 입력해주세요').max(30),
  icon: z.string().min(1, '아이콘을 입력해주세요'),
  pattern: z.string().min(1, '패턴을 입력해주세요').refine((v) => {
    try { new RegExp(v); return true; } catch { return false; }
  }, '올바른 정규식이 아닙니다'),
  cssPrefix: z.string().min(1, 'CSS 접두어를 입력해주세요').max(20)
    .regex(/^[a-z][a-z0-9-]*$/, '소문자·숫자·하이픈만 사용 가능합니다'),
});

type AddForm = z.infer<typeof addSchema>;

function labelToId(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function TokenTypeSettings() {
  const [types, setTypes] = useState<StoredTokenType[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const form = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: { icon: 'solar:palette-linear' },
  });

  useEffect(() => {
    getActiveTokenTypesAction().then((data) => {
      setTypes(data);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    const res = await deleteTokenTypeAction(id);
    if (res.error) { setDeleteError(res.error); return; }
    setTypes((prev) => prev.filter((t) => t.id !== id));
  };

  const onAdd = async (data: AddForm) => {
    setAddError(null);
    const id = labelToId(data.label);
    const res = await addTokenTypeAction({ id, ...data });
    if (res.error) { setAddError(res.error); return; }
    const updated = await getActiveTokenTypesAction();
    setTypes(updated);
    setShowAddForm(false);
    form.reset({ icon: 'solar:palette-linear' });
  };

  return (
    <div className={styles.settingsContent}>
      <div className={styles.settingsLabel}>
        <Icon icon="solar:layers-minimalistic-linear" width={20} height={20} />
        <div>
          <h2 className={styles.settingsTitle}>토큰 타입 관리</h2>
          <p className={styles.settingsDesc}>
            추출할 토큰 타입을 추가하거나 삭제합니다.
          </p>
        </div>
      </div>

      {/* 타입 목록 */}
      {loading ? (
        <p className={styles.settingsDesc}>불러오는 중...</p>
      ) : (
        <ul className={styles.tokenTypeList} aria-label="토큰 타입 목록">
          {types.map((t) => (
            <li key={t.id} className={styles.tokenTypeItem}>
              <Icon icon={t.icon} width={16} height={16} className={styles.tokenTypeIcon} />
              <span className={styles.tokenTypeLabel}>{t.label}</span>
              <code className={styles.tokenTypeId}>{t.id}</code>
              <button
                type="button"
                className={styles.tokenTypeDeleteBtn}
                onClick={() => handleDelete(t.id)}
                aria-label={`${t.label} 삭제`}
              >
                <Icon icon="solar:trash-bin-2-linear" width={14} height={14} />
              </button>
            </li>
          ))}
          {types.length === 0 && (
            <li className={styles.tokenTypeEmpty}>등록된 타입이 없습니다.</li>
          )}
        </ul>
      )}
      {deleteError && <p className={styles.error} role="alert">{deleteError}</p>}

      {/* 추가 폼 토글 */}
      {!showAddForm ? (
        <button
          type="button"
          className={styles.tokenTypeAddToggle}
          onClick={() => setShowAddForm(true)}
        >
          <Icon icon="solar:add-circle-linear" width={14} height={14} />
          타입 추가
        </button>
      ) : (
        <form
          onSubmit={form.handleSubmit(onAdd, () => form.setFocus('label'))}
          className={styles.tokenTypeAddForm}
          noValidate
        >
          <div className={styles.tokenTypeAddGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="tt-label" className={styles.formLabel}>이름</label>
              <input
                id="tt-label"
                type="text"
                className={styles.input}
                placeholder="Motion"
                aria-invalid={!!form.formState.errors.label}
                {...form.register('label')}
              />
              {form.formState.errors.label && (
                <p className={styles.error} role="alert">{form.formState.errors.label.message}</p>
              )}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="tt-icon" className={styles.formLabel}>Solar 아이콘</label>
              <input
                id="tt-icon"
                type="text"
                className={styles.input}
                placeholder="solar:palette-linear"
                aria-invalid={!!form.formState.errors.icon}
                {...form.register('icon')}
              />
              {form.formState.errors.icon && (
                <p className={styles.error} role="alert">{form.formState.errors.icon.message}</p>
              )}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="tt-pattern" className={styles.formLabel}>
                섹션 패턴 <span className={styles.formHint}>(정규식)</span>
              </label>
              <input
                id="tt-pattern"
                type="text"
                className={styles.input}
                placeholder="^(motion|animation|transition)"
                aria-invalid={!!form.formState.errors.pattern}
                {...form.register('pattern')}
              />
              {form.formState.errors.pattern && (
                <p className={styles.error} role="alert">{form.formState.errors.pattern.message}</p>
              )}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="tt-prefix" className={styles.formLabel}>CSS 접두어</label>
              <input
                id="tt-prefix"
                type="text"
                className={styles.input}
                placeholder="motion"
                aria-invalid={!!form.formState.errors.cssPrefix}
                {...form.register('cssPrefix')}
              />
              {form.formState.errors.cssPrefix && (
                <p className={styles.error} role="alert">{form.formState.errors.cssPrefix.message}</p>
              )}
            </div>
          </div>
          {addError && <p className={styles.error} role="alert">{addError}</p>}
          <div className={styles.inputRow}>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              leftIcon="solar:add-circle-linear"
            >
              추가
            </Button>
            <button
              type="button"
              className={styles.tokenTypeCancelBtn}
              onClick={() => { setShowAddForm(false); form.reset({ icon: 'solar:palette-linear' }); setAddError(null); }}
            >
              취소
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
