export default function ComponentsIndexPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: '0.5rem',
      color: 'var(--text-muted)',
      fontSize: '0.875rem',
    }}>
      <span>Figma 플러그인에서 컴포넌트를 전송하면</span>
      <span>사이드바에 자동으로 표시됩니다.</span>
    </div>
  );
}
