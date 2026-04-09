export const dynamic = 'force-dynamic';

import fs from 'fs';
import path from 'path';
import { getTokensByType, getTokensByCollection, getSpacingPrimitives } from '@/lib/actions/tokens';
import { resolveAliasColors } from '@/lib/tokens/resolve-alias';
import { TOKEN_TYPE_MAP } from '@/lib/tokens/token-types';
import { generateCssCode } from '@/lib/tokens/css-generator';
import ColorGrid from './ColorGrid';
import TypographyList from './TypographyList';
import SpacingList from './SpacingList';
import RadiusList from './RadiusList';
import ShadowList from './ShadowList';
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

  // width/container는 DB에서 type='spacing'으로 저장되어 있어 collection_name 기반 조회
  const COLLECTION_MAP: Record<string, string> = {
    width: '4. Widths',
    container: '5. Containers',
  };

  let tokenRows = await getTokensByType(type);
  let primitives: Awaited<ReturnType<typeof getSpacingPrimitives>> = [];

  if (COLLECTION_MAP[type]) {
    // collection 기반 조회 + 참조 primitive
    tokenRows = await getTokensByCollection(COLLECTION_MAP[type]);
    primitives = await getSpacingPrimitives();
  } else if (type === 'spacing') {
    // spacing 페이지: _Primitives + 3. Spacing만 (width/container 제외)
    tokenRows = tokenRows.filter(
      (t) => t.collectionName === '_Primitives' || t.collectionName === '3. Spacing',
    );
  }

  const initialCss = tokenRows.length > 0 ? generateCssCode(tokenRows, type) : '';

  let fullCss = '';
  try {
    const cssPath = path.join(process.cwd(), 'public', 'css', 'tokens.css');
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
          {type === 'color' && (
            <link rel="stylesheet" href="/css/tokens.css" />
          )}
          <div data-token-grid>
            {type === 'color'                            && <ColorGrid tokens={resolveAliasColors(tokenRows)} />}
            {type === 'typography'                       && <TypographyList tokens={tokenRows} />}
            {(type === 'text-style' || type === 'heading') && <TypographyList tokens={tokenRows} />}
            {(type === 'spacing' || type === 'layout-spacing') && <SpacingList tokens={tokenRows} />}
            {(type === 'container' || type === 'width')  && <SpacingList tokens={tokenRows} primitives={primitives} />}
            {type === 'radius'                           && <RadiusList tokens={tokenRows} />}
            {type === 'shadow'                           && <ShadowList tokens={tokenRows} />}
            {!['color', 'typography', 'text-style', 'heading', 'spacing', 'layout-spacing', 'container', 'width', 'radius', 'shadow'].includes(type) && (
              <GenericTokenList tokens={tokenRows} />
            )}
          </div>
          <TokenCssSection type={type} initialCss={initialCss} fullCss={fullCss} />
        </>
      )}
    </div>
  );
}
