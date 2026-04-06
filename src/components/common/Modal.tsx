'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'wide';
type ModalVariant = 'default' | 'success' | 'warning' | 'destructive';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** 제목 아래 부제목 */
  description?: string;
  /** 헤더 좌측 아이콘 (Iconify 아이콘명) */
  icon?: string;
  /** 색상 변형 — 아이콘 배경색 + confirm 버튼 색상 결정 */
  variant?: ModalVariant;
  size?: ModalSize;
  children?: ReactNode;
  footer?: ReactNode;
}

const sizeClassMap: Record<ModalSize, string> = {
  sm: 'modal-sm',
  md: '',
  lg: 'modal-lg',
  xl: 'modal-xl',
  wide: 'modal-wide',
};

const variantIconMap: Record<ModalVariant, string> = {
  default: 'solar:info-circle-linear',
  success: 'solar:check-circle-linear',
  warning: 'solar:danger-triangle-linear',
  destructive: 'solar:trash-bin-2-linear',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  icon,
  variant,
  size = 'md',
  children,
  footer,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = sizeClassMap[size];
  const contentClasses = ['modal-content', sizeClass].filter(Boolean).join(' ');
  const resolvedIcon = icon ?? (variant ? variantIconMap[variant] : undefined);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={contentClasses}
        data-variant={variant}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          {resolvedIcon && (
            <div className="modal-icon">
              <Icon icon={resolvedIcon} width={20} height={20} />
            </div>
          )}
          <div className="modal-header-text">
            <h2 id="modal-title" className="modal-title">
              {title}
            </h2>
            {description && (
              <p className="modal-description">{description}</p>
            )}
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <Icon icon="solar:close-square-linear" width={20} height={20} />
          </button>
        </div>
        {children && <div className="modal-body">{children}</div>}
        {footer && <div className="modal-actions" data-layout="horizontal-fill">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export type { ModalSize, ModalVariant };
