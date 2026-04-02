// @page Settings — 설정 (일반/팀원/Figma 탭)
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Icon } from '@iconify/react';
import Button from '@/components/common/Button';
import Card from '@/components/common/Card';
import EmptyState from '@/components/common/EmptyState';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import ToastContainer, { type ToastItem } from '@/components/common/Toast';
import { saveFigmaToken, checkFigmaToken, saveProjectFigmaUrl, getProjectFigmaUrl } from '@/lib/actions/settings';
import { createApiKey, getApiKeys, deleteApiKey } from '@/lib/actions/api-keys';
import { getSyncStatus, type SyncProjectStatus, type SyncItem } from '@/lib/actions/sync-status';
import { getSnapshotListAction, rollbackSnapshotAction, type SnapshotInfo } from '@/lib/actions/tokens';
import { addUser, deleteUser, getUsers, changePassword } from '@/lib/actions/auth';
import { addUserSchema, changePasswordSchema, type AddUserForm, type ChangePasswordForm } from '@/lib/auth/schema';
import { useUIStore } from '@/stores/useUIStore';
import styles from './page.module.scss';

const tokenSchema = z.object({
  token: z.string().min(1, 'API 토큰을 입력해주세요'),
});

type TokenForm = z.infer<typeof tokenSchema>;

const projectSchema = z.object({
  name: z.string().min(1, '프로젝트명을 입력해주세요').max(100),
});

type ProjectForm = z.infer<typeof projectSchema>;

const figmaUrlSchema = z.object({
  figmaUrl: z
    .string()
    .min(1, 'Figma 파일 URL을 입력해주세요')
    .url('올바른 URL 형식이 아닙니다')
    .refine((v) => v.includes('figma.com'), 'Figma URL을 입력해주세요'),
});

type FigmaUrlForm = z.infer<typeof figmaUrlSchema>;

type SettingsTab = 'general' | 'account' | 'team' | 'figma' | 'tokens';

interface ApiKeyRow {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

interface UserRow {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
}

const SYNC_TYPE_LABEL: Record<string, string> = {
  tokens: '토큰',
  icons: '아이콘',
  images: '이미지',
  themes: '테마',
  components: '컴포넌트',
};

function relativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(date).toLocaleDateString();
}

