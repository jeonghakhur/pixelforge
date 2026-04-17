import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Text.module.css';

export type TextSize = 'display-2xl' | 'display-xl' | 'display-lg' | 'display-md' | 'display-xs' | 'text-xl' | 'text-lg' | 'text-md' | 'text-sm' | 'text-xs';
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';
export type TextColor = 'primary' | 'tertiary' | 'error-primary' | 'warning-primary' | 'success-primary' | 'white' | 'secondary' | 'secondary_hover' | 'tertiary_hover' | 'brand-secondary' | 'placeholder' | 'brand-tertiary' | 'quaternary' | 'brand-primary' | 'primary_on-brand' | 'secondary_on-brand' | 'tertiary_on-brand' | 'quaternary_on-brand' | 'brand-tertiary_alt' | 'error-primary_hover' | 'brand-secondary_hover';
export type TextTag = 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'label';

export interface TextProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  size?: TextSize;
  weight?: TextWeight;
  color?: TextColor;
  as?: TextTag;
  truncate?: boolean;
  align?: 'left' | 'center' | 'right';
  srOnly?: boolean;
}

export function Text({
  children = 'Text',
  size = 'text-md',
  weight = 'regular',
  color = 'primary',
  as: Tag = 'p',
  truncate,
  align,
  srOnly,
  className,
  ...props
}: TextProps) {
  const cls = [
    styles.root,
    truncate && styles.truncate,
    srOnly && styles.srOnly,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag
      className={cls}
      data-size={size}
      data-weight={weight}
      data-color={color}
      {...(align && { 'data-align': align })}
      {...props}
    >
      {children}
    </Tag>
  );
}

export default Text;
