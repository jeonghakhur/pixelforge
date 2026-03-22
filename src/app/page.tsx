'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Icon } from '@iconify/react';
import Button from '@/components/common/Button';
import Card from '@/components/common/Card';
import styles from './page.module.scss';

const figmaUrlSchema = z.object({
  url: z
    .string()
    .min(1, 'Figma URL을 입력해주세요')
    .url('올바른 URL 형식이 아닙니다')
    .refine(
      (val) => val.includes('figma.com'),
      'Figma URL을 입력해주세요',
    ),
});

type FigmaUrlForm = z.infer<typeof figmaUrlSchema>;

const FEATURES = [
  {
    icon: 'solar:palette-bold-duotone',
    title: '색상 추출',
    desc: 'Figma 파일에서 사용된 모든 색상을 자동 분석하고 팔레트로 정리합니다.',
  },
  {
    icon: 'solar:text-bold-bold-duotone',
    title: '타이포그래피 매핑',
    desc: '폰트 패밀리, 사이즈, 웨이트를 체계적인 토큰으로 변환합니다.',
  },
  {
    icon: 'solar:ruler-angular-bold-duotone',
    title: '간격 시스템',
    desc: '패딩, 마진, 갭을 분석해 일관된 스페이싱 스케일을 생성합니다.',
  },
  {
    icon: 'solar:code-bold-duotone',
    title: '코드 생성',
    desc: 'SCSS 변수, CSS 커스텀 프로퍼티 등 원하는 포맷으로 내보냅니다.',
  },
];

const SUMMARY_ITEMS = [
  { title: '색상', icon: 'solar:palette-linear' },
  { title: '타이포그래피', icon: 'solar:text-bold-linear' },
  { title: '간격', icon: 'solar:ruler-angular-linear' },
  { title: '반경', icon: 'solar:rounded-magnifer-linear' },
];

export default function HomePage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FigmaUrlForm>({
    resolver: zodResolver(figmaUrlSchema),
  });

  const onSubmit = async (data: FigmaUrlForm) => {
    // TODO: 토큰 추출 API 호출
    void data;
  };

  return (
    <div className={styles.home}>
      {/* 히어로 — Split 레이아웃 */}
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>Design Token Extractor</span>
          <h1 className={styles.title}>
            Figma에서 디자인 토큰을
            <br />
            <span className={styles.accent}>자동으로 추출</span>하세요
          </h1>
          <p className={styles.subtitle}>
            URL 하나로 색상, 타이포, 간격, 반경을 체계적인 토큰으로 변환합니다.
            디자인 시스템 구축의 시작점.
          </p>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.orb} />
          <div className={styles.orbSecondary} />
          <Icon icon="solar:figma-bold-duotone" className={styles.heroIcon} />
        </div>
      </section>

      {/* Figma URL 입력 */}
      <Card className={styles.formCard}>
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.inputGroup}>
            <div className={styles.inputWrapper}>
              <Icon icon="solar:link-linear" className={styles.inputIcon} />
              <label htmlFor="figma-url" className="sr-only">
                Figma URL
              </label>
              <input
                id="figma-url"
                type="url"
                placeholder="https://www.figma.com/file/..."
                className={styles.input}
                {...register('url')}
              />
            </div>
            <Button type="submit" disabled={isSubmitting} icon="solar:arrow-right-linear">
              {isSubmitting ? '추출 중...' : '토큰 추출'}
            </Button>
          </div>
          {errors.url && (
            <p className={styles.error} role="alert">{errors.url.message}</p>
          )}
        </form>
      </Card>

      {/* 기능 소개 — Bento Grid */}
      <section className={styles.features}>
        <span className={styles.eyebrow}>Core Features</span>
        <h2 className={styles.sectionTitle}>강력한 토큰 추출 엔진</h2>
        <div className={styles.featureGrid}>
          {FEATURES.map((feature, i) => (
            <Card key={feature.title} className={styles.featureCard}>
              <div className={styles.featureContent} style={{ '--index': i } as React.CSSProperties}>
                <div className={styles.featureIcon}>
                  <Icon icon={feature.icon} width={24} height={24} />
                </div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 토큰 요약 카드 */}
      <section className={styles.summarySection}>
        <span className={styles.eyebrow}>Token Overview</span>
        <h2 className={styles.sectionTitle}>추출된 토큰</h2>
        <div className={styles.summary}>
          {SUMMARY_ITEMS.map((item) => (
            <Card
              key={item.title}
              title={item.title}
              icon={<Icon icon={item.icon} width={16} height={16} />}
              className={styles.summaryCard}
            >
              <p className={styles.emptyState}>추출된 토큰이 없습니다</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