export default function SettingsPage() {
  const activeTab = useUIStore((s) => s.activeTab) as SettingsTab;
  const setTab = useUIStore((s) => s.setTab);
  const [maskedToken, setMaskedToken] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [projectSaved, setProjectSaved] = useState(false);
  const [savedFigmaUrl, setSavedFigmaUrl] = useState<string | null>(null);
  const [figmaUrlSaved, setFigmaUrlSaved] = useState(false);
  const [figmaUrlError, setFigmaUrlError] = useState<string | null>(null);

  const validTab = ['general', 'account', 'team', 'figma', 'tokens'].includes(activeTab) ? activeTab : 'general';
  const [users, setUsers] = useState<UserRow[]>([]);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [changePwSuccess, setChangePwSuccess] = useState(false);
  const [changePwError, setChangePwError] = useState<string | null>(null);
  const [apiKeyList, setApiKeyList] = useState<ApiKeyRow[]>([]);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncProjectStatus[]>([]);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [snapshotList, setSnapshotList] = useState<SnapshotInfo[]>([]);
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);
  const [confirmSnapshot, setConfirmSnapshot] = useState<{ id: string; projectId: string } | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (message: string, variant: ToastItem['variant'] = 'danger') => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), variant, message }]);
  };

  const tokenForm = useForm<TokenForm>({
    resolver: zodResolver(tokenSchema),
  });

  const figmaUrlForm = useForm<FigmaUrlForm>({
    resolver: zodResolver(figmaUrlSchema),
  });

  const projectForm = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: 'PixelForge' },
  });

  const addUserForm = useForm<AddUserForm>({
    resolver: zodResolver(addUserSchema),
  });

  const changePwForm = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  });

  useEffect(() => {
    getApiKeys().then((keys) => setApiKeyList(keys as ApiKeyRow[]));
    getSyncStatus().then(setSyncStatus);
  }, []);

  useEffect(() => {
    checkFigmaToken().then((res) => {
      if (res.hasToken) setMaskedToken(res.maskedToken);
    });
    getProjectFigmaUrl().then((res) => {
      if (res.url) {
        setSavedFigmaUrl(res.url);
        figmaUrlForm.reset({ figmaUrl: res.url });
      }
    });
  // figmaUrlForm은 마운트 시 한 번만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (validTab === 'team') {
      getUsers().then(setUsers);
    }
  }, [validTab]);

  const onAddUser = async (data: AddUserForm) => {
    setAddUserError(null);
    const result = await addUser(data);
    if (result.error) {
      setAddUserError(result.error);
      return;
    }
    addUserForm.reset();
    const updated = await getUsers();
    setUsers(updated);
  };

  const onDeleteUser = async (userId: string) => {
    const result = await deleteUser(userId);
    if (!result.error) {
      const updated = await getUsers();
      setUsers(updated);
    }
  };

  const onToggleSnapshots = async (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      setSnapshotList([]);
      return;
    }
    setExpandedProjectId(projectId);
    const list = await getSnapshotListAction(projectId);
    setSnapshotList(list);
  };

  const onRollbackConfirm = async () => {
    if (!confirmSnapshot) return;
    const { id: snapshotId, projectId } = confirmSnapshot;
    setConfirmSnapshot(null);
    setRollbackLoading(snapshotId);
    const result = await rollbackSnapshotAction(snapshotId);
    if (result.error) {
      addToast(result.error, 'danger');
    } else {
      const [updated, list] = await Promise.all([
        getSyncStatus(),
        getSnapshotListAction(projectId),
      ]);
      setSyncStatus(updated);
      setSnapshotList(list);
      if (list.length === 0) setExpandedProjectId(null);
      addToast(
        result.restoredVersion ? `v${result.restoredVersion}으로 복원되었습니다.` : '스냅샷이 삭제되었습니다.',
        'success',
      );
    }
    setRollbackLoading(null);
  };

  const onChangePassword = async (data: ChangePasswordForm) => {
    setChangePwError(null);
    setChangePwSuccess(false);
    const result = await changePassword(data);
    if (result.error) {
      setChangePwError(result.error);
      return;
    }
    setChangePwSuccess(true);
    changePwForm.reset();
    setTimeout(() => setChangePwSuccess(false), 3000);
  };

  const onFigmaUrlSubmit = async (data: FigmaUrlForm) => {
    setFigmaUrlError(null);
    setFigmaUrlSaved(false);
    const res = await saveProjectFigmaUrl(data.figmaUrl);
    if (res.error) {
      setFigmaUrlError(res.error);
      return;
    }
    setSavedFigmaUrl(data.figmaUrl);
    setFigmaUrlSaved(true);
    setTimeout(() => setFigmaUrlSaved(false), 3000);
  };

  const onTokenSubmit = async (data: TokenForm) => {
    setServerError(null);
    setSaved(false);
    const res = await saveFigmaToken(data.token);
    if (res.error) {
      setServerError(res.error);
      return;
    }
    setSaved(true);
    tokenForm.reset({ token: '' });
    const updated = await checkFigmaToken();
    setMaskedToken(updated.maskedToken);
    setTimeout(() => setSaved(false), 3000);
  };

  const onCreateApiKey = async () => {
    setApiKeyError(null);
    setCreatedKey(null);
    const res = await createApiKey(newApiKeyName);
    if (res.error) { setApiKeyError(res.error); return; }
    setCreatedKey(res.key!);
    setNewApiKeyName('');
    const updated = await getApiKeys();
    setApiKeyList(updated as ApiKeyRow[]);
  };

  const onDeleteApiKey = async (id: string) => {
    await deleteApiKey(id);
    const updated = await getApiKeys();
    setApiKeyList(updated as ApiKeyRow[]);
    if (createdKey) setCreatedKey(null);
  };

  const onProjectSubmit = async (data: ProjectForm) => {
    void data;
    setProjectSaved(true);
    setTimeout(() => setProjectSaved(false), 3000);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Settings</span>
        <h1 className={styles.title}>설정</h1>
        <p className={styles.description}>
          프로젝트 설정, 팀원 관리, Figma API 연동을 구성합니다.
        </p>
      </div>

      {/* Tab content based on TabBar selection */}
      {validTab === 'general' && (
        <div className={styles.tabContent}>
          <Card className={styles.settingsCard}>
            <div className={styles.settingsContent}>
              <div className={styles.settingsLabel}>
                <Icon icon="solar:folder-linear" width={20} height={20} />
                <div>
                  <h2 className={styles.settingsTitle}>프로젝트 정보</h2>
                  <p className={styles.settingsDesc}>
                    프로젝트의 기본 정보를 설정합니다.
                  </p>
                </div>
              </div>

              <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} noValidate>
                <div className={styles.formGroup}>
                  <label htmlFor="project-name" className={styles.formLabel}>
                    프로젝트명
                  </label>
                  <div className={styles.inputRow}>
                    <div className={styles.inputWrapper}>
                      <input
                        id="project-name"
                        type="text"
                        className={styles.input}
                        {...projectForm.register('name')}
                      />
                    </div>
                    <Button type="submit" leftIcon="solar:check-circle-linear">
                      저장
                    </Button>
                  </div>
                  {projectSaved && (
                    <p className={styles.success} role="status">
                      <Icon icon="solar:check-circle-bold" width={14} height={14} />
                      프로젝트 정보가 저장되었습니다.
                    </p>
                  )}
                </div>
              </form>
            </div>
          </Card>

          {/* API 키 관리 */}
          <Card className={styles.settingsCard}>
            <div className={styles.settingsContent}>
              <div className={styles.settingsLabel}>
                <Icon icon="solar:key-minimalistic-linear" width={20} height={20} />
                <div>
                  <h2 className={styles.settingsTitle}>Figma 플러그인 API 키</h2>
                  <p className={styles.settingsDesc}>
                    Figma 플러그인에서 PixelForge로 데이터를 전송할 때 사용하는 API 키입니다.
                  </p>
                </div>
              </div>
              {createdKey && (
                <div className={styles.currentToken} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-success, #22c55e)', fontWeight: 600 }}>
                    키가 생성되었습니다. 지금 복사하세요 — 다시 표시되지 않습니다.
                  </span>
                  <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{createdKey}</code>
                </div>
              )}
              <div className={styles.inputRow}>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="키 이름 (예: 내 작업용)"
                    className={styles.input}
                    value={newApiKeyName}
                    onChange={(e) => setNewApiKeyName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onCreateApiKey(); }}
                  />
                </div>
                <Button type="button" onClick={onCreateApiKey} leftIcon="solar:add-circle-linear">
                  생성
                </Button>
              </div>
              {apiKeyError && <p className={styles.error} role="alert">{apiKeyError}</p>}
              {apiKeyList.length > 0 && (
                <ul className={styles.memberList}>
                  {apiKeyList.map((k) => (
                    <li key={k.id} className={styles.memberItem}>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{k.name}</span>
                        <span className={styles.memberEmail}>
                          생성: {new Date(k.createdAt).toLocaleDateString()}
                          {k.lastUsedAt ? ` · 최근 사용: ${new Date(k.lastUsedAt).toLocaleDateString()}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => onDeleteApiKey(k.id)}
                        aria-label={`${k.name} 삭제`}
                      >
                        <Icon icon="solar:trash-bin-trash-linear" width={16} height={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* 연동 현황 */}
          <Card className={styles.settingsCard}>
            <div className={styles.settingsContent}>
              <div className={styles.settingsLabel}>
                <Icon icon="solar:link-round-angle-linear" width={20} height={20} />
                <div>
                  <h2 className={styles.settingsTitle}>Figma 플러그인 연동 현황</h2>
                  <p className={styles.settingsDesc}>
                    플러그인에서 전송된 Figma 파일별 동기화 이력입니다.
                  </p>
                </div>
              </div>
              {syncStatus.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted, #94a3b8)' }}>
                  아직 전송된 데이터가 없습니다. Figma 플러그인에서 데이터를 전송해보세요.
                </p>
              ) : (
                <ul className={styles.memberList}>
                  {syncStatus.map((proj) => (
                    <li key={proj.id} className={styles.memberItem} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                      <span className={styles.memberName} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon icon="solar:figma-linear" width={14} height={14} />
                        {proj.name}
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'center' }}>
                        {(['tokens', 'icons', 'images', 'themes', 'components'] as const).map((type) => {
                          const item = proj.syncs.find((s) => s.type === type) as SyncItem | undefined;
                          return (
                            <span key={type} className={styles.memberEmail} style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {SYNC_TYPE_LABEL[type]}:{' '}
                              {item ? (
                                <>
                                  v{item.version} · {relativeTime(item.syncedAt)}
                                  {item.count != null ? ` (${item.count.toLocaleString()}개)` : ''}
                                  {type === 'tokens' && (
                                    <button
                                      onClick={() => onToggleSnapshots(proj.id)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--color-text-muted, #94a3b8)', display: 'inline-flex', alignItems: 'center' }}
                                      title="스냅샷 이력"
                                    >
                                      <Icon icon={expandedProjectId === proj.id ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} width={12} height={12} />
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted, #94a3b8)' }}>미전송</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                      {expandedProjectId === proj.id && snapshotList.length > 0 && (
                        <div style={{ marginTop: 8, width: '100%' }}>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted, #94a3b8)', marginBottom: 4 }}>스냅샷 이력</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {snapshotList.map((snap) => (
                              <div key={snap.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--color-surface-2, rgba(255,255,255,0.04))', borderRadius: 4 }}>
                                <span style={{ fontSize: 12, color: 'var(--color-text-secondary, #cbd5e1)' }}>
                                  v{snap.version} · {relativeTime(snap.createdAt)} · {snap.total.toLocaleString()}개
                                </span>
                                <button
                                  onClick={() => setConfirmSnapshot({ id: snap.id, projectId: proj.id })}
                                  disabled={rollbackLoading === snap.id}
                                  style={{ background: 'none', border: '1px solid var(--color-border, rgba(255,255,255,0.08))', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: 'var(--color-error, #f87171)', cursor: 'pointer', opacity: rollbackLoading === snap.id ? 0.5 : 1 }}
                                >
                                  {rollbackLoading === snap.id ? '삭제 중...' : '삭제'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      )}

      {validTab === 'account' && (
        <div className={styles.tabContent}>
          <Card className={styles.settingsCard}>
            <div className={styles.settingsContent}>
              <div className={styles.settingsLabel}>
                <Icon icon="solar:shield-user-linear" width={20} height={20} />
                <div>
                  <h2 className={styles.settingsTitle}>비밀번호 변경</h2>
                  <p className={styles.settingsDesc}>현재 비밀번호 확인 후 새 비밀번호로 변경합니다.</p>
                </div>
              </div>

              <form
                onSubmit={changePwForm.handleSubmit(onChangePassword, () =>
                  changePwForm.setFocus('currentPassword')
                )}
                noValidate
              >
                <div className={styles.formGroup}>
                  <label htmlFor="current-pw" className={styles.formLabel}>현재 비밀번호</label>
                  <input
                    id="current-pw"
                    type="password"
                    className={styles.input}
                    autoComplete="current-password"
                    aria-invalid={!!changePwForm.formState.errors.currentPassword}
                    {...changePwForm.register('currentPassword')}
                  />
                  {changePwForm.formState.errors.currentPassword && (
                    <p className={styles.error} role="alert">
                      {changePwForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="new-pw" className={styles.formLabel}>새 비밀번호</label>
                  <input
                    id="new-pw"
                    type="password"
                    className={styles.input}
                    autoComplete="new-password"
                    aria-invalid={!!changePwForm.formState.errors.newPassword}
                    {...changePwForm.register('newPassword')}
                  />
                  {changePwForm.formState.errors.newPassword && (
                    <p className={styles.error} role="alert">
                      {changePwForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="new-pw-confirm" className={styles.formLabel}>새 비밀번호 확인</label>
                  <input
                    id="new-pw-confirm"
                    type="password"
                    className={styles.input}
                    autoComplete="new-password"
                    aria-invalid={!!changePwForm.formState.errors.newPasswordConfirm}
                    {...changePwForm.register('newPasswordConfirm')}
                  />
                  {changePwForm.formState.errors.newPasswordConfirm && (
                    <p className={styles.error} role="alert">
                      {changePwForm.formState.errors.newPasswordConfirm.message}
                    </p>
                  )}
                </div>
                {changePwError && (
                  <p className={styles.error} role="alert">{changePwError}</p>
                )}
                {changePwSuccess && (
                  <p className={styles.success} role="status">
                    <Icon icon="solar:check-circle-bold" width={14} height={14} />
                    비밀번호가 변경되었습니다.
                  </p>
                )}
                <div className={styles.inputRow} style={{ marginTop: '16px' }}>
                  <Button
                    type="submit"
                    disabled={changePwForm.formState.isSubmitting}
                    leftIcon="solar:lock-check-linear"
                  >
                    {changePwForm.formState.isSubmitting ? '변경 중...' : '비밀번호 변경'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {validTab === 'team' && (
        <div className={styles.tabContent}>
          <Card className={styles.settingsCard}>
            <div className={styles.settingsContent}>
              <div className={styles.settingsLabel}>
                <Icon icon="solar:users-group-two-rounded-linear" width={20} height={20} />
                <div>
                  <h2 className={styles.settingsTitle}>팀원 관리</h2>
                  <p className={styles.settingsDesc}>
                    프로젝트에 참여하는 팀원을 관리합니다.
                  </p>
                </div>
              </div>

              {/* 사용자 추가 폼 */}
              <form
                onSubmit={addUserForm.handleSubmit(onAddUser, () =>
                  addUserForm.setFocus('email')
                )}
                noValidate
              >
                <div className={styles.formGroup}>
                  <label htmlFor="invite-email" className={styles.formLabel}>이메일</label>
                  <div className={styles.inputRow}>
                    <div className={styles.inputWrapper}>
                      <input
                        id="invite-email"
                        type="email"
                        placeholder="team@example.com"
                        className={styles.input}
                        aria-invalid={!!addUserForm.formState.errors.email}
                        {...addUserForm.register('email')}
                      />
                    </div>
                  </div>
                  {addUserForm.formState.errors.email && (
                    <p className={styles.error} role="alert">
                      {addUserForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="invite-pw" className={styles.formLabel}>초기 비밀번호</label>
                  <div className={styles.inputRow}>
                    <div className={styles.inputWrapper}>
                      <input
                        id="invite-pw"
                        type="password"
                        placeholder="8자 이상"
                        className={styles.input}
                        aria-invalid={!!addUserForm.formState.errors.password}
                        {...addUserForm.register('password')}
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={addUserForm.formState.isSubmitting}
                      leftIcon="solar:user-plus-linear"
                    >
                      {addUserForm.formState.isSubmitting ? '추가 중...' : '추가'}
                    </Button>
                  </div>
                  {addUserForm.formState.errors.password && (
                    <p className={styles.error} role="alert">
                      {addUserForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                {addUserError && (
                  <p className={styles.error} role="alert">{addUserError}</p>
                )}
              </form>

              {/* 사용자 목록 */}
              {users.length === 0 ? (
                <div className={styles.emptyTeam}>
                  <EmptyState
                    icon="solar:users-group-two-rounded-linear"
                    title="팀원이 없습니다"
                    description="이메일과 초기 비밀번호를 입력하여 팀원을 추가하세요."
                  />
                </div>
              ) : (
                <ul className={styles.memberList}>
                  {users.map((user) => (
                    <li key={user.id} className={styles.memberItem}>
                      <div className={styles.memberAvatar}>
                        <Icon icon="solar:user-circle-linear" width={24} height={24} />
                      </div>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{user.email}</span>
                        <span className={styles.memberEmail}>
                          {user.role === 'admin' ? '관리자' : '멤버'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => onDeleteUser(user.id)}
                        aria-label={`${user.email} 삭제`}
                      >
                        <Icon icon="solar:trash-bin-trash-linear" width={16} height={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      )}

      {validTab === 'figma' && (
        <div className={styles.tabContent}>
          {/* Figma 원본 파일 URL */}
          <Card className={styles.settingsCard}>
            <div className={styles.settingsContent}>
              <div className={styles.settingsLabel}>
                <Icon icon="solar:file-linear" width={20} height={20} />
                <div>
                  <h2 className={styles.settingsTitle}>Figma 원본 파일</h2>
                  <p className={styles.settingsDesc}>
                    디자인 원본 파일 URL을 등록하면 토큰 추출 시 자동으로 채워집니다.
                  </p>
                </div>
              </div>

              {savedFigmaUrl && (
                <div className={styles.currentToken}>
                  <Icon icon="solar:check-circle-linear" width={14} height={14} />
                  <span
                    className={styles.figmaUrlPreview}
                    title={savedFigmaUrl}
                  >
                    {savedFigmaUrl.length > 60
                      ? `${savedFigmaUrl.slice(0, 60)}…`
                      : savedFigmaUrl}
                  </span>
                </div>
              )}

              <form
                onSubmit={figmaUrlForm.handleSubmit(onFigmaUrlSubmit, () =>
                  figmaUrlForm.setFocus('figmaUrl')
                )}
                noValidate
              >
                <div className={styles.inputRow}>
                  <div className={styles.inputWrapper}>
                    <label htmlFor="figma-file-url" className="sr-only">
                      Figma 파일 URL
                    </label>
                    <input
                      id="figma-file-url"
                      type="url"
                      placeholder="https://www.figma.com/design/..."
                      className={styles.input}
                      aria-invalid={!!figmaUrlForm.formState.errors.figmaUrl}
                      aria-describedby={figmaUrlForm.formState.errors.figmaUrl ? 'figma-url-error' : undefined}
                      {...figmaUrlForm.register('figmaUrl')}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={figmaUrlForm.formState.isSubmitting}
                    leftIcon="solar:check-circle-linear"
                  >
                    {figmaUrlForm.formState.isSubmitting ? '저장 중...' : '저장'}
                  </Button>
                </div>
                {figmaUrlForm.formState.errors.figmaUrl && (
                  <p id="figma-url-error" className={styles.error} role="alert">
                    {figmaUrlForm.formState.errors.figmaUrl.message}
                  </p>
                )}
                {figmaUrlError && (
                  <p className={styles.error} role="alert">{figmaUrlError}</p>
                )}
                {figmaUrlSaved && (
                  <p className={styles.success} role="status">
                    <Icon icon="solar:check-circle-bold" width={14} height={14} />
                    Figma 파일 URL이 저장되었습니다.
                  </p>
                )}
              </form>
            </div>
          </Card>

          {/* Figma API 토큰 */}
          <Card className={styles.settingsCard}>
            <div className={styles.settingsContent}>
              <div className={styles.settingsLabel}>
                <Icon icon="solar:key-linear" width={20} height={20} />
                <div>
                  <h2 className={styles.settingsTitle}>Figma API 토큰</h2>
                  <p className={styles.settingsDesc}>
                    Figma 계정 설정에서 Personal Access Token을 생성하여 입력하세요.
                  </p>
                </div>
              </div>

              {maskedToken && (
                <div className={styles.currentToken}>
                  <Icon icon="solar:check-circle-linear" width={14} height={14} />
                  <span>현재 설정됨: {maskedToken}</span>
                </div>
              )}

              <form onSubmit={tokenForm.handleSubmit(onTokenSubmit, () => tokenForm.setFocus('token'))} noValidate>
                <div className={styles.inputRow}>
                  <div className={styles.inputWrapper}>
                    <label htmlFor="figma-token" className="sr-only">
                      Figma API 토큰
                    </label>
                    <input
                      id="figma-token"
                      type="password"
                      placeholder="figd_..."
                      className={styles.input}
                      aria-invalid={!!tokenForm.formState.errors.token}
                      aria-describedby={tokenForm.formState.errors.token ? 'token-error' : undefined}
                      {...tokenForm.register('token')}
                    />
                  </div>
                  <Button type="submit" disabled={tokenForm.formState.isSubmitting} leftIcon="solar:check-circle-linear">
                    {tokenForm.formState.isSubmitting ? '저장 중...' : '저장'}
                  </Button>
                </div>
                {tokenForm.formState.errors.token && (
                  <p id="token-error" className={styles.error} role="alert">
                    {tokenForm.formState.errors.token.message}
                  </p>
                )}
                {serverError && (
                  <p className={styles.error} role="alert">{serverError}</p>
                )}
                {saved && (
                  <p className={styles.success} role="status">
                    <Icon icon="solar:check-circle-bold" width={14} height={14} />
                    토큰이 저장되었습니다.
                  </p>
                )}
              </form>
            </div>
          </Card>
          {/* /Figma API 토큰 */}
        </div>
      )}

      {validTab === 'tokens' && (
        <div className={styles.tabContent}>
          <Card className={styles.settingsCard}>
            <p className={styles.settingsDesc}>
              토큰 타입 메뉴는 Figma sync 시 자동으로 생성됩니다.
              세부 관리(라벨·아이콘·순서·표시여부)는 관리자 페이지에서 할 수 있습니다.
            </p>
          </Card>
        </div>
      )}
      <ConfirmDialog
        isOpen={!!confirmSnapshot}
        onClose={() => setConfirmSnapshot(null)}
        onConfirm={onRollbackConfirm}
        title="스냅샷 삭제"
        message="이 스냅샷을 삭제하고 이전 버전으로 복원합니다. 되돌릴 수 없습니다."
        confirmLabel="삭제"
        variant="danger"
        loading={!!rollbackLoading}
      />

      <ToastContainer
        toasts={toasts}
        onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
