'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { deleteTokenScreenshotsAction, captureTokenPageScreenshotAction, captureFigmaFrameAction } from '@/lib/actions/tokens';
import styles from './page.module.scss';

interface CompareActionsProps {
  type: string;
  figmaKey: string | null;
  figmaUrl: string | null;
}

export default function CompareActions({ type, figmaKey, figmaUrl }: CompareActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await deleteTokenScreenshotsAction(type);
    setDeleting(false);
    router.refresh();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const tasks: Promise<unknown>[] = [captureTokenPageScreenshotAction(type)];
    if (figmaKey && figmaUrl) {
      const { extractNodeId } = await import('@/lib/figma/api');
      const nodeId = extractNodeId(figmaUrl);
      tasks.push(captureFigmaFrameAction(type, figmaKey, nodeId));
    }
    await Promise.allSettled(tasks);
    setRefreshing(false);
    router.refresh();
  };

  return (
    <div className={styles.compareActions}>
      <button
        type="button"
        className={styles.compareRefreshBtn}
        onClick={handleRefresh}
        disabled={refreshing || deleting}
        aria-label="스크린샷 다시 캡처"
      >
        <Icon
          icon={refreshing ? 'solar:refresh-linear' : 'solar:camera-linear'}
          width={13}
          height={13}
          className={refreshing ? styles.spinning : undefined}
        />
        {refreshing ? '캡처 중...' : '다시 캡처'}
      </button>

      <button
        type="button"
        className={styles.compareDeleteBtn}
        onClick={handleDelete}
        disabled={deleting || refreshing}
        aria-label="스크린샷 삭제"
      >
        <Icon icon="solar:trash-bin-2-linear" width={13} height={13} />
        {deleting ? '삭제 중...' : '삭제'}
      </button>
    </div>
  );
}
