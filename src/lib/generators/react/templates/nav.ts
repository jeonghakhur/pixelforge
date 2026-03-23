import type { TokenContext, GeneratedComponent } from '../types';

export function generateNav(ctx: TokenContext): GeneratedComponent {
  const tsx = `import type { ReactNode } from 'react';
import styles from './Nav.module.scss';

interface NavItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface NavProps {
  items: NavItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function Nav({ items, activeId, onChange }: NavProps) {
  return (
    <nav className={styles.nav} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={activeId === item.id}
          className={\`\${styles.navItem} \${activeId === item.id ? styles.active : ''}\`}
          onClick={() => onChange(item.id)}
        >
          {item.icon && <span className={styles.icon} aria-hidden="true">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
`;

  const scss = `@use '@/styles/variables' as *;

.nav {
  display: flex;
  gap: 0.125rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 0;
}

.navItem {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.45);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: -1px;
  white-space: nowrap;

  &:hover { color: rgba(255, 255, 255, 0.75); }

  &.active {
    color: ${ctx.primaryColor};
    border-bottom-color: ${ctx.primaryColor};
  }
}

.icon { display: flex; }
`;

  return {
    id: 'nav',
    name: 'Nav',
    category: 'navigation',
    tsx,
    scss,
    description: '탭 방식 네비게이션 컴포넌트.',
  };
}
