// @page Diff — 변경 감지
'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/common/Button';
import styles from './page.module.scss';

type DiffStatus = 'changed' | 'added' | 'removed' | 'unchanged';

interface DiffItem {
  id: string;
  tokenName: string;
  type: string;
  status: DiffStatus;
  oldValue?: string;
  newValue?: string;
  affectedComponents: string[];
}

const STATUS_CONFIG: Record<DiffStatus, { label: string; icon: string }> = {
  changed: { label: '변경됨', icon: 'solar:pen-new-square-linear' },
  added: { label: '신규', icon: 'solar:add-circle-linear' },
  removed: { label: '삭제됨', icon: 'solar:minus-circle-linear' },
  unchanged: { label: '동일', icon: 'solar:check-circle-linear' },
};

// TODO: replace with real data
const diffItems: DiffItem[] = [];
const versions = ['v1', 'v2', 'v3'];

export default function DiffPage() {
  const [baseVersion, setBaseVersion] = useState(versions[0] ?? '');
  const [compareVersion, setCompareVersion] = useState(versions[1] ?? '');
  const [filter, setFilter] = useState<DiffStatus | 'all'>('all');

  const filtered = filter === 'all'
    ? diffItems
    : diffItems.filter((item) => item.status === filter);

  const isEmpty = diffItems.length === 0;

  const counts = {
    changed: diffItems.filter((i) => i.status === 'changed').length,
    added: diffItems.filter((i) => i.status === 'added').length,
    removed: diffItems.filter((i) => i.status === 'removed').length,
    unchanged: diffItems.filter((i) => i.status === 'unchanged').length,
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Change Detection</span>
        <h1 className={styles.title}>변경 감지</h1>
        <p className={styles.description}>
          디자인 토큰 버전 간 변경 사항을 추적하고 영향받는 컴포넌트를 확인합니다.
        </p>
      </div>

      {/* Version selectors */}
      <div className={styles.controls}>
        <div className={styles.versionSelect}>
          <label htmlFor="base-version" className={styles.selectLabel}>Base</label>
          <select
            id="base-version"
            className={styles.select}
            value={baseVersion}
            onChange={(e) => setBaseVersion(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className={styles.arrow}>
          <Icon icon="solar:arrow-right-linear" width={16} height={16} />
        </div>
        <div className={styles.versionSelect}>
          <label htmlFor="compare-version" className={styles.selectLabel}>Compare</label>
          <select
            id="compare-version"
            className={styles.select}
            value={compareVersion}
            onChange={(e) => setCompareVersion(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <Button variant="primary" leftIcon="solar:refresh-linear">
          비교
        </Button>
      </div>

      {isEmpty ? (
        <div className={styles.stage}>
          <div className={styles.stageInner}>
            <EmptyState
              icon="solar:code-scan-linear"
              title="변경 내역이 없습니다"
              description="토큰을 두 번 이상 추출하면 버전 간 비교가 가능합니다."
              action={
                <Button variant="primary" leftIcon="solar:link-linear">
                  Figma URL 입력하기
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <>
          {/* Status summary */}
          <div className={styles.statusBar}>
            <button
              type="button"
              className={`${styles.statusChip} ${filter === 'all' ? styles.statusActive : ''}`}
              onClick={() => setFilter('all')}
            >
              전체 {diffItems.length}
            </button>
            {(Object.entries(counts) as [DiffStatus, number][]).map(([status, count]) => (
              <button
                key={status}
                type="button"
                className={`${styles.statusChip} ${styles[`status_${status}`]} ${filter === status ? styles.statusActive : ''}`}
                onClick={() => setFilter(status)}
              >
                <Icon icon={STATUS_CONFIG[status].icon} width={14} height={14} />
                {STATUS_CONFIG[status].label} {count}
              </button>
            ))}
          </div>

          {/* Diff list */}
          <div className={styles.diffList}>
            {filtered.map((item) => (
              <div key={item.id} className={`${styles.diffItem} ${styles[`diff_${item.status}`]}`}>
                <div className={styles.diffHeader}>
                  <Icon icon={STATUS_CONFIG[item.status].icon} width={16} height={16} />
                  <span className={styles.diffName}>{item.tokenName}</span>
                  <span className={styles.diffType}>{item.type}</span>
                  <span className={`${styles.diffBadge} ${styles[`badge_${item.status}`]}`}>
                    {STATUS_CONFIG[item.status].label}
                  </span>
                </div>
                {(item.oldValue || item.newValue) && (
                  <div className={styles.diffValues}>
                    {item.oldValue && (
                      <div className={styles.diffOld}>
                        <span className={styles.diffValueLabel}>Before</span>
                        <code className={styles.diffCode}>{item.oldValue}</code>
                      </div>
                    )}
                    {item.newValue && (
                      <div className={styles.diffNew}>
                        <span className={styles.diffValueLabel}>After</span>
                        <code className={styles.diffCode}>{item.newValue}</code>
                      </div>
                    )}
                  </div>
                )}
                {item.affectedComponents.length > 0 && (
                  <div className={styles.affected}>
                    <span className={styles.affectedLabel}>영향받는 컴포넌트:</span>
                    {item.affectedComponents.map((comp) => (
                      <span key={comp} className={styles.affectedChip}>{comp}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Regenerate */}
          <div className={styles.actions}>
            <Button variant="primary" rightIcon="solar:arrow-right-linear">
              영향받는 컴포넌트 재생성
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
