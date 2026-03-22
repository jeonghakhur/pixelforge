import { notFound } from 'next/navigation';

const VALID_TYPES = ['color', 'typography', 'spacing', 'radius'] as const;

const TYPE_LABELS: Record<string, string> = {
  color: '색상',
  typography: '타이포그래피',
  spacing: '간격',
  radius: '반경',
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
    <div>
      <h1>{TYPE_LABELS[type]} 토큰</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
        Figma에서 토큰을 추출하면 여기에 표시됩니다.
      </p>
    </div>
  );
}
