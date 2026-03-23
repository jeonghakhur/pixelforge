import type { TokenContext, GeneratedComponent } from '../types';

export function generatePagination(ctx: TokenContext): GeneratedComponent {
  const tsx = `import { Icon } from '@iconify/react';
import styles from './Pagination.module.scss';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onChange }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className={styles.pagination} aria-label="페이지 탐색">
      <button
        type="button"
        className={styles.pageBtn}
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="이전 페이지"
      >
        <Icon icon="solar:alt-arrow-left-linear" width={14} height={14} />
      </button>

      {pages.map((page) => (
        <button
          key={page}
          type="button"
          className={\`\${styles.pageBtn} \${currentPage === page ? styles.active : ''}\`}
          onClick={() => onChange(page)}
          aria-current={currentPage === page ? 'page' : undefined}
        >
          {page}
        </button>
      ))}

      <button
        type="button"
        className={styles.pageBtn}
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="다음 페이지"
      >
        <Icon icon="solar:alt-arrow-right-linear" width={14} height={14} />
      </button>
    </nav>
  );
}
`;

  const scss = `@use '@/styles/variables' as *;

.pagination {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.pageBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 0.5rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: ${ctx.borderRadiusSm};
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
  }

  &.active {
    background: ${ctx.primaryColor};
    border-color: ${ctx.primaryColor};
    color: #fff;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}
`;

  return {
    id: 'pagination',
    name: 'Pagination',
    category: 'navigation',
    tsx,
    scss,
    description: '페이지 탐색 컴포넌트.',
  };
}
