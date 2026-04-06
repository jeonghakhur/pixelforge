'use client';

import Modal from './Modal';
import type { ModalVariant } from './Modal';

/** 기존 'danger' → 'destructive' 호환 매핑 */
type LegacyVariant = 'danger' | 'warning';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  /** 제목 좌측 아이콘 (기본값: variant에 따라 자동) */
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ModalVariant | LegacyVariant;
  loading?: boolean;
}

const VARIANT_MAP: Record<string, ModalVariant> = {
  danger: 'destructive',
  warning: 'warning',
};

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  icon,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'destructive',
  loading = false,
}: ConfirmDialogProps) {
  const resolvedVariant: ModalVariant = VARIANT_MAP[variant] ?? (variant as ModalVariant);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={message}
      icon={icon}
      variant={resolvedVariant}
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="modal-btn modal-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="modal-btn modal-btn-confirm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '처리 중...' : confirmLabel}
          </button>
        </>
      }
    />
  );
}
