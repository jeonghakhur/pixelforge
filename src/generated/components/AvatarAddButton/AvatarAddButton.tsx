import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './AvatarAddButton.module.css';

export type AvatarAddButtonState = 'default' | 'hover' | 'focus' | 'disabled';
export type AvatarAddButtonSize = 'xs' | 'sm' | 'md';

export interface AvatarAddButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: AvatarAddButtonSize;
  state?: AvatarAddButtonState;
  /** 스크린 리더용 레이블 — 아이콘 전용 버튼 필수 */
  ariaLabel: string;
}

/**
 * AvatarAddButton — Figma COMPONENT_SET 기반 자동 생성
 * dimensions: {"size":3,"state":4}
 */
const _iconSize: Record<AvatarAddButtonSize, number> = {
  xs: 9,
  sm: 9,
  md: 12,
}
const _pathData: Record<AvatarAddButtonSize, string> = {
  xs: 'M 4.666666507720947 0 L 4.666666507720947 9.333333015441895 M 0 4.666666507720947 L 9.333333015441895 4.666666507720947',
  sm: 'M 4.666666507720947 0 L 4.666666507720947 9.333333015441895 M 0 4.666666507720947 L 9.333333015441895 4.666666507720947',
  md: 'M 5.833333492279053 0 L 5.833333492279053 11.666666984558105 M 0 5.833333492279053 L 11.666666984558105 5.833333492279053',
}
const _viewBox: Record<AvatarAddButtonSize, string> = {
  xs: '0 0 9 9',
  sm: '0 0 9 9',
  md: '0 0 12 12',
}
const _strokeWidth: Record<AvatarAddButtonSize, number> = {
  xs: 1.333,
  sm: 1.333,
  md: 1.667,
}

export const AvatarAddButton = forwardRef<HTMLButtonElement, AvatarAddButtonProps>(
  (
    {
      size = 'md',
      state = 'default',
      type = 'button',
      ariaLabel,
      disabled,
      onClick,
      className = '',
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || state === 'disabled';

    return (
      <button
        ref={ref}
        type={type}
        data-size={size}
        data-state={state ?? undefined}
        aria-label={ariaLabel}
        aria-disabled={isDisabled || undefined}
        onClick={isDisabled ? undefined : onClick}
        className={`${styles.root}${className ? ` ${className}` : ''}`}
        {...props}
      >
        <svg
          width={_iconSize[size]}
          height={_iconSize[size]}
          viewBox={_viewBox[size]}
          fill="none"
          aria-hidden="true"
        >
          <path
            d={_pathData[size]}
            stroke="currentColor"
            strokeWidth={_strokeWidth[size]}
            strokeLinecap="round"
          />
        </svg>
      </button>
    );
  },
);
AvatarAddButton.displayName = 'AvatarAddButton';

export default AvatarAddButton;
