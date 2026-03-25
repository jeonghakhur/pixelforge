// @page Pages — Figma 파일 관리
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { getRecentProjects, deleteProject, type RecentProject } from '@/lib/actions/project';
import { useUIStore } from '@/stores/useUIStore';
import EmptyState from '@/components/common/EmptyState';
import styles from './page.module.scss';

const TOKEN_META = [
  { key: 'colors'     as const, icon: 'solar:palette-linear',    label: '색상'  },
  { key: 'typography' as const, icon: 'solar:text-field-linear', label: '타이포' },
  { key: 'spacing'    as const, icon: 'solar:ruler-linear',      label: '간격'  },
  { key: 'radius'     as const, icon: 'solar:crop-linear',       label: '반경'  },
];

function formatDate(date: Date): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return `${d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + '/' : ''}${d.getMonth() + 1}/${d.getDate()}`;
}

export default function PagesPage() {
  const router = useRouter();
  const setPreloadUrl = useUIStore((s) => s.setPreloadUrl);
  const setSection = useUIStore((s) => s.setSection);

  const [projectList, setProjectList] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    getRecentProjects().then(setProjectList).finally(() => setLoading(false));
  }, []);

  const handleReExtract = (project: RecentProject) => {
    if (!project.figmaUrl) return;
    setPreloadUrl(project.figmaUrl);
    setSection('home');
    router.push('/');
  };

  const handleDeleteConfirm = async (id: string) => {
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteProject(id);
    if (res.error) {
      setDeleteError(res.error);
    } else {
      setProjectList((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirmId(null);
    }
    setDeleting(false);
  };

  const totalTokens = (p: RecentProject) => p.colors + p.typography + p.spacing + p.radius;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Figma Files</span>
        <h1 className={styles.title}>파일 관리</h1>
        <p className={styles.description}>
          분석된 Figma 파일 목록입니다. 다시 추출하거나 삭제할 수 있습니다.
        </p>
      </div>

      {deleteError && (
        <p className={styles.errorBanner} role="alert">{deleteError}</p>
      )}

      {loading ? (
        <div className={styles.loadingWrap}>
          <Icon icon="solar:spinner-linear" width={20} height={20} className={styles.spinIcon} />
        </div>
      ) : projectList.length === 0 ? (
        <div className={styles.stage}>
          <div className={styles.stageInner}>
            <EmptyState
              icon="solar:figma-linear"
              title="분석된 파일이 없습니다"
              description="홈에서 Figma URL을 입력하여 파일을 분석하세요."
            />
          </div>
        </div>
      ) : (
        <div className={styles.projectList}>
          {projectList.map((project) => (
            <div key={project.id} className={styles.projectCard}>
              <div className={styles.projectCardInner}>
                {/* 아이콘 */}
                <div className={styles.projectIconWrap}>
                  <Icon icon="solar:figma-linear" width={18} height={18} />
                </div>

                {/* 정보 */}
                <div className={styles.projectInfo}>
                  <span className={styles.projectName}>{project.name}</span>
                  {project.figmaUrl && (
                    <span className={styles.projectUrl}>
                      {project.figmaUrl.replace('https://www.figma.com/', 'figma.com/')}
                    </span>
                  )}
                  <div className={styles.tokenStats}>
                    {TOKEN_META.map((m) => (
                      project[m.key] > 0 ? (
                        <span key={m.key} className={styles.tokenStat}>
                          <Icon icon={m.icon} width={12} height={12} />
                          {project[m.key]}
                        </span>
                      ) : null
                    ))}
                    {totalTokens(project) === 0 && (
                      <span className={styles.noTokens}>토큰 없음</span>
                    )}
                  </div>
                </div>

                {/* 날짜 + 액션 */}
                <div className={styles.projectRight}>
                  <span className={styles.projectDate}>{formatDate(project.updatedAt)}</span>
                  <div className={styles.projectActions}>
                    {deleteConfirmId === project.id ? (
                      <>
                        <button
                          type="button"
                          className={styles.confirmDeleteBtn}
                          onClick={() => handleDeleteConfirm(project.id)}
                          disabled={deleting}
                        >
                          삭제 확인
                        </button>
                        <button
                          type="button"
                          className={styles.cancelBtn}
                          onClick={() => setDeleteConfirmId(null)}
                          disabled={deleting}
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => handleReExtract(project)}
                          title="다시 추출"
                          aria-label="다시 추출"
                        >
                          <Icon icon="solar:refresh-linear" width={14} height={14} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          onClick={() => setDeleteConfirmId(project.id)}
                          title="삭제"
                          aria-label="삭제"
                        >
                          <Icon icon="solar:trash-bin-minimalistic-linear" width={14} height={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
