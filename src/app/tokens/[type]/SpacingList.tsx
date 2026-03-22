import type { TokenRow } from '@/lib/actions/tokens';
import styles from './token-views.module.scss';

interface SpacingData {
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  gap?: number;
}

function parseSpacing(value: string): SpacingData | null {
  try {
    return JSON.parse(value) as SpacingData;
  } catch {
    return null;
  }
}

export default function SpacingList({ tokens }: { tokens: TokenRow[] }) {
  return (
    <div className={styles.spacingList}>
      {tokens.map((token) => {
        const sp = parseSpacing(token.value);
        if (!sp) return null;

        const maxVal = Math.max(
          sp.paddingTop ?? 0,
          sp.paddingRight ?? 0,
          sp.paddingBottom ?? 0,
          sp.paddingLeft ?? 0,
          sp.gap ?? 0,
        );
        const barWidth = Math.min(maxVal, 200);

        return (
          <div key={token.id} className={styles.spacingCard}>
            <div className={styles.spacingCardInner}>
              <div className={styles.spacingVisual}>
                <div
                  className={styles.spacingBar}
                  style={{ width: `${barWidth}px` }}
                />
              </div>
              <div className={styles.spacingMeta}>
                <span className={styles.spacingName}>{token.name}</span>
                <div className={styles.spacingDetails}>
                  {sp.paddingTop !== undefined && sp.paddingTop > 0 && (
                    <span>Top {sp.paddingTop}px</span>
                  )}
                  {sp.paddingRight !== undefined && sp.paddingRight > 0 && (
                    <span>Right {sp.paddingRight}px</span>
                  )}
                  {sp.paddingBottom !== undefined && sp.paddingBottom > 0 && (
                    <span>Bottom {sp.paddingBottom}px</span>
                  )}
                  {sp.paddingLeft !== undefined && sp.paddingLeft > 0 && (
                    <span>Left {sp.paddingLeft}px</span>
                  )}
                  {sp.gap !== undefined && sp.gap > 0 && (
                    <span>Gap {sp.gap}px</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
