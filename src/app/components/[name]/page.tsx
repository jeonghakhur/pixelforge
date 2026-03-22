import styles from './page.module.scss';

interface ComponentPageProps {
  params: Promise<{ name: string }>;
}

export default async function ComponentPage({ params }: ComponentPageProps) {
  const { name } = await params;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Component Guide</span>
        <h1 className={styles.title}>{name}</h1>
        <p className={styles.description}>컴포넌트 사용법과 속성을 확인합니다.</p>
      </div>

      <div className={styles.preview}>
        <div className={styles.previewStage}>
          <p className={styles.empty}>컴포넌트 프리뷰가 여기에 표시됩니다.</p>
        </div>
      </div>

      <div className={styles.codeSection}>
        <h2 className={styles.sectionTitle}>코드</h2>
        <div className={styles.codeBlock}>
          <pre className={styles.pre}>
            <code>{`<${name.charAt(0).toUpperCase() + name.slice(1)} />`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
