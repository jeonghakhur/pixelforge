import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from '@iconify/react';
import Spinner from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'destructive' | 'outline-primary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: string;
  rightIcon?: string;
  children: ReactNode;
}

const sizeClassMap: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    sizeClassMap[size],
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading ? (
        <Spinner size="sm" />
      ) : leftIcon ? (
        <Icon icon={leftIcon} width={16} height={16} />
      ) : null}
      {children}
      {rightIcon && !loading && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.5rem',
            height: '1.5rem',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <Icon icon={rightIcon} width={14} height={14} />
        </span>
      )}
    </button>
  );
}
