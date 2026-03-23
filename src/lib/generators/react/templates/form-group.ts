import type { TokenContext, GeneratedComponent } from '../types';

export function generateFormGroup(ctx: TokenContext): GeneratedComponent {
  const tsx = `import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './FormGroup.module.scss';

interface FormGroupProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children?: ReactNode;
}

export default function FormGroup({
  id,
  label,
  error,
  hint,
  required,
  children,
  className = '',
  ...inputProps
}: FormGroupProps) {
  return (
    <div className={styles.formGroup}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-hidden="true">*</span>}
      </label>
      {children ?? (
        <input
          id={id}
          className={\`\${styles.input} \${error ? styles.invalid : ''} \${className}\`}
          aria-invalid={!!error}
          aria-describedby={error ? \`\${id}-error\` : hint ? \`\${id}-hint\` : undefined}
          {...inputProps}
        />
      )}
      {hint && !error && <p id={\`\${id}-hint\`} className={styles.hint}>{hint}</p>}
      {error && (
        <p id={\`\${id}-error\`} className={styles.error} role="alert">{error}</p>
      )}
    </div>
  );
}
`;

  const scss = `@use '@/styles/variables' as *;

.formGroup {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.required { color: #f87171; }

.input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: ${ctx.borderRadius};
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  font-family: ${ctx.fontFamily};
  transition: border-color 0.2s, box-shadow 0.2s;
  outline: none;

  &::placeholder { color: rgba(255, 255, 255, 0.25); }

  &:focus {
    border-color: ${ctx.primaryColor};
    box-shadow: 0 0 0 3px ${ctx.primaryColor}20;
  }

  &.invalid {
    border-color: #f87171;
    &:focus { box-shadow: 0 0 0 3px rgba(248,113,113,0.2); }
  }
}

.hint  { font-size: 0.75rem; color: rgba(255,255,255,0.35); margin: 0; }
.error { font-size: 0.75rem; color: #f87171; margin: 0; }
`;

  return {
    id: 'form-group',
    name: 'FormGroup',
    category: 'form',
    tsx,
    scss,
    description: 'label + input + error 래퍼. aria-invalid, aria-describedby를 자동 처리합니다.',
  };
}
