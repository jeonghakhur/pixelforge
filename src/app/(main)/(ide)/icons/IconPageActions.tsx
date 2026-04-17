'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@iconify/react';
import { deleteAllIcons } from '@/lib/actions/icons';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import styles from './page.module.scss';

interface IconPageActionsProps {
  count: number;
}

export default function IconPageActions({ count }: IconPageActionsProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await deleteAllIcons();
      if (!result.error) {
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <button
        type="button"
        className={styles.deleteAllBtn}
        onClick={() => setOpen(true)}
        disabled={count === 0}
      >
        <Icon icon="solar:trash-bin-2-linear" width={14} height={14} />
        전체 삭제
      </button>

      <ConfirmDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="아이콘 전체 삭제"
        message={`${count}개 아이콘을 모두 삭제합니다. DB 데이터와 생성된 파일이 함께 삭제되며 되돌릴 수 없습니다.`}
        confirmLabel="전체 삭제"
        variant="destructive"
        loading={isPending}
      />
    </>
  );
}
