'use client';

import styles from './ProgressCard.module.scss';

interface ProgressCardProps {
  percent: number;
  label: string;
}

export default function ProgressCard({ percent, label }: ProgressCardProps) {
  const displayPercent = Math.round(Math.min(100, Math.max(0, percent)));
  const isDone = displayPercent === 100;

  return (
    <div className={styles.card}>
      <div className={styles.cardInner}>
        <div className={styles.header}>
          <span className={`${styles.dot} ${isDone ? styles.dotDone : styles.dotActive}`} aria-hidden="true" />
          <span className={styles.label}>{label}</span>
          <span className={styles.percent}>{displayPercent}%</span>
        </div>
        <div className={styles.track}>
          <div
            className={`${styles.fill} ${isDone ? styles.fillDone : ''}`}
            style={{ width: `${displayPercent}%` }}
            role="progressbar"
            aria-valuenow={displayPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label}
          />
        </div>
      </div>
    </div>
  );
}
