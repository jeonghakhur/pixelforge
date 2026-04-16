'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteTokensByTypeAction } from '@/lib/actions/tokens';
import { generateTextComponentAction } from '@/lib/actions/components';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import ToastContainer, { type ToastItem } from '@/components/common/Toast';
import Button from '@/components/common/Button';
import { useUIStore } from '@/stores/useUIStore';
import CssPreviewModal from './CssPreviewModal';
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
  const [generating, setGenerating] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const typeConfig = TOKEN_TYPE_MAP[type];

  const handleGenerateText = async () => {
    setGenerating(true);
    const result = await generateTextComponentAction();
    setGenerating(false);

    if (result.error) {
      setToasts((prev) => [
        ...prev,
        { id: crypto.randomUUID(), variant: 'danger' as const, message: result.error! },
      ]);
    } else {
      const label = result.regenerated ? 'Text 컴포넌트가 재생성되었습니다.' : 'Text 컴포넌트가 생성되었습니다.';
      setToasts((prev) => [
        ...prev,
        { id: crypto.randomUUID(), variant: 'success' as const, message: label },
      ]);
      router.push(`/components/${result.component?.name ?? 'Text'}`);
    }
  };

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
      {type === 'typography' && (
        <Button
          variant="primary"
          size="sm"
          leftIcon="solar:cpu-bolt-linear"
          onClick={handleGenerateText}
          loading={generating}
          disabled={generating}
          aria-label="Typography 토큰으로 Text 컴포넌트 생성"
        >
          컴포넌트 생성
        </Button>
      )}

      <Button
        variant="secondary"
        size="sm"
        leftIcon="solar:code-linear"
        onClick={() => setCssPreviewOpen(true)}
        aria-label="CSS 변수 코드 미리보기"
      >
        CSS 보기
      </Button>

      <Button
        variant="destructive"
        size="sm"
        leftIcon="solar:trash-bin-2-linear"
        onClick={() => setDialogOpen(true)}
        disabled={loading}
        aria-label={`${typeConfig?.label ?? type} 토큰 전체 삭제`}
      >
        전체 삭제
      </Button>

      <CssPreviewModal
        isOpen={cssPreviewOpen}
        onClose={() => setCssPreviewOpen(false)}
        filterType={type}
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
