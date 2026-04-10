import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonHierarchy = 'Primary' | 'Secondary' | 'Tertiary' | 'Link color' | 'Link gray';
export type ButtonState = 'default' | 'hover' | 'focused' | 'disabled' | 'loading';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  hierarchy?: ButtonHierarchy;
  size?: ButtonSize;
  state?: ButtonState;
  iconOnly?: boolean;
  leftIcon?: ReactNode;
  iconTrailing?: ReactNode;
  loadingText?: boolean;
  children?: ReactNode;
}

/**
 * Button — Figma COMPONENT_SET 기반 자동 생성
 * dimensions: {"size":5,"hierarchy":5,"state":5,"icon only":2}
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      hierarchy = 'Primary',
      size = 'md',
      state = 'default',
      iconOnly = false,
      leftIcon,
      iconTrailing,
      loadingText = true,
      type = 'button',
      disabled,
      onClick,
      children,
      className = '',
      ...props
    },
    ref,
  ) => {
    const isLoading = state === 'loading';
    const isDisabled = disabled || isLoading || state === 'disabled';

    return (
      <button
        ref={ref}
        type={type}
        data-size={size}
        data-hierarchy={hierarchy.toLowerCase().replace(/\s+/g, '-')}
        data-state={state ?? undefined}
        data-icon-only={iconOnly ? '' : undefined}
        aria-disabled={isDisabled || undefined}
        aria-busy={isLoading || undefined}
        onClick={isDisabled ? undefined : onClick}
        className={`${styles.root}${className ? ` ${className}` : ''}`}
        {...props}
      >
        {iconOnly ? (
          <span className={styles.iconSlot}>{leftIcon ?? iconTrailing}</span>
        ) : (
          <>
            {leftIcon && <span className={styles.iconSlot}>{leftIcon}</span>}
            <span className={styles.textWrapper}>{(!isLoading || loadingText) && children}</span>
            {iconTrailing && <span className={styles.iconSlot}>{iconTrailing}</span>}
          </>
        )}
      </button>
    );
  },
);
Button.displayName = 'Button';

export default Button;
