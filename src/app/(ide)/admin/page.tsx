// @page Admin — 사용자 관리 (관리자 전용)
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '@iconify/react';
import Button from '@/components/common/Button';
import Card from '@/components/common/Card';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import EmptyState from '@/components/common/EmptyState';
import { addUser, deleteUser, getUsers } from '@/lib/actions/auth';
import { addUserSchema, type AddUserForm } from '@/lib/auth/schema';
import styles from './page.module.scss';

interface UserRow {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<UserRow | null>(null);

  const form = useForm<AddUserForm>({
    resolver: zodResolver(addUserSchema),
  });

  const loadUsers = useCallback(async () => {
    const data = await getUsers();
    setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const onAddUser = async (data: AddUserForm) => {
    setAddError(null);
    const result = await addUser(data);
    if (result.error) {
      setAddError(result.error);
      return;
    }
    form.reset();
    await loadUsers();
  };

  const onDeleteConfirm = async () => {
    if (!confirmTarget) return;
    setDeleteError(null);
    setDeletingId(confirmTarget.id);
    const result = await deleteUser(confirmTarget.id);
    setDeletingId(null);
    setConfirmTarget(null);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    await loadUsers();
  };

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const memberCount = users.filter((u) => u.role === 'member').length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Admin</span>
        <h1 className={styles.title}>사용자 관리</h1>
        <p className={styles.description}>
          시스템에 등록된 사용자를 조회하고 관리합니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <Icon icon="solar:users-group-two-rounded-linear" width={20} height={20} className={styles.statIcon} />
          <div className={styles.statBody}>
            <span className={styles.statValue}>{users.length}</span>
            <span className={styles.statLabel}>전체 사용자</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <Icon icon="solar:shield-user-linear" width={20} height={20} className={`${styles.statIcon} ${styles.statIconAccent}`} />
          <div className={styles.statBody}>
            <span className={styles.statValue}>{adminCount}</span>
            <span className={styles.statLabel}>관리자</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <Icon icon="solar:user-linear" width={20} height={20} className={styles.statIcon} />
          <div className={styles.statBody}>
            <span className={styles.statValue}>{memberCount}</span>
            <span className={styles.statLabel}>멤버</span>
          </div>
        </div>
      </div>

      {/* 사용자 추가 폼 */}
      <Card className={styles.addCard}>
        <div className={styles.cardHeader}>
          <Icon icon="solar:user-plus-linear" width={18} height={18} />
          <h2 className={styles.cardTitle}>사용자 초대</h2>
        </div>
        <form
          onSubmit={form.handleSubmit(onAddUser, () => form.setFocus('email'))}
          noValidate
          className={styles.addForm}
        >
          <div className={styles.addFields}>
            <div className={styles.fieldGroup}>
              <label htmlFor="invite-email" className={styles.fieldLabel}>이메일</label>
              <input
                id="invite-email"
                type="email"
                placeholder="team@example.com"
                className={`${styles.input} ${form.formState.errors.email ? styles.inputError : ''}`}
                aria-invalid={!!form.formState.errors.email}
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className={styles.fieldError} role="alert">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="invite-pw" className={styles.fieldLabel}>초기 비밀번호</label>
              <input
                id="invite-pw"
                type="password"
                placeholder="8자 이상"
                className={`${styles.input} ${form.formState.errors.password ? styles.inputError : ''}`}
                aria-invalid={!!form.formState.errors.password}
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className={styles.fieldError} role="alert">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={form.formState.isSubmitting}
              leftIcon="solar:user-plus-linear"
              className={styles.addBtn}
            >
              {form.formState.isSubmitting ? '추가 중...' : '초대'}
            </Button>
          </div>
          {addError && (
            <p className={styles.formError} role="alert">
              <Icon icon="solar:danger-circle-linear" width={14} height={14} />
              {addError}
            </p>
          )}
        </form>
      </Card>

      {/* 사용자 목록 */}
      <Card className={styles.tableCard}>
        <div className={styles.cardHeader}>
          <Icon icon="solar:users-group-two-rounded-linear" width={18} height={18} />
          <h2 className={styles.cardTitle}>사용자 목록</h2>
        </div>

        {deleteError && (
          <p className={styles.formError} role="alert" style={{ marginBottom: '12px' }}>
            <Icon icon="solar:danger-circle-linear" width={14} height={14} />
            {deleteError}
          </p>
        )}

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} aria-label="로딩 중" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon="solar:users-group-two-rounded-linear"
            title="등록된 사용자가 없습니다"
            description="위 폼으로 첫 번째 팀원을 초대하세요."
          />
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>사용자</th>
                  <th className={styles.th}>역할</th>
                  <th className={styles.th}>가입일</th>
                  <th className={`${styles.th} ${styles.thAction}`}>
                    <span className="sr-only">관리</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={styles.tr}>
                    <td className={styles.td}>
                      <div className={styles.userCell}>
                        <div className={styles.userAvatar}>
                          <Icon icon="solar:user-circle-linear" width={20} height={20} />
                        </div>
                        <span className={styles.userEmail}>{user.email}</span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.roleBadge} ${user.role === 'admin' ? styles.roleAdmin : styles.roleMember}`}>
                        {user.role === 'admin' ? '관리자' : '멤버'}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.dateText}>{formatDate(user.createdAt)}</span>
                    </td>
                    <td className={`${styles.td} ${styles.tdAction}`}>
                      {user.role !== 'admin' && (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => setConfirmTarget(user)}
                          disabled={deletingId === user.id}
                          aria-label={`${user.email} 삭제`}
                        >
                          {deletingId === user.id ? (
                            <div className={styles.miniSpinner} />
                          ) : (
                            <Icon icon="solar:trash-bin-trash-linear" width={15} height={15} />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ConfirmDialog
        isOpen={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={onDeleteConfirm}
        title="사용자 삭제"
        message={`${confirmTarget?.email} 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="danger"
        loading={deletingId !== null}
      />
    </div>
  );
}
