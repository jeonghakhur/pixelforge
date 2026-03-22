'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
      <h1 className={styles.title}>PixelForge</h1>
      <p className={styles.subtitle}>
        Figma URL을 입력하면 디자인 토큰을 자동으로 추출합니다.
      </p>

      <Card className={styles.formCard}>
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <div className={styles.inputGroup}>
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '추출 중...' : '토큰 추출'}
            </Button>
          </div>
          {errors.url && (
            <p className={styles.error} role="alert">{errors.url.message}</p>
          )}
        </form>
      </Card>

      <div className={styles.summary}>
        <Card title="색상" className={styles.summaryCard}>
          <p className={styles.emptyState}>추출된 토큰이 없습니다</p>
        </Card>
        <Card title="타이포그래피" className={styles.summaryCard}>
          <p className={styles.emptyState}>추출된 토큰이 없습니다</p>
        </Card>
        <Card title="간격" className={styles.summaryCard}>
          <p className={styles.emptyState}>추출된 토큰이 없습니다</p>
        </Card>
        <Card title="반경" className={styles.summaryCard}>
          <p className={styles.emptyState}>추출된 토큰이 없습니다</p>
        </Card>
      </div>
    </div>
  );
}
