// @page Component Guide — 컴포넌트 상세
'use client';

import { useState, use } from 'react';
import { Icon } from '@iconify/react';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Card from '@/components/common/Card';
import Spinner from '@/components/common/Spinner';
import styles from './page.module.scss';

interface ComponentPageProps {
  params: Promise<{ name: string }>;
}

interface PropDef {
  name: string;
  type: string;
  default: string;
  description: string;
}

interface VariantInfo {
  id: string;
  label: string;
}

const COMPONENT_DATA: Record<string, {
  displayName: string;
  description: string;
  category: string;
  variants: VariantInfo[];
  props: PropDef[];
  tsxCode: string;
  scssCode: string;
}> = {
  button: {
    displayName: 'Button',
    description: '클릭 가능한 버튼 컴포넌트. 여러 variant, size, loading 상태를 지원합니다.',
    category: 'action',
    variants: [
      { id: 'primary', label: 'Primary' },
      { id: 'secondary', label: 'Secondary' },
      { id: 'success', label: 'Success' },
      { id: 'danger', label: 'Danger' },
      { id: 'ghost', label: 'Ghost' },
    ],
    props: [
      { name: 'variant', type: "'primary' | 'secondary' | 'success' | 'danger' | 'ghost'", default: "'primary'", description: '버튼 스타일' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", description: '버튼 크기' },
      { name: 'loading', type: 'boolean', default: 'false', description: '로딩 상태' },
      { name: 'leftIcon', type: 'string', default: '-', description: '왼쪽 아이콘 (Solar)' },
      { name: 'rightIcon', type: 'string', default: '-', description: '오른쪽 아이콘 (Solar)' },
      { name: 'disabled', type: 'boolean', default: 'false', description: '비활성화' },
    ],
    tsxCode: `<Button variant="primary" leftIcon="solar:check-circle-linear">
  저장
</Button>`,
    scssCode: `.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 8px 16px;
  border-radius: $border-radius;
  transition: $transition-spring;
  &:hover { transform: scale(1.02); }
  &:active { transform: scale(0.98); }
}`,
  },
  badge: {
    displayName: 'Badge',
    description: '상태를 표시하는 인라인 배지 컴포넌트.',
    category: 'action',
    variants: [
      { id: 'primary', label: 'Primary' },
      { id: 'secondary', label: 'Secondary' },
      { id: 'success', label: 'Success' },
      { id: 'danger', label: 'Danger' },
      { id: 'warning', label: 'Warning' },
      { id: 'info', label: 'Info' },
      { id: 'gray', label: 'Gray' },
    ],
    props: [
      { name: 'variant', type: "'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'gray'", default: '-', description: '배지 색상' },
      { name: 'children', type: 'ReactNode', default: '-', description: '배지 내용' },
    ],
    tsxCode: `<Badge variant="success">활성</Badge>`,
    scssCode: `.badge { padding: 2px 8px; border-radius: $border-radius-pill; font-size: $font-size-xs; }`,
  },
  modal: {
    displayName: 'Modal',
    description: 'Portal 기반 모달. 포커스 관리, ESC 닫기, body 스크롤 차단을 지원합니다.',
    category: 'feedback',
    variants: [
      { id: 'sm', label: 'Small' },
      { id: 'md', label: 'Medium' },
      { id: 'lg', label: 'Large' },
    ],
    props: [
      { name: 'isOpen', type: 'boolean', default: '-', description: '모달 열림 상태' },
      { name: 'onClose', type: '() => void', default: '-', description: '닫기 콜백' },
      { name: 'title', type: 'string', default: '-', description: '모달 제목' },
      { name: 'size', type: "'sm' | 'md' | 'lg' | 'xl'", default: "'md'", description: '모달 크기' },
    ],
    tsxCode: `<Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="확인">
  <p>정말 삭제하시겠습니까?</p>
</Modal>`,
    scssCode: `.modal-overlay { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,0.6); }`,
  },
};

type CodeTab = 'tsx' | 'scss';

export default function ComponentPage({ params }: ComponentPageProps) {
  const { name } = use(params);
  const [activeVariant, setActiveVariant] = useState(0);
  const [codeTab, setCodeTab] = useState<CodeTab>('tsx');
  const [copied, setCopied] = useState(false);

  const data = COMPONENT_DATA[name];
  const displayName = data?.displayName ?? name.charAt(0).toUpperCase() + name.slice(1);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const currentCode = data ? (codeTab === 'tsx' ? data.tsxCode : data.scssCode) : '';

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Component Guide</span>
        <h1 className={styles.title}>{displayName}</h1>
        <p className={styles.description}>
          {data?.description ?? '컴포넌트 사용법과 속성을 확인합니다.'}
        </p>
        {data && (
          <span className={styles.categoryBadge}>{data.category}</span>
        )}
      </div>

      {/* Live Preview */}
      <section className={styles.previewSection}>
        <h2 className={styles.sectionTitle}>
          <Icon icon="solar:monitor-linear" width={16} height={16} />
          라이브 프리뷰
        </h2>

        {/* Variant tabs */}
        {data && data.variants.length > 0 && (
          <div className={styles.variantTabs} role="tablist">
            {data.variants.map((v, i) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                className={`${styles.variantTab} ${activeVariant === i ? styles.variantActive : ''}`}
                aria-selected={activeVariant === i}
                onClick={() => setActiveVariant(i)}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        <div className={styles.previewStage}>
          <div className={styles.previewStageInner}>
            {/* Render live component preview */}
            {name === 'button' && data && (
              <div className={styles.previewContent}>
                <Button variant={data.variants[activeVariant]?.id as 'primary'}>
                  {data.variants[activeVariant]?.label} 버튼
                </Button>
                <Button variant={data.variants[activeVariant]?.id as 'primary'} size="sm">
                  Small
                </Button>
                <Button variant={data.variants[activeVariant]?.id as 'primary'} size="lg">
                  Large
                </Button>
                <Button variant={data.variants[activeVariant]?.id as 'primary'} loading>
                  Loading
                </Button>
              </div>
            )}
            {name === 'badge' && data && (
              <div className={styles.previewContent}>
                <Badge variant={data.variants[activeVariant]?.id as 'primary'}>
                  {data.variants[activeVariant]?.label}
                </Badge>
              </div>
            )}
            {name === 'spinner' && (
              <div className={styles.previewContent}>
                <Spinner size="sm" />
                <Spinner />
                <Spinner size="lg" />
              </div>
            )}
            {!data && (
              <p className={styles.previewPlaceholder}>
                컴포넌트 프리뷰가 여기에 표시됩니다.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Code block */}
      <section className={styles.codeSection}>
        <div className={styles.codeTabs}>
          <h2 className={styles.sectionTitle}>
            <Icon icon="solar:code-linear" width={16} height={16} />
            코드
          </h2>
          <div className={styles.codeTabBar}>
            <button
              type="button"
              className={`${styles.codeTab} ${codeTab === 'tsx' ? styles.codeTabActive : ''}`}
              onClick={() => setCodeTab('tsx')}
            >
              TSX
            </button>
            <button
              type="button"
              className={`${styles.codeTab} ${codeTab === 'scss' ? styles.codeTabActive : ''}`}
              onClick={() => setCodeTab('scss')}
            >
              SCSS
            </button>
          </div>
        </div>
        <div className={styles.codeBlock}>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={() => handleCopy(currentCode)}
            aria-label="코드 복사"
          >
            <Icon
              icon={copied ? 'solar:check-circle-linear' : 'solar:copy-linear'}
              width={14}
              height={14}
            />
          </button>
          <pre className={styles.pre}>
            <code>{currentCode || `<${displayName} />`}</code>
          </pre>
        </div>
      </section>

      {/* Props table */}
      {data && data.props.length > 0 && (
        <section className={styles.propsSection}>
          <h2 className={styles.sectionTitle}>
            <Icon icon="solar:list-linear" width={16} height={16} />
            Props
          </h2>
          <div className={styles.tableWrapper}>
            <table className={styles.propsTable}>
              <thead>
                <tr>
                  <th>Prop</th>
                  <th>Type</th>
                  <th>Default</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {data.props.map((prop) => (
                  <tr key={prop.name}>
                    <td className={styles.propName}>{prop.name}</td>
                    <td className={styles.propType}>{prop.type}</td>
                    <td className={styles.propDefault}>{prop.default}</td>
                    <td>{prop.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
