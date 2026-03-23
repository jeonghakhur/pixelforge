import type { ReactNode } from 'react';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'gray';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export default function Badge({ variant = 'primary', children, className = '' }: BadgeProps) {
  const classes = ['badge', `badge-${variant}`, className].filter(Boolean).join(' ');

  return <span className={classes}>{children}</span>;
}
