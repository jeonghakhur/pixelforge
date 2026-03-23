import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';

interface ChipProps {
  children: ReactNode;
  active?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}

export default function Chip({
  children,
  active = false,
  removable = false,
  onRemove,
  className = '',
}: ChipProps) {
  const classes = [
    'chip',
    active ? 'chip--active' : '',
    removable ? 'chip--removable' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      {children}
      {removable && (
        <button
          type="button"
          className="chip__remove"
          onClick={onRemove}
          aria-label="제거"
        >
          <Icon icon="solar:close-circle-linear" width={12} height={12} />
        </button>
      )}
    </span>
  );
}
