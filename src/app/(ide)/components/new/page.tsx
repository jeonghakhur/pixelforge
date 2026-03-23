// @page Component New — 컴포넌트 추가
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import Button from '@/components/common/Button';
import { generateComponentsAction } from '@/lib/actions/components';
import styles from './page.module.scss';

interface ComponentOption {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
}

const CATEGORIES = [
  { id: 'action', label: 'Action', icon: 'solar:cursor-linear' },
  { id: 'form', label: 'Form', icon: 'solar:document-text-linear' },
  { id: 'navigation', label: 'Navigation', icon: 'solar:compass-linear' },
  { id: 'feedback', label: 'Feedback', icon: 'solar:bell-linear' },
];

const COMPONENT_OPTIONS: ComponentOption[] = [
  { id: 'button', name: 'Button', category: 'action', icon: 'solar:cursor-linear', description: '클릭 가능한 버튼 (variant, size, loading)' },
  { id: 'badge', name: 'Badge', category: 'action', icon: 'solar:tag-horizontal-linear', description: '상태 표시 배지 (7가지 variant)' },
  { id: 'chip', name: 'Chip', category: 'action', icon: 'solar:hashtag-linear', description: '태그/필터 칩 (active, removable)' },
  { id: 'card', name: 'Card', category: 'action', icon: 'solar:card-linear', description: 'Double-Bezel 카드 컨테이너' },
  { id: 'form-group', name: 'FormGroup', category: 'form', icon: 'solar:text-field-linear', description: 'label + input + error 래퍼' },
  { id: 'form-select', name: 'FormSelect', category: 'form', icon: 'solar:list-down-linear', description: '셀렉트 박스' },
  { id: 'form-check', name: 'FormCheck', category: 'form', icon: 'solar:check-square-linear', description: '체크박스/라디오' },
  { id: 'form-textarea', name: 'FormTextarea', category: 'form', icon: 'solar:text-linear', description: '텍스트 영역' },
  { id: 'nav', name: 'Nav', category: 'navigation', icon: 'solar:compass-linear', description: '네비게이션/탭' },
  { id: 'pagination', name: 'Pagination', category: 'navigation', icon: 'solar:rewind-forward-linear', description: '페이지네이션' },
  { id: 'dropdown', name: 'Dropdown', category: 'navigation', icon: 'solar:alt-arrow-down-linear', description: '드롭다운 메뉴' },
  { id: 'modal', name: 'Modal', category: 'feedback', icon: 'solar:window-frame-linear', description: 'Portal 기반 모달 (포커스 관리, ARIA)' },
  { id: 'toast', name: 'Toast', category: 'feedback', icon: 'solar:bell-linear', description: '자동 닫기 알림 (3초)' },
  { id: 'spinner', name: 'Spinner', category: 'feedback', icon: 'solar:refresh-linear', description: '로딩 스피너 (sm, md, lg)' },
];

export default function NewComponentPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filtered = filterCategory
    ? COMPONENT_OPTIONS.filter((c) => c.category === filterCategory)
    : COMPONENT_OPTIONS;

  const handleGenerate = async () => {
    if (selected.size === 0) return;
    setIsGenerating(true);
    setServerError(null);

    const res = await generateComponentsAction([...selected]);
    setIsGenerating(false);

    if (res.error) {
      setServerError(res.error);
      return;
    }

    router.push(`/components/${[...selected][0]}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Component Generator</span>
        <h1 className={styles.title}>컴포넌트 추가</h1>
        <p className={styles.description}>
          Bootstrap 클론 컴포넌트를 선택하여 현재 토큰 기반으로 생성합니다.
        </p>
      </div>

      {/* Category filter */}
      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.filterChip} ${filterCategory === null ? styles.filterActive : ''}`}
          onClick={() => setFilterCategory(null)}
        >
          전체 {COMPONENT_OPTIONS.length}
        </button>
        {CATEGORIES.map((cat) => {
          const count = COMPONENT_OPTIONS.filter((c) => c.category === cat.id).length;
          return (
            <button
              key={cat.id}
              type="button"
              className={`${styles.filterChip} ${filterCategory === cat.id ? styles.filterActive : ''}`}
              onClick={() => setFilterCategory(cat.id)}
            >
              <Icon icon={cat.icon} width={14} height={14} />
              {cat.label} {count}
            </button>
          );
        })}
      </div>

      {/* Component grid */}
      <div className={styles.grid}>
        {filtered.map((comp) => {
          const isSelected = selected.has(comp.id);
          return (
            <button
              key={comp.id}
              type="button"
              className={`${styles.compCard} ${isSelected ? styles.compSelected : ''}`}
              onClick={() => toggleSelect(comp.id)}
              aria-pressed={isSelected}
            >
              <div className={styles.compCardInner}>
                <div className={styles.compIcon}>
                  <Icon icon={comp.icon} width={20} height={20} />
                </div>
                <div className={styles.compInfo}>
                  <span className={styles.compName}>{comp.name}</span>
                  <span className={styles.compDesc}>{comp.description}</span>
                </div>
                <div className={styles.compCheck}>
                  {isSelected && <Icon icon="solar:check-circle-bold" width={18} height={18} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Error */}
      {serverError && (
        <p className={styles.serverError} role="alert">{serverError}</p>
      )}

      {/* Action bar */}
      {selected.size > 0 && (
        <div className={styles.actionBar}>
          <span className={styles.selectedCount}>
            {selected.size}개 선택됨
          </span>
          <Button
            variant="primary"
            rightIcon="solar:arrow-right-linear"
            loading={isGenerating}
            onClick={handleGenerate}
          >
            {isGenerating ? '생성 중...' : '생성'}
          </Button>
        </div>
      )}
    </div>
  );
}
