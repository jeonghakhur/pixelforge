'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { useUIStore } from '@/stores/useUIStore';
import { login } from '@/lib/actions/auth';
import { loginSchema, type LoginForm } from '@/lib/auth/schema';
import styles from './page.module.scss';

export default function LoginPage() {
  const router = useRouter();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const initTheme = useUIStore((s) => s.initTheme);
  const [serverError, setServerError] = useState<string | null>(null);

  useState(() => {
    initTheme();
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    const result = await login(data);
    if (result.error) {
      setServerError(result.error);
      return;
    }
    router.push('/');
  };

  const onError = () => {
    const firstField = errors.email ? 'email' : 'password';
    setFocus(firstField);
  };

  const cycleTheme = () => {
    const cycle = ['light', 'dark', 'system'] as const;
    const idx = cycle.indexOf(theme);
    setTheme(cycle[(idx + 1) % cycle.length]);
  };

  const THEME_ICONS: Record<string, string> = {
    light: 'solar:sun-2-linear',
    dark: 'solar:moon-linear',
    system: 'solar:laptop-minimalistic-linear',
  };

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.themeToggle}
        onClick={cycleTheme}
        aria-label="테마 전환"
      >
        <Icon icon={THEME_ICONS[theme]} width={18} height={18} />
      </button>

      <div className={styles.card}>
        <div className={styles.cardInner}>
          <div className={styles.logoArea}>
            <div className={styles.logoIcon}>
              <Icon icon="solar:code-square-linear" width={28} height={28} />
            </div>
            <h1 className={styles.logoText}>PixelForge</h1>
            <p className={styles.slogan}>Figma 디자인을 코드로 변환합니다</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit, onError)} className={styles.form} noValidate>
            <div className={styles.field}>
              <label htmlFor="login-email" className={styles.label}>
                이메일
              </label>
              <div className={styles.inputWrapper}>
                <Icon icon="solar:letter-linear" className={styles.inputIcon} />
                <input
                  id="login-email"
                  type="email"
                  placeholder="admin@pixelforge.dev"
                  className={styles.input}
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p id="email-error" className={styles.error} role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="login-password" className={styles.label}>
                비밀번호
              </label>
              <div className={styles.inputWrapper}>
                <Icon icon="solar:lock-linear" className={styles.inputIcon} />
                <input
                  id="login-password"
                  type="password"
                  placeholder="8자 이상 입력"
                  className={styles.input}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p id="password-error" className={styles.error} role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {serverError && (
              <p className={styles.error} role="alert">
                {serverError}
              </p>
            )}

            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? (
                <span className={styles.spinner} />
              ) : (
                <Icon icon="solar:login-3-linear" width={16} height={16} />
              )}
              {isSubmitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className={styles.footer}>
            <a href="/register" className={styles.footerLink}>
              <Icon icon="solar:user-plus-linear" width={14} height={14} />
              관리자 계정 만들기
            </a>
          </div>
        </div>
      </div>

      <p className={styles.copyright}>PixelForge v1.0</p>
    </div>
  );
}
