'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Card from '@/components/common/Card';
import Chip from '@/components/common/Chip';
import Spinner from '@/components/common/Spinner';
import Modal from '@/components/common/Modal';
import ToastContainer, { type ToastItem } from '@/components/common/Toast';
import EmptyState from '@/components/common/EmptyState';
import styles from './page.module.scss';

interface Props {
  name: string;
  displayName: string;
  description: string;
  category: string;
  tsx: string | null;
  scss: string | null;
  isGenerated: boolean;
}

type CodeTab = 'tsx' | 'scss';

// ===========================
// Props 메타데이터
// ===========================
interface PropDef { name: string; type: string; default: string; description: string }

const PROPS_META: Record<string, PropDef[]> = {
  button: [
    { name: 'variant', type: "'primary'|'secondary'|'ghost'|'success'|'danger'", default: "'primary'", description: '버튼 스타일' },
    { name: 'size', type: "'sm'|'md'|'lg'", default: "'md'", description: '버튼 크기' },
    { name: 'loading', type: 'boolean', default: 'false', description: '로딩 상태' },
    { name: 'leftIcon', type: 'string', default: '-', description: 'Solar 아이콘 ID' },
    { name: 'rightIcon', type: 'string', default: '-', description: 'Solar 아이콘 ID' },
    { name: 'disabled', type: 'boolean', default: 'false', description: '비활성화' },
  ],
  badge: [
    { name: 'variant', type: "'primary'|'secondary'|'success'|'danger'|'warning'|'info'|'gray'", default: '-', description: '배지 색상' },
    { name: 'children', type: 'ReactNode', default: '-', description: '배지 내용' },
  ],
  card: [
    { name: 'children', type: 'ReactNode', default: '-', description: '카드 내용' },
    { name: 'className', type: 'string', default: "''", description: '추가 클래스' },
  ],
  chip: [
    { name: 'label', type: 'string', default: '-', description: '칩 텍스트' },
    { name: 'active', type: 'boolean', default: 'false', description: '활성 상태' },
    { name: 'removable', type: 'boolean', default: 'false', description: '제거 버튼 표시' },
    { name: 'onClick', type: '() => void', default: '-', description: '클릭 핸들러' },
    { name: 'onRemove', type: '() => void', default: '-', description: '제거 핸들러' },
  ],
  spinner: [
    { name: 'size', type: "'sm'|'md'|'lg'", default: "'md'", description: '스피너 크기' },
    { name: 'label', type: 'string', default: "'로딩 중'", description: 'aria-label' },
  ],
  modal: [
    { name: 'isOpen', type: 'boolean', default: '-', description: '모달 열림 상태' },
    { name: 'onClose', type: '() => void', default: '-', description: '닫기 콜백' },
    { name: 'title', type: 'string', default: '-', description: '모달 제목' },
    { name: 'size', type: "'sm'|'md'|'lg'|'xl'", default: "'md'", description: '모달 크기' },
  ],
  toast: [
    { name: 'message', type: 'string', default: '-', description: '알림 메시지' },
    { name: 'variant', type: "'success'|'danger'|'warning'|'info'", default: "'info'", description: '알림 종류' },
    { name: 'duration', type: 'number', default: '3000', description: '자동 닫기 ms' },
    { name: 'onClose', type: '() => void', default: '-', description: '닫기 콜백' },
  ],
  'form-group': [
    { name: 'id', type: 'string', default: '-', description: 'input id' },
    { name: 'label', type: 'string', default: '-', description: '레이블 텍스트' },
    { name: 'error', type: 'string', default: '-', description: '에러 메시지' },
    { name: 'hint', type: 'string', default: '-', description: '힌트 텍스트' },
    { name: 'required', type: 'boolean', default: 'false', description: '필수 표시' },
  ],
  nav: [
    { name: 'items', type: 'NavItem[]', default: '-', description: '탭 목록 ({id, label})' },
    { name: 'activeId', type: 'string', default: '-', description: '활성 탭 id' },
    { name: 'onChange', type: '(id: string) => void', default: '-', description: '탭 변경 콜백' },
  ],
  pagination: [
    { name: 'currentPage', type: 'number', default: '-', description: '현재 페이지' },
    { name: 'totalPages', type: 'number', default: '-', description: '전체 페이지 수' },
    { name: 'onChange', type: '(page: number) => void', default: '-', description: '페이지 변경 콜백' },
  ],
  dropdown: [
    { name: 'trigger', type: 'ReactNode', default: '-', description: '트리거 요소' },
    { name: 'items', type: 'DropdownItem[]', default: '-', description: '메뉴 항목' },
    { name: 'onSelect', type: '(id: string) => void', default: '-', description: '항목 선택 콜백' },
    { name: 'align', type: "'left'|'right'", default: "'left'", description: '메뉴 정렬' },
  ],
};

