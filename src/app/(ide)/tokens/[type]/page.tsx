export const dynamic = 'force-dynamic';

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
import TokenImportTabs from '@/components/common/TokenImportTabs';
import { Icon } from '@iconify/react';
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

type TokenSource = 'variables' | 'styles-api' | 'section-scan' | 'node-scan' | null;

interface SourceBadge {
  label: string;
  className: string;
}

function getSourceBadge(source: TokenSource): SourceBadge | null {
  if (!source) return null;
  switch (source) {
    case 'variables':
      return { label: 'Variables API', className: styles.sourceBannerVariables };
    case 'styles-api':
      return { label: 'Styles API', className: styles.sourceBannerStylesApi };
    case 'node-scan':
    case 'section-scan':
      return { label: '노드 스캔', className: styles.sourceBannerScan };
    default:
      return null;
  }
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

  const [tokenRows, tokenSource] = await Promise.all([
    getTokensByType(type),
    getTokenSourceAction(type),
  ]);

  const extractionSource = tokenRows.length > 0
    ? (tokenRows[0].source as TokenSource)
    : null;
  const sourceBadge = getSourceBadge(extractionSource);

  const hasScreenshots = !!(tokenSource?.figmaScreenshot || tokenSource?.uiScreenshot);

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
        </div>
        <div className={styles.headerActions}>
          <TokenPageActions type={type} count={tokenRows.length} />
        </div>
        {sourceBadge && (
          <div className={`${styles.sourceBanner} ${sourceBadge.className}`}>
            <span className={styles.sourceDot} />
            {sourceBadge.label}
          </div>
        )}
      </div>

      {tokenRows.length === 0 ? (
        <div className={styles.stage}>
          <div className={styles.stageInner}>
            {/* Empty State — 플러그인 우선 안내 */}
            <div className={styles.emptyBlock}>
              <Icon icon="solar:layers-minimalistic-linear" width={32} height={32} className={styles.emptyIcon} />
              <p className={styles.empty}>토큰이 아직 없습니다</p>
              <p className={styles.emptyHint}>
                Figma 플러그인으로 자동 동기화하거나 JSON 파일을 가져올 수 있습니다.
              </p>
            </div>
            <TokenImportTabs />
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

      {/* 디자인 비교 — 항상 표시 */}
      <section className={styles.compareSection}>
        <div className={styles.compareTitleRow}>
          <div>
            <h2 className={styles.compareTitle}>디자인 비교</h2>
            <p className={styles.compareMeta}>
              {hasScreenshots
                ? `캡처: ${formatDate(tokenSource?.lastExtractedAt ?? null)}`
                : '플러그인 sync 시 자동으로 캡처됩니다.'}
            </p>
          </div>
          <CompareActions
            type={type}
            figmaKey={tokenSource?.figmaKey ?? null}
            figmaUrl={tokenSource?.figmaUrl ?? null}
          />
        </div>
        <div className={styles.compareGrid}>
          {/* Figma 원본 */}
          <div className={styles.comparePanel}>
            <div className={styles.comparePanelLabel}>
              <span className={styles.compareDot} style={{ background: '#a259ff' }} />
              Figma 원본
            </div>
            {tokenSource?.figmaScreenshot ? (
              <div className={styles.compareFrame}>
                <img
                  src={tokenSource.figmaScreenshot}
                  alt={`${typeConfig.label} Figma 원본`}
                  className={styles.compareImg}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : (
              <div className={`${styles.compareFrame} ${styles.compareFrameEmpty}`}>
                <Icon icon="solar:figma-linear" width={24} height={24} className={styles.compareEmptyIcon} />
                <p className={styles.compareEmptyText}>캡처 없음</p>
                {tokenSource?.figmaKey && (
                  <p className={styles.compareEmptyHint}>Figma URL을 연결하면 자동 캡처됩니다.</p>
                )}
              </div>
            )}
          </div>

          {/* PixelForge 렌더링 */}
          <div className={styles.comparePanel}>
            <div className={styles.comparePanelLabel}>
              <span className={styles.compareDot} style={{ background: 'var(--accent)' }} />
              PixelForge 렌더링
            </div>
            {tokenSource?.uiScreenshot ? (
              <div className={styles.compareFrame}>
                <img
                  src={tokenSource.uiScreenshot}
                  alt={`${typeConfig.label} PixelForge 렌더링`}
                  className={styles.compareImg}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : (
              <div className={`${styles.compareFrame} ${styles.compareFrameEmpty}`}>
                <Icon icon="solar:monitor-linear" width={24} height={24} className={styles.compareEmptyIcon} />
                <p className={styles.compareEmptyText}>캡처 없음</p>
                <p className={styles.compareEmptyHint}>sync 후 자동으로 업데이트됩니다.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
