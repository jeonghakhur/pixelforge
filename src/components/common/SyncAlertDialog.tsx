'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Modal from './Modal';
import { useUIStore } from '@/stores/useUIStore';

export default function SyncAlertDialog() {
  const router = useRouter();
  const syncAlert = useUIStore((s) => s.syncAlert);
  const setSyncAlert = useUIStore((s) => s.setSyncAlert);

  const handleClose = useCallback(() => {
    setSyncAlert(null);
  }, [setSyncAlert]);

  const handleNavigate = useCallback(() => {
    if (!syncAlert) return;
    setSyncAlert(null);
    if (syncAlert.type === 'tokens') {
      router.push('/tokens/color');
    } else if (syncAlert.type === 'component' && syncAlert.name) {
      router.push(`/components/${encodeURIComponent(syncAlert.name)}`);
    } else {
      router.push('/components');
    }
    router.refresh();
  }, [syncAlert, setSyncAlert, router]);

  if (!syncAlert) return null;

  const isTokens = syncAlert.type === 'tokens';
  const isCreate = syncAlert.action === 'create';

  const icon = isTokens
    ? 'solar:pallete-2-linear'
    : 'solar:widget-2-linear';

  const title = isTokens
    ? 'Figma 토큰 동기화 완료'
    : `컴포넌트 ${isCreate ? '생성' : '업데이트'} 완료`;

  const message = isTokens
    ? `${syncAlert.count ?? 0}개의 토큰이 동기화되었습니다.`
    : `${syncAlert.name ?? '컴포넌트'}가 ${isCreate ? '생성' : '업데이트'}되었습니다. (v${syncAlert.version ?? 1})`;

  const description = syncAlert.type === 'component' && isCreate
    ? `${message} TSX 및 CSS Module 코드가 자동 생성되었습니다.`
    : message;

  const navigateLabel = isTokens ? '토큰 보기' : '컴포넌트 보기';

  return (
    <Modal
      isOpen
      onClose={handleClose}
      title={title}
      description={description}
      icon={icon}
      variant="success"
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="modal-btn modal-btn-cancel"
            onClick={handleClose}
          >
            닫기
          </button>
          <button
            type="button"
            className="modal-btn modal-btn-confirm"
            onClick={handleNavigate}
          >
            {navigateLabel}
          </button>
        </>
      }
    />
  );
}
