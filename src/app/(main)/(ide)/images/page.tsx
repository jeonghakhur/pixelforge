export const dynamic = 'force-dynamic';

import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { syncPayloads, projects } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getActiveProjectId } from '@/lib/db/active-project';
import { getImageStoragePath } from '@/lib/actions/settings';
import { IMAGE_STORAGE_DEFAULT } from '@/lib/constants/images';
import { Icon } from '@iconify/react';
import ImageGrid from './ImageGrid';
import styles from './page.module.scss';

interface ImageMeta {
  name: string;
  fileName: string;
  mimeType: string;
  scale?: number;
  url: string;
}

function scanFilesystem(storagePath: string, projectId: string): ImageMeta[] {
  const dir = path.join(process.cwd(), storagePath, projectId);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((f) => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f))
    .map((fileName) => ({
      name: fileName.replace(/\.[^.]+$/, ''),
      fileName,
      mimeType: fileName.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
      url: `/${storagePath.replace(/^public\//, '')}/${projectId}/${fileName}`,
    }));
}

export default async function ImagesPage() {
  const projectId = getActiveProjectId();
  const storagePath = await getImageStoragePath();

  if (!projectId) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <Icon icon="solar:gallery-minimalistic-linear" width={32} height={32} />
          <p>활성 프로젝트가 없습니다.</p>
        </div>
      </div>
    );
  }

  const project = db.select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  // DB 메타데이터 조회 (최신 버전)
  const payload = db.select({ data: syncPayloads.data, version: syncPayloads.version, createdAt: syncPayloads.createdAt })
    .from(syncPayloads)
    .where(and(eq(syncPayloads.projectId, projectId), eq(syncPayloads.type, 'images')))
    .orderBy(desc(syncPayloads.version))
    .limit(1)
    .get();

  let images: ImageMeta[] = [];
  let isLegacy = false;

  if (payload) {
    try {
      const parsed = JSON.parse(payload.data) as unknown[];
      // 빈 배열이면 신형 포맷(삭제 후 상태), base64 필드가 있으면 구형
      if (parsed.length === 0 || 'url' in (parsed[0] as object)) {
        images = parsed as ImageMeta[];
      } else {
        isLegacy = true;
        // 구형 데이터: 파일 시스템 스캔으로 대체
        images = scanFilesystem(storagePath, projectId);
      }
    } catch {
      images = scanFilesystem(storagePath, projectId);
    }
  } else {
    images = scanFilesystem(storagePath, projectId);
  }

  const syncedAt = payload?.createdAt ? new Date((payload.createdAt as unknown as number) * 1000) : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.eyebrow}>Plugin Assets</span>
          <h1 className={styles.title}>Images</h1>
          <p className={styles.description}>
            Figma 플러그인에서 전송된 이미지 에셋입니다.
            {syncedAt && (
              <> · 마지막 동기화 {syncedAt.toLocaleString('ko-KR')}</>
            )}
          </p>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.badge}>
            <Icon icon="solar:gallery-minimalistic-linear" width={14} height={14} />
            {images.length}개
          </span>
          {storagePath !== IMAGE_STORAGE_DEFAULT && (
            <span className={styles.pathBadge} title={storagePath}>
              <Icon icon="solar:folder-linear" width={14} height={14} />
              {storagePath}
            </span>
          )}
        </div>
      </div>

      {isLegacy && (
        <div className={styles.legacyWarning}>
          <Icon icon="solar:info-circle-linear" width={16} height={16} />
          구형 포맷으로 저장된 데이터입니다. 플러그인에서 다시 전송하면 파일 시스템 저장 방식으로 전환됩니다.
        </div>
      )}

      {images.length === 0 ? (
        <div className={styles.empty}>
          <Icon icon="solar:gallery-minimalistic-linear" width={32} height={32} className={styles.emptyIcon} />
          <p>이미지가 없습니다.</p>
          <p className={styles.emptyHint}>Figma 플러그인에서 이미지를 전송하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <ImageGrid images={images} projectName={project?.name ?? projectId} />
      )}
    </div>
  );
}
