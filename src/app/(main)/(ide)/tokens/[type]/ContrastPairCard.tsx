'use client';

import styles from './token-views.module.scss';

// ── 타입 ─────────────────────────────────────────────────

export type WCAGLevel = 'AAA' | 'AA' | 'AA_LARGE' | 'FAIL';

export interface ContrastThemeResult {
  textColor: string;
  bgColor: string;
  ratio: number;
  level: WCAGLevel;
}

export interface ContrastResult {
  textToken: string;
  bgToken: string;
  light?: ContrastThemeResult;
  dark?: ContrastThemeResult;
}

// ── 등급 헬퍼 ────────────────────────────────────────────

const LEVEL_LABEL: Record<WCAGLevel, string> = {
  AAA: 'AAA',
  AA: 'AA',
  AA_LARGE: 'AA Large',
  FAIL: 'FAIL',
};

const LEVEL_CLASS: Record<WCAGLevel, string> = {
  AAA: styles.wcagAAA,
  AA: styles.wcagAA,
  AA_LARGE: styles.wcagAALarge,
  FAIL: styles.wcagFail,
};

// ── 테마 카드 ────────────────────────────────────────────

interface ContrastThemeCardProps {
  theme: 'Light' | 'Dark';
  result: ContrastThemeResult;
}

function ContrastThemeCard({ theme, result }: ContrastThemeCardProps) {
  const { textColor, bgColor, ratio, level } = result;

  return (
    <div
      className={`${styles.contrastThemeCard} ${theme === 'Dark' ? styles.contrastThemeCardDark : ''}`}
      style={{ backgroundColor: bgColor }}
    >
      {/* 테마 레이블 */}
      <span
        className={styles.contrastThemeLabel}
        style={{ color: textColor, opacity: 0.5 }}
      >
        {theme}
      </span>

      {/* 미리보기 텍스트 */}
      <div className={styles.contrastPreviewText}>
        <span
          className={styles.contrastPreviewLatin}
          style={{ color: textColor }}
        >
          Aa
        </span>
        <span
          className={styles.contrastPreviewKorean}
          style={{ color: textColor }}
        >
          가나다
        </span>
      </div>

      {/* 색상값 */}
      <div className={styles.contrastColorValues}>
        <span className={styles.contrastColorValue}>BG: {bgColor}</span>
        <span className={styles.contrastColorValue}>FG: {textColor}</span>
      </div>

      {/* 대비율 + 등급 뱃지 */}
      <div className={styles.contrastRatioRow}>
        <span className={styles.contrastRatio}>{ratio.toFixed(2)}:1</span>
        <span className={`${styles.wcagBadge} ${LEVEL_CLASS[level]}`}>
          {LEVEL_LABEL[level]}
        </span>
      </div>
    </div>
  );
}

// ── 메인 카드 ────────────────────────────────────────────

interface ContrastPairCardProps {
  pair: ContrastResult;
}

export function ContrastPairCard({ pair }: ContrastPairCardProps) {
  return (
    <div className={styles.contrastPairCard}>
      {/* 헤더: 토큰 이름 */}
      <div className={styles.contrastPairHeader}>
        <span className={styles.contrastTokenName} title={pair.textToken}>
          {pair.textToken}
        </span>
        <span className={styles.contrastVsLabel}>vs</span>
        <span className={styles.contrastTokenName} title={pair.bgToken}>
          {pair.bgToken}
        </span>
      </div>

      {/* 테마별 카드 */}
      <div className={styles.contrastThemes}>
        {pair.light && (
          <ContrastThemeCard theme="Light" result={pair.light} />
        )}
        {pair.dark && (
          <ContrastThemeCard theme="Dark" result={pair.dark} />
        )}
        {!pair.light && !pair.dark && (
          <p className={styles.contrastNoData}>색상 데이터 없음</p>
        )}
      </div>
    </div>
  );
}
