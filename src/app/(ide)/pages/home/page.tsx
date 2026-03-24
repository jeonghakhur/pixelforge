/**
 * @page 홈 — 디자인 시스템 소개
 * @author 김하늘, 박도현
 * @category 메인
 * @status dev-done
 * @figma https://www.figma.com/design/oNTDgxxQJTuIu32ntLevAX/?node-id=1-4898
 */
'use client';

import Image from 'next/image';
import { Icon } from '@iconify/react';
import styles from './page.module.scss';

export default function HomePage() {
  return (
    <main className={styles.page}>
      {/* 로고 — 우상단 */}
      <div className={styles.logo}>
        <Icon
          icon="solar:figma-linear"
          width={20}
          height={20}
          className={styles.logoIcon}
        />
        <span className={styles.logoText}>Figma pedia</span>
      </div>

      {/* 소제목 */}
      <p className={styles.subtitle}>디자인 시스템과 라이브러리 알아보기</p>

      {/* 스텝 행 */}
      <div className={styles.stepRow}>
        <span className={styles.stepNumber}>01</span>
        <span className={styles.stepTitle}>Figma mcp로 디자인 시스템 구성하기</span>
      </div>

      {/* 메인 헤딩 */}
      <h1 className={styles.heading}>
        이제 디자인 시스템부터<br />
        차곡 차곡 쌓아나가볼까요?
      </h1>

      {/* 배경 이미지 */}
      <div className={styles.bgImage}>
        <Image
          src="/screens/design-system-bg.png"
          alt="디자인 시스템 소개 배경"
          width={444}
          height={512}
          priority
        />
      </div>

      {/* 장식 도형 */}
      <div className={styles.decorVector} aria-hidden="true" />
    </main>
  );
}
