import type { TokenContext, GeneratedComponent } from '../types';

export function generateFormCheck(ctx: TokenContext): GeneratedComponent {
  const tsx = `import type { InputHTMLAttributes } from 'react';
import styles from './FormCheck.module.scss';

interface FormCheckProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  label: string;
  type?: 'checkbox' | 'radio';
}

export default function FormCheck({ id, label, type = 'checkbox', className = '', ...rest }: FormCheckProps) {
  return (
    <label htmlFor={id} className={\`\${styles.formCheck} \${className}\`}>
      <input
        id={id}
        type={type}
        className={styles.input}
        {...rest}
      />
      <span className={styles.label}>{label}</span>
    </label>
  );
}
`;

  const scss = `@use '@/styles/variables' as *;

.formCheck {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.input {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: ${ctx.primaryColor};
  flex-shrink: 0;
}

.label {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
}
`;

  return {
    id: 'form-check',
    name: 'FormCheck',
    category: 'form',
    tsx,
    scss,
    description: '체크박스/라디오 입력 컴포넌트.',
  };
}
