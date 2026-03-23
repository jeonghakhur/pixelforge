import type { TokenContext, GeneratedComponent } from '../types';

export function generateBadge(ctx: TokenContext): GeneratedComponent {
  const tsx = `import type { ReactNode } from 'react';
import styles from './Badge.module.scss';

export type BadgeVariant =
  | 'primary' | 'secondary' | 'success'
  | 'danger' | 'warning' | 'info' | 'gray';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export default function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span className={\`\${styles.badge} \${styles[variant]} \${className}\`}>
      {children}
    </span>
  );
}
`;

  const scss = `@use '@/styles/variables' as *;

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.1875rem 0.5rem;
  border-radius: 50rem;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.02em;
  white-space: nowrap;

  &.primary  { background: ${ctx.primaryColor}1a; color: ${ctx.primaryColor}; }
  &.secondary { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6); }
  &.success  { background: rgba(52, 211, 153, 0.15); color: #34d399; }
  &.danger   { background: rgba(248, 113, 113, 0.15); color: #f87171; }
  &.warning  { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
  &.info     { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
  &.gray     { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.4); }
}
`;

  return {
    id: 'badge',
    name: 'Badge',
    category: 'action',
    tsx,
    scss,
    description: '상태를 표시하는 인라인 배지. 7가지 variant를 지원합니다.',
  };
}
