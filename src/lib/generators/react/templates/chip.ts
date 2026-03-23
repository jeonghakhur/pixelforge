import type { TokenContext, GeneratedComponent } from '../types';

export function generateChip(ctx: TokenContext): GeneratedComponent {
  const tsx = `import { Icon } from '@iconify/react';
import styles from './Chip.module.scss';

interface ChipProps {
  label: string;
  active?: boolean;
  removable?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

export default function Chip({ label, active = false, removable = false, onClick, onRemove }: ChipProps) {
  return (
    <span className={\`\${styles.chip} \${active ? styles.active : ''}\`}>
      <button
        type="button"
        className={styles.chipLabel}
        onClick={onClick}
      >
        {label}
      </button>
      {removable && (
        <button
          type="button"
          className={styles.removeBtn}
          onClick={onRemove}
          aria-label={\`\${label} 제거\`}
        >
          <Icon icon="solar:close-circle-linear" width={12} height={12} />
        </button>
      )}
    </span>
  );
}
`;

  const scss = `@use '@/styles/variables' as *;

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  border-radius: 50rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  &.active {
    background: ${ctx.primaryColor}1a;
    border-color: ${ctx.primaryColor}40;
    color: ${ctx.primaryColor};
  }
}

.chipLabel {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.8125rem;
  color: inherit;
  padding: 0;
  line-height: 1;
}

.removeBtn {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  opacity: 0.5;
  color: inherit;
  transition: opacity 0.2s;
  &:hover { opacity: 1; }
}
`;

  return {
    id: 'chip',
    name: 'Chip',
    category: 'action',
    tsx,
    scss,
    description: '태그/필터 칩. active, removable을 지원합니다.',
  };
}
