import type { TokenContext, GeneratedComponent } from '../types';

export function generateDropdown(ctx: TokenContext): GeneratedComponent {
  const tsx = `'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Icon } from '@iconify/react';
import styles from './Dropdown.module.scss';

interface DropdownItem {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  onSelect: (id: string) => void;
  align?: 'left' | 'right';
}

export default function Dropdown({ trigger, items, onSelect, align = 'left' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className={styles.dropdown}>
      <button type="button" className={styles.trigger} onClick={() => setOpen((v) => !v)}>
        {trigger}
        <Icon icon="solar:alt-arrow-down-linear" width={14} height={14} className={styles.chevron} aria-hidden="true" />
      </button>
      {open && (
        <ul className={\`\${styles.menu} \${styles[align]}\`} role="menu">
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                className={\`\${styles.menuItem} \${item.danger ? styles.danger : ''}\`}
                disabled={item.disabled}
                onClick={() => { onSelect(item.id); setOpen(false); }}
              >
                {item.icon && <Icon icon={item.icon} width={14} height={14} aria-hidden="true" />}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
`;

  const scss = `@use '@/styles/variables' as *;

.dropdown {
  position: relative;
  display: inline-flex;
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: ${ctx.borderRadius};
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { background: rgba(255, 255, 255, 0.08); }
}

.chevron { opacity: 0.5; }

.menu {
  position: absolute;
  top: calc(100% + 4px);
  z-index: 20;
  min-width: 160px;
  background: #1c1c1f;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: ${ctx.borderRadius};
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  padding: 0.25rem;
  list-style: none;
  margin: 0;

  &.left  { left: 0; }
  &.right { right: 0; }
}

.menuItem {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  background: none;
  border: none;
  border-radius: ${ctx.borderRadiusSm};
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.875rem;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.95);
  }

  &.danger { color: #f87171; &:hover:not(:disabled) { background: rgba(248,113,113,0.1); } }
  &:disabled { opacity: 0.35; cursor: not-allowed; }
}
`;

  return {
    id: 'dropdown',
    name: 'Dropdown',
    category: 'navigation',
    tsx,
    scss,
    description: '클릭 기반 드롭다운 메뉴. 외부 클릭 시 자동으로 닫힙니다.',
  };
}
