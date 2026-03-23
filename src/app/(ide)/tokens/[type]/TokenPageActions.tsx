'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { deleteTokensByTypeAction, exportTokensCssAction } from '@/lib/actions/tokens';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import ToastContainer, { type ToastItem } from '@/components/common/Toast';
import { useUIStore } from '@/stores/useUIStore';
import TokenExtractModal from './TokenExtractModal';
import TokenVerifyModal from './TokenVerifyModal';
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
  const [extractOpen, setExtractOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const typeConfig = TOKEN_TYPE_MAP[type];

  const addToast = (message: string, variant: ToastItem['variant'] = 'danger') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, variant }]);
  };

  const handleExtractSuccess = (_count: number) => {
    invalidateTokens();
    router.refresh();
  };

  const handleConfirm = async () => {
    setLoading(true);
    await deleteTokensByTypeAction(type);
    setLoading(false);
    setDialogOpen(false);
    invalidateTokens();
    router.refresh();
  };

  const handleExportCopy = async () => {
    setExporting(true);
    const { css, error } = await exportTokensCssAction();
    setExporting(false);
    if (error || !css) {
      addToast(error ?? 'CSS 생성에 실패했습니다.');
      return;
    }
    await navigator.clipboard.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportDownload = async () => {
    setExporting(true);
    const { css, error } = await exportTokensCssAction();
    setExporting(false);
    if (error || !css) {
      addToast(error ?? 'CSS 생성에 실패했습니다.');
      return;
    }
    const blob = new Blob([css], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tokens.css';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* 추가하기 버튼 — 토큰 유무와 관계없이 항상 표시 */}
      <button
        type="button"
        className={styles.addBtn}
        onClick={() => setExtractOpen(true)}
        aria-label={`${typeConfig?.label ?? type} 토큰 추가하기`}
      >
        <Icon icon="solar:add-circle-linear" width={14} height={14} />
        {typeConfig?.label ?? type} 토큰 추가하기
      </button>

      {count > 0 && (
        <>
          {/* 검증 버튼 */}
          <button
            type="button"
            className={styles.verifyBtn}
            onClick={() => setVerifyOpen(true)}
            aria-label={`${typeConfig?.label ?? type} 토큰 검증`}
          >
            <Icon icon="solar:shield-check-linear" width={14} height={14} />
            검증
          </button>

          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExportCopy}
            disabled={exporting}
            aria-label="CSS 변수로 내보내기 (클립보드 복사)"
          >
            <Icon
              icon={copied ? 'solar:check-circle-linear' : exporting ? 'solar:refresh-linear' : 'solar:export-linear'}
              width={14} height={14}
            />
            {copied ? '복사됨' : exporting ? '생성 중...' : 'CSS 복사'}
          </button>

          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExportDownload}
            disabled={exporting}
            aria-label="tokens.css 파일 다운로드"
          >
            <Icon icon="solar:download-minimalistic-linear" width={14} height={14} />
            .css 저장
          </button>

          <button
            type="button"
            className={styles.deleteAllBtn}
            onClick={() => setDialogOpen(true)}
            aria-label={`${typeConfig?.label ?? type} 토큰 전체 삭제`}
          >
            <Icon icon="solar:trash-bin-2-linear" width={14} height={14} />
            전체 삭제
          </button>
        </>
      )}

      <TokenExtractModal
        type={type}
        typeLabel={typeConfig?.label ?? type}
        isOpen={extractOpen}
        onClose={() => setExtractOpen(false)}
        onSuccess={handleExtractSuccess}
      />

      <TokenVerifyModal
        type={type}
        typeLabel={typeConfig?.label ?? type}
        isOpen={verifyOpen}
        onClose={() => setVerifyOpen(false)}
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
