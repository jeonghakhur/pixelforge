import type { TokenRow } from '@/lib/actions/tokens';
import styles from './generic-list.module.scss';

interface GenericTokenListProps {
  tokens: TokenRow[];
}

export default function GenericTokenList({ tokens }: GenericTokenListProps) {
  return (
    <div className={styles.list}>
      {tokens.map((token) => (
        <div key={token.id} className={styles.row}>
          <span className={styles.name}>{token.name}</span>
          <span className={styles.value}>{token.raw ?? token.value}</span>
        </div>
      ))}
    </div>
  );
}
