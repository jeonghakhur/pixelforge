export const dynamic = 'force-dynamic';

import fs from 'fs';
import path from 'path';
import { getTokensByType } from '@/lib/actions/tokens';
import { TOKEN_TYPE_MAP } from '@/lib/tokens/token-types';
import { generateCssCode } from '@/lib/tokens/css-generator';
import ColorGrid from './ColorGrid';
import TypographyList from './TypographyList';
import SpacingList from './SpacingList';
import RadiusList from './RadiusList';
import GenericTokenList from './GenericTokenList';
import TokenPageActions from './TokenPageActions';
import TokenCssSection from './TokenCssSection';
import { Icon } from '@iconify/react';
import styles from './page.module.scss';

interface TokenPageProps {
  params: Promise<{ type: string }>;
}

export default async function TokenPage({ params }: TokenPageProps) {
  const { type } = await params;

  const typeConfig = TOKEN_TYPE_MAP[type] ?? {
    id: type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    description: `${type} 타입 디자인 토큰입니다.`,
    icon: 'solar:box-linear',
    cssPrefix: type,
  };

  const tokenRows = await getTokensByType(type);
  const initialCss = tokenRows.length > 0 ? generateCssCode(tokenRows, type) : '';

  let fullCss = '';
  try {
    const cssPath = path.join(process.cwd(), 'design-tokens', 'tokens.css');
    if (fs.existsSync(cssPath)) fullCss = fs.readFileSync(cssPath, 'utf-8');
  } catch { /* ignore */ }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.eyebrow}>Design Tokens</span>
          <h1 className={styles.title}>{typeConfig.label} 토큰</h1>
          <p className={styles.description}>{typeConfig.description}</p>
        </div>
        <div className={styles.headerActions}>
          <TokenPageActions type={type} count={tokenRows.length} />
        </div>
      </div>

      {tokenRows.length === 0 ? (
        <div className={styles.stage}>
          <div className={styles.stageInner}>
            <div className={styles.emptyBlock}>
              <Icon icon="solar:layers-minimalistic-linear" width={32} height={32} className={styles.emptyIcon} />
              <p className={styles.empty}>토큰이 아직 없습니다</p>
              <p className={styles.emptyHint}>Figma 플러그인으로 자동 동기화하면 여기에 표시됩니다.</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div data-token-grid>
            {type === 'color'      && <ColorGrid tokens={tokenRows} />}
            {type === 'typography' && <TypographyList tokens={tokenRows} />}
            {type === 'spacing'    && <SpacingList tokens={tokenRows} />}
            {type === 'radius'     && <RadiusList tokens={tokenRows} />}
            {!['color', 'typography', 'spacing', 'radius'].includes(type) && (
              <GenericTokenList tokens={tokenRows} />
            )}
          </div>
          <TokenCssSection type={type} initialCss={initialCss} fullCss={fullCss} />
        </>
      )}
    </div>
  );
}
