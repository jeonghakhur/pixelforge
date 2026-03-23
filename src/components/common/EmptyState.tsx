import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon = 'solar:inbox-linear',
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  const classes = ['empty-state', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="empty-state__icon">
        <Icon icon={icon} width={24} height={24} />
      </div>
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__description">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
