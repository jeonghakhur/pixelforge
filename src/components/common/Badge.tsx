import type { ReactNode } from 'react';

export type BadgeVariant =
  // ── 기존 시맨틱 ──────────────────
  | 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'gray'
  // ── Neutral ──────────────────────
  | 'neutral-1' | 'neutral-2' | 'neutral-3' | 'neutral-4' | 'neutral-5' | 'neutral-6'
  // ── Blue ─────────────────────────
  | 'blue-1' | 'blue-2' | 'blue-3' | 'blue-4' | 'blue-5' | 'blue-6'
  // ── Green ────────────────────────
  | 'green-1' | 'green-2' | 'green-3' | 'green-4' | 'green-5' | 'green-6'
  // ── Yellow / Amber ───────────────
  | 'yellow-1' | 'yellow-2' | 'yellow-3' | 'yellow-4' | 'yellow-5' | 'yellow-6'
  // ── Orange ───────────────────────
  | 'orange-1' | 'orange-2' | 'orange-3' | 'orange-4' | 'orange-5' | 'orange-6'
  // ── Red / Rose ───────────────────
  | 'red-1' | 'red-2' | 'red-3' | 'red-4' | 'red-5' | 'red-6'
  // ── Pink ─────────────────────────
  | 'pink-1' | 'pink-2' | 'pink-3' | 'pink-4' | 'pink-5' | 'pink-6'
  // ── Purple / Violet ──────────────
  | 'purple-1' | 'purple-2' | 'purple-3' | 'purple-4' | 'purple-5' | 'purple-6'
  // ── Teal / Cyan ──────────────────
  | 'teal-1' | 'teal-2' | 'teal-3' | 'teal-4' | 'teal-5' | 'teal-6';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export default function Badge({ variant = 'primary', children, className = '' }: BadgeProps) {
  const classes = ['badge', `badge-${variant}`, className].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}
