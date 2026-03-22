import type { TokenRow } from '@/lib/actions/tokens';
import styles from './token-views.module.scss';

interface RadiusData {
  value: number;
  corners?: number[];
}

function parseRadius(value: string): RadiusData | null {
  try {
    return JSON.parse(value) as RadiusData;
  } catch {
    return null;
  }
}

export default function RadiusList({ tokens }: { tokens: TokenRow[] }) {
  return (
    <div className={styles.radiusList}>
      {tokens.map((token) => {
        const rad = parseRadius(token.value);
        if (!rad) return null;

        const borderRadius = rad.corners
          ? rad.corners.map((c) => `${c}px`).join(' ')
          : `${rad.value}px`;

        return (
          <div key={token.id} className={styles.radiusCard}>
            <div className={styles.radiusCardInner}>
              <div className={styles.radiusVisual}>
                <div
                  className={styles.radiusBox}
                  style={{ borderRadius }}
                />
              </div>
              <div className={styles.radiusMeta}>
                <span className={styles.radiusName}>{token.name}</span>
                <span className={styles.radiusValue}>{rad.value}px</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