// ===========================
// 라이브 프리뷰 컴포넌트
// ===========================
function LivePreview({ name }: { name: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [navActive, setNavActive] = useState('home');
  const [currentPage, setCurrentPage] = useState(1);

  switch (name) {
    case 'button':
      return (
        <div className={styles.previewRow}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="success" leftIcon="solar:check-circle-linear">Success</Button>
          <Button variant="danger" size="sm">Danger sm</Button>
          <Button variant="primary" loading>Loading</Button>
        </div>
      );

    case 'badge':
      return (
        <div className={styles.previewRow}>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="gray">Gray</Badge>
        </div>
      );

    case 'card':
      return (
        <Card className={styles.previewCard}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            Double-Bezel 카드 컨텐츠 영역입니다.
          </p>
        </Card>
      );

    case 'chip':
      return (
        <div className={styles.previewRow}>
          <Chip>기본</Chip>
          <Chip active>활성</Chip>
          <Chip removable onRemove={() => {}}>제거 가능</Chip>
          <Chip active removable onRemove={() => {}}>활성 + 제거</Chip>
        </div>
      );

    case 'spinner':
      return (
        <div className={styles.previewRow}>
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </div>
      );

    case 'modal':
      return (
        <div className={styles.previewRow}>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            모달 열기
          </Button>
          <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="예시 모달">
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Portal 기반 모달입니다. ESC 또는 오버레이 클릭으로 닫힙니다.
            </p>
          </Modal>
        </div>
      );

    case 'toast':
      return (
        <div className={styles.previewRow}>
          {(['success', 'danger', 'warning', 'info'] as const).map((v) => (
            <Button
              key={v}
              variant="secondary"
              onClick={() => {
                const id = crypto.randomUUID();
                setToasts((prev) => [...prev, { id, variant: v, message: `${v} 알림 메시지입니다.` }]);
              }}
            >
              {v}
            </Button>
          ))}
          <ToastContainer toasts={toasts} onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
        </div>
      );

    case 'form-group':
      return (
        <div className={styles.previewFormGroup}>
          <div className={styles.previewFormRow}>
            <label htmlFor="preview-name" style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              이름 <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              id="preview-name"
              type="text"
              placeholder="이름을 입력하세요"
              style={{
                width: '100%', padding: '0.5rem 0.75rem',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', color: 'rgba(255,255,255,0.9)', fontSize: '0.875rem',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
          <div className={styles.previewFormRow}>
            <label htmlFor="preview-email" style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              이메일
            </label>
            <input
              id="preview-email"
              type="email"
              placeholder="email@example.com"
              style={{
                width: '100%', padding: '0.5rem 0.75rem',
                background: 'rgba(255,255,255,0.04)', border: '1px solid #f87171',
                borderRadius: '8px', color: 'rgba(255,255,255,0.9)', fontSize: '0.875rem',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <p style={{ fontSize: '0.75rem', color: '#f87171', margin: 0 }}>올바른 이메일 형식이 아닙니다.</p>
          </div>
        </div>
      );

    case 'form-select':
      return (
        <div style={{ width: '240px', position: 'relative' }}>
          <select
            style={{
              width: '100%', padding: '0.5rem 2rem 0.5rem 0.75rem',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px', color: 'rgba(255,255,255,0.9)', fontSize: '0.875rem',
              appearance: 'none', cursor: 'pointer', outline: 'none',
            }}
          >
            <option>옵션 1</option>
            <option>옵션 2</option>
            <option>옵션 3</option>
          </select>
          <Icon icon="solar:alt-arrow-down-linear" width={14} height={14}
            style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.4)' }}
          />
        </div>
      );

    case 'form-check':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {['체크박스 옵션 1', '체크박스 옵션 2'].map((label, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)' }}>
              <input type="checkbox" style={{ accentColor: '#3b82f6', width: 16, height: 16 }} defaultChecked={i === 0} />
              {label}
            </label>
          ))}
        </div>
      );

    case 'form-textarea':
      return (
        <textarea
          placeholder="내용을 입력하세요..."
          rows={4}
          style={{
            width: '100%', maxWidth: '400px', padding: '0.5rem 0.75rem',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', color: 'rgba(255,255,255,0.9)', fontSize: '0.875rem',
            resize: 'vertical', outline: 'none', fontFamily: 'inherit',
          }}
        />
      );

    case 'nav': {
      const navItems = [
        { id: 'home', label: 'Home' },
        { id: 'tokens', label: 'Tokens' },
        { id: 'components', label: 'Components' },
      ];
      return (
        <nav style={{ display: 'flex', gap: '0.125rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setNavActive(item.id)}
              style={{
                padding: '0.5rem 0.875rem', fontSize: '0.8125rem', fontWeight: 500,
                background: 'none', border: 'none', borderBottom: `2px solid ${navActive === item.id ? '#3b82f6' : 'transparent'}`,
                color: navActive === item.id ? '#3b82f6' : 'rgba(255,255,255,0.45)',
                cursor: 'pointer', marginBottom: '-1px', transition: 'all 0.2s',
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      );
    }

    case 'pagination':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {[1, 2, 3, 4, 5].map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setCurrentPage(page)}
              style={{
                minWidth: 32, height: 32, padding: '0 0.5rem', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                background: currentPage === page ? '#3b82f6' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${currentPage === page ? '#3b82f6' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '6px', color: currentPage === page ? '#fff' : 'rgba(255,255,255,0.6)',
                fontSize: '0.8125rem', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {page}
            </button>
          ))}
        </div>
      );

    case 'dropdown':
      return (
        <div className={styles.previewRow}>
          <EmptyState
            icon="solar:alt-arrow-down-linear"
            title="Dropdown 프리뷰"
            description="생성된 코드를 복사하여 프로젝트에서 사용해보세요."
          />
        </div>
      );

    default:
      return (
        <EmptyState
          icon="solar:widget-2-linear"
          title="프리뷰 없음"
          description="이 컴포넌트는 프리뷰를 지원하지 않습니다."
        />
      );
  }
}

// ===========================
// 메인 클라이언트 컴포넌트
// ===========================
export default function ComponentGuideClient({
  name,
  displayName,
  description,
  category,
  tsx,
  scss,
  isGenerated,
}: Props) {
  const router = useRouter();
  const [codeTab, setCodeTab] = useState<CodeTab>('tsx');
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const currentCode = codeTab === 'tsx' ? (tsx ?? '') : (scss ?? '');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Component Guide</span>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{displayName}</h1>
          <span className={styles.categoryBadge}>{category}</span>
        </div>
        <p className={styles.description}>{description}</p>
        {!isGenerated && (
          <div className={styles.notGenerated}>
            <Icon icon="solar:info-circle-linear" width={14} height={14} />
            <span>아직 생성되지 않았습니다.</span>
            <button
              type="button"
              className={styles.generateLink}
              onClick={() => router.push('/components/new')}
            >
              컴포넌트 생성하기
              <Icon icon="solar:arrow-right-linear" width={12} height={12} />
            </button>
          </div>
        )}
      </div>

      {/* Live Preview */}
      <section className={styles.previewSection}>
        <h2 className={styles.sectionTitle}>
          <Icon icon="solar:monitor-linear" width={16} height={16} />
          라이브 프리뷰
        </h2>
        <div className={styles.previewStage}>
          <div className={styles.previewStageInner}>
            <LivePreview name={name} />
          </div>
        </div>
      </section>

      {/* Code block */}
      <section className={styles.codeSection}>
        <div className={styles.codeTabs}>
          <h2 className={styles.sectionTitle}>
            <Icon icon="solar:code-linear" width={16} height={16} />
            생성된 코드
          </h2>
          <div className={styles.codeTabBar}>
            {(['tsx', 'scss'] as CodeTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`${styles.codeTab} ${codeTab === tab ? styles.codeTabActive : ''}`}
                onClick={() => setCodeTab(tab)}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.codeBlock}>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={() => handleCopy(currentCode)}
            aria-label="코드 복사"
            disabled={!currentCode}
          >
            <Icon
              icon={copied ? 'solar:check-circle-linear' : 'solar:copy-linear'}
              width={14}
              height={14}
            />
          </button>
          <pre className={styles.pre}>
            <code>
              {currentCode || `// 컴포넌트를 생성하면 코드가 여기에 표시됩니다.\n// 상단의 "컴포넌트 생성하기" 버튼을 클릭하세요.`}
            </code>
          </pre>
        </div>
      </section>

      {/* Props table */}
      {PROPS_META[name] && (
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
                {PROPS_META[name].map((prop) => (
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
