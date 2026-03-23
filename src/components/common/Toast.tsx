'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { Icon } from '@iconify/react';

type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

interface ToastItem {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastItem;
  onRemove: (id: string) => void;
}

const variantIconMap: Record<ToastVariant, string> = {
  success: 'solar:check-circle-linear',
  danger: 'solar:danger-circle-linear',
  warning: 'solar:shield-warning-linear',
  info: 'solar:info-circle-linear',
};

function ToastEntry({ toast, onRemove }: ToastProps) {
  const [leaving, setLeaving] = useState(false);

  const handleRemove = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onRemove(toast.id), 200);
  }, [toast.id, onRemove]);

  useEffect(() => {
    const duration = toast.duration ?? 3000;
    const timer = setTimeout(handleRemove, duration);
    return () => clearTimeout(timer);
  }, [toast.duration, handleRemove]);

  const classes = [
    'toast',
    `toast-${toast.variant}`,
    leaving ? 'toast-leaving' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} role="alert">
      <span className="toast-icon">
        <Icon icon={variantIconMap[toast.variant]} width={20} height={20} />
      </span>
      <div className="toast-body">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        <div className="toast-message">{toast.message}</div>
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={handleRemove}
        aria-label="닫기"
      >
        <Icon icon="solar:close-circle-linear" width={14} height={14} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastEntry key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

export type { ToastItem, ToastVariant };
