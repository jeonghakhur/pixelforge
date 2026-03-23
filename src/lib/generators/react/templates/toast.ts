import type { TokenContext, GeneratedComponent } from '../types';

export function generateToast(ctx: TokenContext): GeneratedComponent {
  const tsx = `'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import styles from './Toast.module.scss';

export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onClose: () => void;
}

const ICONS: Record<ToastVariant, string> = {
  success: 'solar:check-circle-linear',
  danger:  'solar:close-circle-linear',
  warning: 'solar:danger-triangle-linear',
  info:    'solar:info-circle-linear',
};

export default function Toast({ message, variant = 'info', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return createPortal(
    <div className={\`\${styles.toast} \${styles[variant]}\`} role="status" aria-live="polite">
      <Icon icon={ICONS[variant]} width={16} height={16} aria-hidden="true" />
      <span>{message}</span>
      <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
        <Icon icon="solar:close-circle-linear" width={14} height={14} />
      </button>
    </div>,
    document.body,
  );
}
`;

  const scss = `@use '@/styles/variables' as *;

.toast {
  position: fixed;
  top: 1.25rem;
  right: 1.25rem;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  border-radius: ${ctx.borderRadius};
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #1c1c1f;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  font-size: 0.875rem;
  max-width: 360px;
  animation: slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);

  &.success { border-left: 3px solid #34d399; }
  &.danger  { border-left: 3px solid #f87171; }
  &.warning { border-left: 3px solid #fbbf24; }
  &.info    { border-left: 3px solid ${ctx.primaryColor}; }
}

.closeBtn {
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255,255,255,0.4);
  padding: 0;
  display: flex;
  margin-left: auto;
  &:hover { color: rgba(255,255,255,0.8); }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
}
`;

  return {
    id: 'toast',
    name: 'Toast',
    category: 'feedback',
    tsx,
    scss,
    description: '자동 닫기 알림 (기본 3초). success, danger, warning, info를 지원합니다.',
  };
}
