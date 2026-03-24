'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import styles from './page.module.scss';

interface CopyUrlInlineProps {
  url: string;
}

export default function CopyUrlInline({ url }: CopyUrlInlineProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span className={styles.sourceUrlRow}>
      <span className={styles.sourceUrl}>{url}</span>
      <button
        type="button"
        className={styles.copyUrlIconBtn}
        onClick={handleCopy}
        aria-label="Figma URL 클립보드에 복사"
      >
        <Icon
          icon={copied ? 'solar:check-circle-linear' : 'solar:clipboard-linear'}
          width={13}
          height={13}
        />
      </button>
    </span>
  );
}
