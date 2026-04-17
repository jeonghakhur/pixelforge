export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getActiveProjectId } from '@/lib/db/active-project';
import { getIconOutputPath } from '@/lib/actions/settings';
import { getAllIcons } from '@/lib/actions/icons';
import { Icon } from '@iconify/react';
import IconGrid from './IconGrid';
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

  const { icons, syncedAt } = await getAllIcons();

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
          <IconPageActions
            count={icons.length}
            sections={[...new Set(icons.map((i) => i.section).filter(Boolean) as string[])]}
          />
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
