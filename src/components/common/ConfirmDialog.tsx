'use client';

import { Icon } from '@iconify/react';
import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = '확인',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: variant === 'danger' ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)',
          color: variant === 'danger' ? '#f87171' : '#fbbf24',
        }}>
          <Icon
            icon={variant === 'danger' ? 'solar:trash-bin-2-linear' : 'solar:danger-triangle-linear'}
            width={18}
            height={18}
          />
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
          {message}
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          style={{
            padding: '6px 16px',
            background: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          style={{
            padding: '6px 16px',
            background: variant === 'danger' ? '#f87171' : '#fbbf24',
            border: 'none',
            borderRadius: '6px',
            color: variant === 'danger' ? '#fff' : '#1a1a1a',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '처리 중...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
