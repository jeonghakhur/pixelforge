import { notFound } from 'next/navigation';
import { getTokensByType } from '@/lib/actions/tokens';
import ColorGrid from './ColorGrid';
import TypographyList from './TypographyList';
import SpacingList from './SpacingList';
import RadiusList from './RadiusList';
import styles from './page.module.scss';

const VALID_TYPES = ['color', 'typography', 'spacing', 'radius'] as const;
type TokenType = typeof VALID_TYPES[number];

const TYPE_LABELS: Record<TokenType, string> = {
  color: '색상',
  typography: '타이포그래피',
  spacing: '간격',
  radius: '반경',
};

const TYPE_DESCRIPTIONS: Record<TokenType, string> = {
  color: 'Figma 파일에서 추출된 색상 팔레트를 확인하고 관리합니다.',
  typography: '텍스트 스타일과 타입 스케일을 체계적으로 관리합니다.',
  spacing: '레이아웃 간격 시스템을 정의하고 일관성을 유지합니다.',
  radius: '모서리 둥글기 토큰을 관리합니다.',
};

interface TokenPageProps {
  params: Promise<{ type: string }>;
}

export default async function TokenPage({ params }: TokenPageProps) {
  const { type } = await params;

  if (!VALID_TYPES.includes(type as TokenType)) {
    notFound();
  }

  const tokenType = type as TokenType;
  const tokenRows = await getTokensByType(tokenType);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Design Tokens</span>
        <h1 className={styles.title}>{TYPE_LABELS[tokenType]} 토큰</h1>
        <p className={styles.description}>{TYPE_DESCRIPTIONS[tokenType]}</p>
        {tokenRows.length > 0 && (
          <p className={styles.count}>{tokenRows.length}개 추출됨</p>
        )}
      </div>

      {tokenRows.length === 0 ? (
        <div className={styles.stage}>
          <div className={styles.stageInner}>
            <p className={styles.empty}>Figma에서 토큰을 추출하면 여기에 표시됩니다.</p>
          </div>
        </div>
      ) : (
        <>
          {tokenType === 'color' && <ColorGrid tokens={tokenRows} />}
          {tokenType === 'typography' && <TypographyList tokens={tokenRows} />}
          {tokenType === 'spacing' && <SpacingList tokens={tokenRows} />}
          {tokenType === 'radius' && <RadiusList tokens={tokenRows} />}
        </>
      )}
    </div>
  );
}
