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
import { saveFigmaToken, checkFigmaToken, saveProjectFigmaUrl, getProjectFigmaUrl } from '@/lib/actions/settings';
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

type SettingsTab = 'general' | 'account' | 'team' | 'figma';

interface UserRow {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
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

  const validTab = ['general', 'account', 'team', 'figma'].includes(activeTab) ? activeTab : 'general';
  const [users, setUsers] = useState<UserRow[]>([]);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [changePwSuccess, setChangePwSuccess] = useState(false);
  const [changePwError, setChangePwError] = useState<string | null>(null);

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
    </div>
  );
}
