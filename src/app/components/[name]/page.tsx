interface ComponentPageProps {
  params: Promise<{ name: string }>;
}

export default async function ComponentPage({ params }: ComponentPageProps) {
  const { name } = await params;

  return (
    <div>
      <h1>{name} 컴포넌트</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
        컴포넌트 가이드 페이지입니다.
      </p>
    </div>
  );
}
