import type { TokenContext, GeneratedComponent } from '../types';

export function generateSpinner(ctx: TokenContext): GeneratedComponent {
  const tsx = `import styles from './Spinner.module.scss';

export type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
}

export default function Spinner({ size = 'md', label = '로딩 중' }: SpinnerProps) {
  return (
    <span
      className={\`\${styles.spinner} \${styles[size]}\`}
      role="status"
      aria-label={label}
    />
  );
}
`;

  const scss = `@use '@/styles/variables' as *;

.spinner {
  display: inline-block;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: ${ctx.primaryColor};
  animation: spin 0.7s linear infinite;

  &.sm { width: 14px; height: 14px; }
  &.md { width: 20px; height: 20px; }
  &.lg { width: 28px; height: 28px; border-width: 3px; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
`;

  return {
    id: 'spinner',
    name: 'Spinner',
    category: 'feedback',
    tsx,
    scss,
    description: '로딩 스피너. sm, md, lg 크기를 지원합니다.',
  };
}
