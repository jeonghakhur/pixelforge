import { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export default function Card({ title, children, footer, className = '', icon }: CardProps) {
  return (
    <div className={`card ${className}`}>
      <div className="card-inner">
        {title && (
          <div className="card-header">
            {icon && <span style={{ marginRight: '0.5rem' }}>{icon}</span>}
            {title}
          </div>
        )}
        <div className="card-body">{children}</div>
        {footer && <div className="card-footer">{footer}</div>}
      </div>
    </div>
  );
}
