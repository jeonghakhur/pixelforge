'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import type { TokenRow } from '@/lib/actions/tokens';
import styles from './token-views.module.scss';

interface ColorData {
  hex: string;
  rgba: { r: number; g: number; b: number; a: number };
}

function parseColor(value: string): ColorData | null {
  try {
    return JSON.parse(value) as ColorData;
  } catch {
    return null;
  }
}

export default function ColorGrid({ tokens }: { tokens: TokenRow[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className={styles.colorGrid}>
      {tokens.map((token) => {
        const color = parseColor(token.value);
        if (!color) return null;

        return (
          <div key={token.id} className={styles.colorCard}>
            <div className={styles.colorCardInner}>
              <div
                className={styles.colorSwatch}
                style={{ backgroundColor: color.hex }}
              />
              <div className={styles.colorInfo}>
                <span className={styles.colorName}>{token.name}</span>
                <div className={styles.colorValues}>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => handleCopy(color.hex, token.id)}
                    aria-label={`${color.hex} 복사`}
                  >
                    <span className={styles.hexValue}>{color.hex.toUpperCase()}</span>
                    <Icon
                      icon={copiedId === token.id ? 'solar:check-circle-linear' : 'solar:copy-linear'}
                      width={14}
                      height={14}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
