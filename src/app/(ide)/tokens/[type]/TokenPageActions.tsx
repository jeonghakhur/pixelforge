'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { deleteTokensByTypeAction } from '@/lib/actions/tokens';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import ToastContainer, { type ToastItem } from '@/components/common/Toast';
import { useUIStore } from '@/stores/useUIStore';
import CssPreviewModal from './CssPreviewModal';
import styles from './page.module.scss';

import { TOKEN_TYPE_MAP } from '@/lib/tokens/token-types';

interface TokenPageActionsProps {
  type: string;
  count: number;
}

export default function TokenPageActions({ type, count }: TokenPageActionsProps) {
  const router = useRouter();
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cssPreviewOpen, setCssPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const typeConfig = TOKEN_TYPE_MAP[type];

  const handleConfirm = async () => {
    setLoading(true);
    await deleteTokensByTypeAction(type);
    setLoading(false);
    setDialogOpen(false);
    invalidateTokens();
    router.refresh();
  };

  if (count === 0) return null;

  return (
    <>
      {/* CSS 보기 */}
      <button
        type="button"
        className={styles.cssViewBtn}
        onClick={() => setCssPreviewOpen(true)}
        aria-label="CSS 변수 코드 미리보기"
      >
        <Icon icon="solar:code-linear" width={14} height={14} />
        CSS 보기
      </button>

      {/* 전체 삭제 */}
      <button
        type="button"
        className={styles.deleteAllBtn}
        onClick={() => setDialogOpen(true)}
        aria-label={`${typeConfig?.label ?? type} 토큰 전체 삭제`}
      >
        <Icon icon="solar:trash-bin-2-linear" width={14} height={14} />
        전체 삭제
      </button>

      <CssPreviewModal
        isOpen={cssPreviewOpen}
        onClose={() => setCssPreviewOpen(false)}
      />

      <ConfirmDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handleConfirm}
        title="전체 삭제 확인"
        message={`${typeConfig?.label ?? type} 토큰 ${count}개를 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="전체 삭제"
        loading={loading}
      />

      <ToastContainer
        toasts={toasts}
        onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </>
  );
}
