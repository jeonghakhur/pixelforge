import { notFound } from 'next/navigation';
import { getTokensByType, getTokenSourceAction } from '@/lib/actions/tokens';
import { TOKEN_TYPE_MAP } from '@/lib/tokens/token-types';
import ColorGrid from './ColorGrid';
import TypographyList from './TypographyList';
import SpacingList from './SpacingList';
import RadiusList from './RadiusList';
import GenericTokenList from './GenericTokenList';
import TokenPageActions from './TokenPageActions';
import CompareActions from './CompareActions';
import CopyUrlInline from './CopyUrlInline';
import JsonImportSection from './JsonImportSection';
import styles from './page.module.scss';

interface TokenPageProps {
  params: Promise<{ type: string }>;
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).format(d);
}

export default async function TokenPage({ params }: TokenPageProps) {
  const { type } = await params;

  const typeConfig = TOKEN_TYPE_MAP[type];
  if (!typeConfig) notFound();

  const [tokenRows, tokenSource] = await Promise.all([
    getTokensByType(type),
    getTokenSourceAction(type),
  ]);

  const extractionSource = tokenRows.length > 0 ? tokenRows[0].source : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.eyebrow}>Design Tokens</span>
          <h1 className={styles.title}>{typeConfig.label} 토큰</h1>
          <p className={styles.description}>{typeConfig.description}</p>
          {tokenRows.length > 0 && (
            <p className={styles.count}>{tokenRows.length}개 추출됨</p>
          )}
          {tokenSource && (
            <p className={styles.sourceMeta}>
              마지막 추출: {formatDate(tokenSource.lastExtractedAt)}
              {' · '}
              <CopyUrlInline url={tokenSource.figmaUrl} />
            </p>
          )}
        </div>
        <div className={styles.headerActions}>
          <TokenPageActions type={type} count={tokenRows.length} />
        </div>
        {extractionSource && (
          <div className={`${styles.sourceBanner} ${extractionSource === 'variables' ? styles.sourceBannerVariables : styles.sourceBannerScan}`}>
            <span className={styles.sourceDot} />
            {extractionSource === 'variables'
              ? 'Variables API — 디자이너가 정의한 토큰'
              : '노드 스캔 — Variables 없음'}
          </div>
        )}
      </div>

      {tokenRows.length === 0 ? (
        <div className={styles.stage}>
          <div className={styles.stageInner}>
            <div className={styles.emptyBlock}>
              <p className={styles.empty}>추출된 토큰이 없습니다.</p>
              <p className={styles.emptyHint}>Figma URL로 추출하거나 JSON을 직접 가져올 수 있습니다.</p>
            </div>
            <JsonImportSection />
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
          <JsonImportSection collapsed />
        </>
      )}

      {(tokenSource?.figmaScreenshot || tokenSource?.uiScreenshot) && (
        <section className={styles.compareSection}>
          <div className={styles.compareTitleRow}>
            <div>
              <h2 className={styles.compareTitle}>디자인 비교</h2>
              <p className={styles.compareMeta}>캡처: {formatDate(tokenSource.lastExtractedAt)}</p>
            </div>
            <CompareActions
              type={type}
              figmaKey={tokenSource.figmaKey}
              figmaUrl={tokenSource.figmaUrl}
            />
          </div>
          <div className={styles.compareGrid}>
            {tokenSource.figmaScreenshot && (
              <div className={styles.comparePanel}>
                <div className={styles.comparePanelLabel}>
                  <span className={styles.compareDot} style={{ background: '#a259ff' }} />
                  Figma 원본
                </div>
                <div className={styles.compareFrame}>
                  <img
                    src={tokenSource.figmaScreenshot}
                    alt={`${typeConfig.label} Figma 원본`}
                    className={styles.compareImg}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            )}
            {tokenSource.uiScreenshot && (
              <div className={styles.comparePanel}>
                <div className={styles.comparePanelLabel}>
                  <span className={styles.compareDot} style={{ background: 'var(--accent)' }} />
                  PixelForge 렌더링
                </div>
                <div className={styles.compareFrame}>
                  <img
                    src={tokenSource.uiScreenshot}
                    alt={`${typeConfig.label} PixelForge 렌더링`}
                    className={styles.compareImg}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
