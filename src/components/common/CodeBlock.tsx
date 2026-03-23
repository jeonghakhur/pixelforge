'use client';

import { useState, useCallback } from 'react';
import { Icon } from '@iconify/react';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export default function CodeBlock({ code, language, className = '' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const classes = ['code-block', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="code-block__header">
        <span className="code-block__lang">{language ?? 'code'}</span>
        <button
          type="button"
          className={`code-block__copy ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
          aria-label="코드 복사"
        >
          <Icon
            icon={copied ? 'solar:check-read-linear' : 'solar:copy-linear'}
            width={14}
            height={14}
          />
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <pre className="code-block__pre">
        <code className="code-block__code">{code}</code>
      </pre>
    </div>
  );
}
