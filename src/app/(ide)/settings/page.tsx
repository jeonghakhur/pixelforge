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
import { saveFigmaToken, checkFigmaToken } from '@/lib/actions/settings';
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

type SettingsTab = 'general' | 'team' | 'figma';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

// TODO: replace with real data
const teamMembers: TeamMember[] = [];

export default function SettingsPage() {
  const activeTab = useUIStore((s) => s.activeTab) as SettingsTab;
  const setTab = useUIStore((s) => s.setTab);
  const [maskedToken, setMaskedToken] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [projectSaved, setProjectSaved] = useState(false);

  const validTab = ['general', 'team', 'figma'].includes(activeTab) ? activeTab : 'general';

  const tokenForm = useForm<TokenForm>({
    resolver: zodResolver(tokenSchema),
  });

  const projectForm = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: 'PixelForge' },
  });

  useEffect(() => {
    checkFigmaToken().then((res) => {
      if (res.hasToken) {
        setMaskedToken(res.maskedToken);
      }
    });
  }, []);

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

              {/* Invite form */}
              <div className={styles.inviteForm}>
                <div className={styles.inputRow}>
                  <div className={styles.inputWrapper}>
                    <input
                      type="email"
                      placeholder="team@pixelforge.dev"
                      className={styles.input}
                      aria-label="팀원 이메일"
                    />
                  </div>
                  <Button variant="primary" leftIcon="solar:user-plus-linear">
                    초대
                  </Button>
                </div>
              </div>

              {/* Team list */}
              {teamMembers.length === 0 ? (
                <div className={styles.emptyTeam}>
                  <EmptyState
                    icon="solar:users-group-two-rounded-linear"
                    title="팀원이 없습니다"
                    description="이메일을 입력하여 팀원을 초대하세요."
                  />
                </div>
              ) : (
                <ul className={styles.memberList}>
                  {teamMembers.map((member) => (
                    <li key={member.id} className={styles.memberItem}>
                      <div className={styles.memberAvatar}>
                        <Icon icon="solar:user-circle-linear" width={24} height={24} />
                      </div>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{member.name}</span>
                        <span className={styles.memberEmail}>{member.email}</span>
                      </div>
                      <span className={styles.memberRole}>{member.role}</span>
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
        </div>
      )}
    </div>
  );
}
