type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

const sizeClassMap: Record<SpinnerSize, string> = {
  sm: 'spinner-sm',
  md: '',
  lg: 'spinner-lg',
};

export default function Spinner({ size = 'md', className = '', label }: SpinnerProps) {
  const classes = ['spinner', sizeClassMap[size], className].filter(Boolean).join(' ');

  return (
    <span className={classes} role="status" aria-label={label ?? '로딩 중'}>
      <span className="sr-only">{label ?? '로딩 중'}</span>
    </span>
  );
}
