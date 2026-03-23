'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { useUIStore } from '@/stores/useUIStore';
import { register } from '@/lib/actions/auth';
import { getUserCount } from '@/lib/actions/auth';
import { registerSchema, type RegisterForm } from '@/lib/auth/schema';
import styles from './page.module.scss';

export default function RegisterPage() {
  const router = useRouter();
  const initTheme = useUIStore((s) => s.initTheme);
  const [serverError, setServerError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    initTheme();
    // 이미 계정이 있으면 /login으로 리다이렉트
    getUserCount().then((count) => {
      if (count > 0) {
        router.replace('/login');
      } else {
        setChecking(false);
      }
    });
  }, [initTheme, router]);

  const {
    register: reg,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setServerError(null);
    const result = await register(data);
    if (result.error) {
      setServerError(result.error);
      return;
    }
    router.push('/');
  };

  const onError = () => {
    const first = errors.email ? 'email' : errors.password ? 'password' : 'passwordConfirm';
    setFocus(first);
  };

  if (checking) {
    return (
      <div className={styles.container}>
        <span className={styles.loadingSpinner} aria-label="확인 중" />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.cardInner}>
          <div className={styles.logoArea}>
            <div className={styles.logoIcon}>
              <Icon icon="solar:code-square-linear" width={28} height={28} />
            </div>
            <h1 className={styles.logoText}>PixelForge</h1>
            <p className={styles.slogan}>관리자 계정을 만들어 시작하세요</p>
            <p className={styles.notice}>처음 실행 시 1회만 생성됩니다</p>
          </div>

          {serverError && (
            <div className={styles.serverError} role="alert">
              <Icon icon="solar:danger-circle-linear" width={16} height={16} />
              {serverError}
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit, onError)}
            className={styles.form}
            noValidate
          >
            <div className={styles.field}>
              <label htmlFor="reg-email" className={styles.label}>
                이메일
              </label>
              <div className={styles.inputWrapper}>
                <Icon icon="solar:letter-linear" className={styles.inputIcon} />
                <input
                  id="reg-email"
                  type="email"
                  placeholder="admin@example.com"
                  className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...reg('email')}
                />
              </div>
              {errors.email && (
                <p id="email-error" className={styles.error} role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="reg-password" className={styles.label}>
                비밀번호
              </label>
              <div className={styles.inputWrapper}>
                <Icon icon="solar:lock-linear" className={styles.inputIcon} />
                <input
                  id="reg-password"
                  type="password"
                  placeholder="8자 이상 입력"
                  className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...reg('password')}
                />
              </div>
              {errors.password && (
                <p id="password-error" className={styles.error} role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="reg-password-confirm" className={styles.label}>
                비밀번호 확인
              </label>
              <div className={styles.inputWrapper}>
                <Icon icon="solar:lock-check-linear" className={styles.inputIcon} />
                <input
                  id="reg-password-confirm"
                  type="password"
                  placeholder="비밀번호 재입력"
                  className={`${styles.input} ${errors.passwordConfirm ? styles.inputError : ''}`}
                  autoComplete="new-password"
                  aria-invalid={!!errors.passwordConfirm}
                  aria-describedby={
                    errors.passwordConfirm ? 'password-confirm-error' : undefined
                  }
                  {...reg('passwordConfirm')}
                />
              </div>
              {errors.passwordConfirm && (
                <p id="password-confirm-error" className={styles.error} role="alert">
                  {errors.passwordConfirm.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className={styles.spinner} />
              ) : (
                <Icon icon="solar:user-plus-linear" width={16} height={16} />
              )}
              {isSubmitting ? '계정 생성 중...' : '계정 만들기'}
            </button>
          </form>

          <div className={styles.footer}>
            <a href="/login" className={styles.footerLink}>
              <Icon icon="solar:login-3-linear" width={14} height={14} />
              이미 계정이 있으신가요? 로그인
            </a>
          </div>
        </div>
      </div>

      <p className={styles.copyright}>PixelForge v1.0</p>
    </div>
  );
}
