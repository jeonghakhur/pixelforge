export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { syncPayloads, projects } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getActiveProjectId } from '@/lib/db/active-project';
import { getIconOutputPath } from '@/lib/actions/settings';
import { Icon } from '@iconify/react';
import IconGrid, { type IconEntry } from './IconGrid';
import IconPageActions from './IconPageActions';
import styles from './page.module.scss';

export default async function IconsPage() {
  const projectId = getActiveProjectId();
  const outputPath = await getIconOutputPath();

  if (!projectId) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <Icon icon="solar:sticker-circle-linear" width={32} height={32} className={styles.emptyIcon} />
          <p>활성 프로젝트가 없습니다.</p>
        </div>
      </div>
    );
  }

  const project = db.select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  const payload = db.select({ data: syncPayloads.data, version: syncPayloads.version, createdAt: syncPayloads.createdAt })
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), eq(syncPayloads.type, 'icons')))
    .orderBy(desc(syncPayloads.version))
    .limit(1)
    .get();

  let icons: IconEntry[] = [];
  if (payload) {
    try {
      icons = JSON.parse(payload.data) as IconEntry[];
    } catch {
      icons = [];
    }
  }

  const syncedAt = payload?.createdAt ? new Date((payload.createdAt as unknown as number) * 1000) : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.eyebrow}>Plugin Assets</span>
          <h1 className={styles.title}>Icons</h1>
          <p className={styles.description}>
            {project?.name ?? projectId}의 Figma 아이콘 세트 · {icons.length}개
            {syncedAt && <> · 마지막 동기화 {syncedAt.toLocaleString('ko-KR')}</>}
          </p>
        </div>
        <div className={styles.headerActions}>
          <IconPageActions count={icons.length} />
        </div>
      </div>

      {icons.length === 0 ? (
        <div className={styles.empty}>
          <Icon icon="solar:sticker-circle-linear" width={32} height={32} className={styles.emptyIcon} />
          <p>아이콘이 없습니다.</p>
          <p className={styles.emptyHint}>Figma 플러그인 아이콘 탭에서 추출 후 &quot;PixelForge로 전송&quot;을 클릭하세요.</p>
        </div>
      ) : (
        <IconGrid icons={icons} outputPath={outputPath} />
      )}
    </div>
  );
}
