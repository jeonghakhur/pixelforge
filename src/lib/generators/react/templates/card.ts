import type { TokenContext, GeneratedComponent } from '../types';

export function generateCard(ctx: TokenContext): GeneratedComponent {
  const tsx = `import type { ReactNode, HTMLAttributes } from 'react';
import styles from './Card.module.scss';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div className={\`\${styles.cardOuter} \${className}\`} {...rest}>
      <div className={styles.cardInner}>
        {children}
      </div>
    </div>
  );
}
`;

  const scss = `@use '@/styles/variables' as *;

/* Double-Bezel 아키텍처 */
.cardOuter {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: ${ctx.borderRadiusLg};
  padding: 3px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.cardInner {
  background: rgba(255, 255, 255, 0.02);
  border-radius: calc(${ctx.borderRadiusLg} - 3px);
  padding: 1.25rem;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.06);
}
`;

  return {
    id: 'card',
    name: 'Card',
    category: 'action',
    tsx,
    scss,
    description: 'Double-Bezel 아키텍처 카드 컨테이너.',
  };
}
