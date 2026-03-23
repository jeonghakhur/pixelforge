import type { TokenContext, GeneratedComponent } from '../types';

export function generateFormSelect(ctx: TokenContext): GeneratedComponent {
  const tsx = `import type { SelectHTMLAttributes } from 'react';
import { Icon } from '@iconify/react';
import styles from './FormSelect.module.scss';

interface SelectOption {
  value: string;
  label: string;
}

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  options: SelectOption[];
  error?: string;
  required?: boolean;
}

export default function FormSelect({
  id,
  label,
  options,
  error,
  required,
  className = '',
  ...rest
}: FormSelectProps) {
  return (
    <div className={styles.formGroup}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-hidden="true">*</span>}
      </label>
      <div className={styles.selectWrapper}>
        <select
          id={id}
          className={\`\${styles.select} \${error ? styles.invalid : ''} \${className}\`}
          aria-invalid={!!error}
          aria-describedby={error ? \`\${id}-error\` : undefined}
          {...rest}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <Icon icon="solar:alt-arrow-down-linear" width={14} height={14} className={styles.chevron} aria-hidden="true" />
      </div>
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

.selectWrapper {
  position: relative;
}

.select {
  width: 100%;
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: ${ctx.borderRadius};
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  font-family: ${ctx.fontFamily};
  appearance: none;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    border-color: ${ctx.primaryColor};
    box-shadow: 0 0 0 3px ${ctx.primaryColor}20;
  }

  &.invalid { border-color: #f87171; }

  option { background: #1c1c1f; }
}

.chevron {
  position: absolute;
  right: 0.625rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: rgba(255,255,255,0.4);
}

.error { font-size: 0.75rem; color: #f87171; margin: 0; }
`;

  return {
    id: 'form-select',
    name: 'FormSelect',
    category: 'form',
    tsx,
    scss,
    description: '커스텀 스타일 셀렉트 박스.',
  };
}
