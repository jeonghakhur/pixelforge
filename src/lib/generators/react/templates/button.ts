import type { TokenContext, GeneratedComponent } from '../types';

export function generateButton(ctx: TokenContext): GeneratedComponent {
  const tsx = `import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from '@iconify/react';
import styles from './Button.module.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: string;
  rightIcon?: string;
  children?: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={\`\${styles.btn} \${styles[variant]} \${styles[size]} \${className}\`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {!loading && leftIcon && <Icon icon={leftIcon} width={16} height={16} aria-hidden="true" />}
      {children}
      {!loading && rightIcon && <Icon icon={rightIcon} width={16} height={16} aria-hidden="true" />}
    </button>
  );
}
`;

  const scss = `@use '@/styles/variables' as *;

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border: none;
  cursor: pointer;
  font-family: ${ctx.fontFamily};
  font-size: ${ctx.baseFontSize};
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  border-radius: ${ctx.borderRadius};
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  text-decoration: none;

  &:hover:not(:disabled) { transform: scale(1.02); }
  &:active:not(:disabled) { transform: scale(0.98); }
  &:focus-visible { outline: 2px solid ${ctx.primaryColor}; outline-offset: 2px; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Sizes */
  &.sm { padding: 0.375rem 0.75rem; font-size: 0.8125rem; }
  &.md { padding: 0.5rem 1rem; }
  &.lg { padding: 0.6875rem 1.375rem; font-size: 1rem; }

  /* Variants */
  &.primary {
    background: ${ctx.primaryColor};
    color: #fff;
    &:hover:not(:disabled) { background: ${ctx.primaryColor}cc; }
  }

  &.secondary {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    &:hover:not(:disabled) { background: rgba(255, 255, 255, 0.1); }
  }

  &.ghost {
    background: transparent;
    color: ${ctx.primaryColor};
    border: 1px solid ${ctx.primaryColor}40;
    &:hover:not(:disabled) { background: ${ctx.primaryColor}1a; }
  }

  &.success {
    background: #34d399;
    color: #065f46;
    &:hover:not(:disabled) { background: #6ee7b7; }
  }

  &.danger {
    background: #f87171;
    color: #7f1d1d;
    &:hover:not(:disabled) { background: #fca5a5; }
  }

  /* Spinner */
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
}
`;

  return {
    id: 'button',
    name: 'Button',
    category: 'action',
    tsx,
    scss,
    description: '클릭 가능한 버튼 컴포넌트. variant, size, loading, icon을 지원합니다.',
  };
}
