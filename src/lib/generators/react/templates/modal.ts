import type { TokenContext, GeneratedComponent } from '../types';

export function generateModal(ctx: TokenContext): GeneratedComponent {
  const tsx = `'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import styles from './Modal.module.scss';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: ModalSize;
  children: ReactNode;
}

export default function Modal({ isOpen, onClose, title, size = 'md', children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={\`\${styles.dialog} \${styles[size]}\`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="modal-title" className={styles.title}>{title}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
            <Icon icon="solar:close-circle-linear" width={20} height={20} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
`;

  const scss = `@use '@/styles/variables' as *;

.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}

.dialog {
  background: #1c1c1f;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: ${ctx.borderRadiusLg};
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  width: 100%;
  outline: none;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  &.sm { max-width: 400px; }
  &.md { max-width: 560px; }
  &.lg { max-width: 720px; }
  &.xl { max-width: 960px; }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 0;
}

.title {
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

.closeBtn {
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.4);
  padding: 0.25rem;
  border-radius: ${ctx.borderRadiusSm};
  display: flex;
  transition: color 0.2s;
  &:hover { color: rgba(255, 255, 255, 0.8); }
}

.body {
  padding: 1.25rem 1.5rem 1.5rem;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

  return {
    id: 'modal',
    name: 'Modal',
    category: 'feedback',
    tsx,
    scss,
    description: 'Portal 기반 모달. 포커스 관리, ESC 닫기, body 스크롤 차단을 내장합니다.',
  };
}
