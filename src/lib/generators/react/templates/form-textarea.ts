import type { TokenContext, GeneratedComponent } from '../types';

export function generateFormTextarea(ctx: TokenContext): GeneratedComponent {
  const tsx = `import type { TextareaHTMLAttributes } from 'react';
import styles from './FormTextarea.module.scss';

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export default function FormTextarea({
  id,
  label,
  error,
  hint,
  required,
  className = '',
  ...rest
}: FormTextareaProps) {
  return (
    <div className={styles.formGroup}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-hidden="true">*</span>}
      </label>
      <textarea
        id={id}
        className={\`\${styles.textarea} \${error ? styles.invalid : ''} \${className}\`}
        aria-invalid={!!error}
        aria-describedby={error ? \`\${id}-error\` : hint ? \`\${id}-hint\` : undefined}
        {...rest}
      />
      {hint && !error && <p id={\`\${id}-hint\`} className={styles.hint}>{hint}</p>}
      {error && <p id={\`\${id}-error\`} className={styles.error} role="alert">{error}</p>}
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

.textarea {
  width: 100%;
  min-height: 100px;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: ${ctx.borderRadius};
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  font-family: ${ctx.fontFamily};
  resize: vertical;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;

  &::placeholder { color: rgba(255, 255, 255, 0.25); }

  &:focus {
    border-color: ${ctx.primaryColor};
    box-shadow: 0 0 0 3px ${ctx.primaryColor}20;
  }

  &.invalid { border-color: #f87171; }
}

.hint  { font-size: 0.75rem; color: rgba(255,255,255,0.35); margin: 0; }
.error { font-size: 0.75rem; color: #f87171; margin: 0; }
`;

  return {
    id: 'form-textarea',
    name: 'FormTextarea',
    category: 'form',
    tsx,
    scss,
    description: '텍스트 영역 입력 컴포넌트.',
  };
}
