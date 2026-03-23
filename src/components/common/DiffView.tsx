interface DiffLine {
  type: 'added' | 'removed' | 'changed' | 'same';
  lineNumber?: number;
  content: string;
}

interface DiffViewProps {
  title?: string;
  lines: DiffLine[];
  className?: string;
}

const typeClassMap: Record<DiffLine['type'], string> = {
  added: 'diff-added',
  removed: 'diff-removed',
  changed: 'diff-changed',
  same: 'diff-same',
};

const typePrefixMap: Record<DiffLine['type'], string> = {
  added: '+',
  removed: '-',
  changed: '~',
  same: ' ',
};

export default function DiffView({ title, lines, className = '' }: DiffViewProps) {
  const classes = ['diff', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {title && <div className="diff__header">{title}</div>}
      {lines.map((line, i) => (
        <div key={i} className={`diff__line ${typeClassMap[line.type]}`}>
          <span className="diff__line-number">
            {line.lineNumber ?? i + 1}
          </span>
          <span className="diff__line-content">
            {typePrefixMap[line.type]} {line.content}
          </span>
        </div>
      ))}
    </div>
  );
}

export type { DiffLine };
