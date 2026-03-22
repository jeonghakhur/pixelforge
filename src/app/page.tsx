'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { extractTokensAction } from '@/lib/actions/project';
import { useUIStore } from '@/stores/useUIStore';
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

interface ExtractResult {
  colors: number;
  typography: number;
  spacing: number;
  radii: number;
}

const SHORTCUTS = [
  {
    icon: 'solar:pallete-linear',
    label: '색상 토큰 보기',
    desc: '추출된 색상 팔레트를 확인합니다',
    section: 'tokens' as const,
    path: '/tokens/color',
  },
  {
    icon: 'solar:text-field-linear',
    label: '타이포그래피 토큰',
    desc: '폰트 스타일과 타입 스케일을 확인합니다',
    section: 'tokens' as const,
    path: '/tokens/typography',
  },
  {
    icon: 'solar:widget-2-linear',
    label: '컴포넌트 생성',
    desc: '토큰 기반 컴포넌트를 생성합니다',
    section: 'components' as const,
    path: '/components/new',
  },
  {
    icon: 'solar:settings-linear',
    label: '설정',
    desc: 'Figma 토큰 및 앱 설정',
    section: 'settings' as const,
    path: '/settings',
  },
];

export default function HomePage() {
  const router = useRouter();
  const setSection = useUIStore((s) => s.setSection);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<FigmaUrlForm>({
    resolver: zodResolver(figmaUrlSchema),
  });

  const onSubmit = async (data: FigmaUrlForm) => {
    setServerError(null);
    const res = await extractTokensAction(data.url);
    if (res.error) {
      setServerError(res.error);
      return;
    }
    setResult({
      colors: res.colors,
      typography: res.typography,
      spacing: res.spacing,
      radii: res.radii,
    });
    router.refresh();
  };

  const onError = () => {
    setFocus('url');
  };

  const handleShortcut = (path: string, section: typeof SHORTCUTS[number]['section']) => {
    setSection(section);
    router.push(path);
  };

  return (
    <div className={styles.home}>
      {/* Figma URL 입력 */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Figma URL</span>
        <form onSubmit={handleSubmit(onSubmit, onError)} className={styles.form} noValidate>
          <div className={styles.inputRow}>
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
                aria-invalid={!!errors.url}
                aria-describedby={errors.url ? 'figma-url-error' : undefined}
                {...register('url')}
              />
            </div>
            <button
              type="submit"
              className={styles.extractBtn}
              disabled={isSubmitting}
            >
              <Icon icon="solar:arrow-right-linear" width={14} height={14} />
              {isSubmitting ? 'Extracting...' : 'Extract'}
            </button>
          </div>
          {errors.url && (
            <p id="figma-url-error" className={styles.error} role="alert">
              {errors.url.message}
            </p>
          )}
          {serverError && (
            <p className={styles.error} role="alert">
              {serverError}
            </p>
          )}
        </form>
      </div>

      {/* 추출 결과 */}
      {result && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Extracted Tokens</span>
          <div className={styles.resultGrid}>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>Colors</span>
              <span className={styles.resultCount}>{result.colors}</span>
            </div>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>Typography</span>
              <span className={styles.resultCount}>{result.typography}</span>
            </div>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>Spacing</span>
              <span className={styles.resultCount}>{result.spacing}</span>
            </div>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>Radii</span>
              <span className={styles.resultCount}>{result.radii}</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Navigation */}
      <div className={styles.welcome}>
        <h2 className={styles.welcomeTitle}>Quick Navigation</h2>
        <div className={styles.shortcutList}>
          {SHORTCUTS.map((item) => (
            <button
              key={item.path}
              type="button"
              className={styles.shortcutItem}
              onClick={() => handleShortcut(item.path, item.section)}
            >
              <div className={styles.shortcutIcon}>
                <Icon icon={item.icon} width={18} height={18} />
              </div>
              <div className={styles.shortcutText}>
                <span className={styles.shortcutLabel}>{item.label}</span>
                <span className={styles.shortcutDesc}>{item.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
