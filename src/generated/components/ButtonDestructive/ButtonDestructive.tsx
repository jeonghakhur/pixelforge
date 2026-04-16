import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './ButtonDestructive.module.css';

export type ButtonDestructiveHierarchy = 'Primary' | 'Secondary' | 'Tertiary' | 'Link';
export type ButtonDestructiveState = 'default' | 'hover' | 'focused' | 'disabled' | 'loading';
export type ButtonDestructiveSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonDestructiveProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  hierarchy?: ButtonDestructiveHierarchy;
  size?: ButtonDestructiveSize;
  state?: ButtonDestructiveState;
  iconOnly?: boolean;
  iconLeading?: ReactNode;
  iconTrailing?: ReactNode;
  loadingText?: boolean;
  children?: ReactNode;
}

/**
 * ButtonDestructive — Figma COMPONENT_SET 기반 자동 생성
 * dimensions: {"size":5,"hierarchy":4,"state":5,"icon only":2}
 */
export const ButtonDestructive = forwardRef<HTMLButtonElement, ButtonDestructiveProps>(
  (
    {
      hierarchy = 'Primary',
      size = 'md',
      state = 'default',
      iconOnly = false,
      iconLeading,
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
        {iconOnly && (iconLeading || iconTrailing) ? (
          <span className={styles.iconSlot}>{iconLeading ?? iconTrailing}</span>
        ) : (
          <>
            {iconLeading && <span className={styles.iconSlot}>{iconLeading}</span>}
            <span className={styles.textWrapper}>{(!isLoading || loadingText) && children}</span>
            {iconTrailing && <span className={styles.iconSlot}>{iconTrailing}</span>}
          </>
        )}
      </button>
    );
  },
);
ButtonDestructive.displayName = 'ButtonDestructive';

export default ButtonDestructive;
