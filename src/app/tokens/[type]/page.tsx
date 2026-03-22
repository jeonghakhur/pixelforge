import { notFound } from 'next/navigation';
import styles from './page.module.scss';

const VALID_TYPES = ['color', 'typography', 'spacing', 'radius'] as const;

const TYPE_LABELS: Record<string, string> = {
  color: '색상',
  typography: '타이포그래피',
  spacing: '간격',
  radius: '반경',
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
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

  if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
    notFound();
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Design Tokens</span>
        <h1 className={styles.title}>{TYPE_LABELS[type]} 토큰</h1>
        <p className={styles.description}>{TYPE_DESCRIPTIONS[type]}</p>
      </div>

      <div className={styles.stage}>
        <div className={styles.stageInner}>
          <p className={styles.empty}>Figma에서 토큰을 추출하면 여기에 표시됩니다.</p>
        </div>
      </div>
    </div>
  );
}
