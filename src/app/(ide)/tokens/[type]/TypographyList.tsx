import type { TokenRow } from '@/lib/actions/tokens';
import styles from './token-views.module.scss';

interface TypographyData {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight?: number;
  letterSpacing?: number;
}

function parseTypo(value: string): TypographyData | null {
  try {
    return JSON.parse(value) as TypographyData;
  } catch {
    return null;
  }
}

export default function TypographyList({ tokens }: { tokens: TokenRow[] }) {
  return (
    <div className={styles.typoList}>
      {tokens.map((token) => {
        const typo = parseTypo(token.value);
        if (!typo) return null;

        return (
          <div key={token.id} className={styles.typoCard}>
            <div className={styles.typoCardInner}>
              <p
                className={styles.typoSample}
                style={{
                  fontFamily: typo.fontFamily,
                  fontSize: `${Math.min(typo.fontSize, 48)}px`,
                  fontWeight: typo.fontWeight,
                  lineHeight: typo.lineHeight ? `${typo.lineHeight}px` : undefined,
                }}
              >
                가나다라마바사 ABCDEFgh 1234567890
              </p>
              <div className={styles.typoMeta}>
                <span className={styles.typoName}>{token.name}</span>
                <div className={styles.typoDetails}>
                  <span>{typo.fontFamily}</span>
                  <span>{typo.fontSize}px</span>
                  <span>w{typo.fontWeight}</span>
                  {typo.lineHeight && <span>LH {Math.round(typo.lineHeight)}px</span>}
                  {typo.letterSpacing && <span>LS {typo.letterSpacing}px</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
