// @page Pages — 화면 목록
'use client';

import { Icon } from '@iconify/react';
import EmptyState from '@/components/common/EmptyState';
import Button from '@/components/common/Button';
import styles from './page.module.scss';

interface PageItem {
  id: string;
  name: string;
  category: string;
  matchRate: number | null;
  updatedAt: string;
}

const CATEGORIES = [
  { id: 'auth', label: '인증', icon: 'solar:lock-linear' },
  { id: 'dashboard', label: '대시보드', icon: 'solar:chart-square-linear' },
  { id: 'crud', label: 'CRUD', icon: 'solar:database-linear' },
  { id: 'settings', label: '설정', icon: 'solar:settings-linear' },
];

// TODO: replace with real data from DB
const pages: PageItem[] = [];

function groupByCategory(items: PageItem[]): Record<string, PageItem[]> {
  return items.reduce<Record<string, PageItem[]>>((acc, item) => {
    const key = item.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

export default function PagesPage() {
  const grouped = groupByCategory(pages);
  const isEmpty = pages.length === 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Screen Management</span>
        <h1 className={styles.title}>화면 목록</h1>
        <p className={styles.description}>
          Figma 디자인과 실제 구현 화면을 비교하고 일치율을 확인합니다.
        </p>
      </div>

      {isEmpty ? (
        <div className={styles.stage}>
          <div className={styles.stageInner}>
            <EmptyState
              icon="solar:documents-linear"
              title="등록된 화면이 없습니다"
              description="Figma에서 디자인을 추출하면 화면 목록이 자동으로 생성됩니다."
              action={
                <Button variant="primary" leftIcon="solar:link-linear">
                  Figma URL 입력하기
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <div className={styles.categoryList}>
          {CATEGORIES.map((cat) => {
            const items = grouped[cat.id];
            if (!items || items.length === 0) return null;

            return (
              <section key={cat.id} className={styles.categorySection}>
                <div className={styles.categoryHeader}>
                  <Icon icon={cat.icon} width={16} height={16} />
                  <h2 className={styles.categoryTitle}>{cat.label}</h2>
                  <span className={styles.categoryCount}>{items.length}</span>
                </div>
                <div className={styles.cardGrid}>
                  {items.map((item) => (
                    <div key={item.id} className={styles.pageCard}>
                      <div className={styles.pageCardInner}>
                        <div className={styles.thumbnail}>
                          <Icon icon="solar:gallery-linear" width={24} height={24} />
                        </div>
                        <div className={styles.pageInfo}>
                          <span className={styles.pageName}>{item.name}</span>
                          <span className={styles.pageDate}>{item.updatedAt}</span>
                        </div>
                        {item.matchRate !== null && (
                          <div className={styles.matchRate}>
                            <span
                              className={`${styles.matchValue} ${
                                item.matchRate >= 90 ? styles.matchHigh :
                                item.matchRate >= 70 ? styles.matchMid : styles.matchLow
                              }`}
                            >
                              {item.matchRate}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
