'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Icon } from '@iconify/react';
import Button from '@/components/common/Button';
import Card from '@/components/common/Card';
import { saveFigmaToken, checkFigmaToken } from '@/lib/actions/settings';
import styles from './page.module.scss';

const tokenSchema = z.object({
  token: z.string().min(1, 'API 토큰을 입력해주세요'),
});

type TokenForm = z.infer<typeof tokenSchema>;

export default function SettingsPage() {
  const [maskedToken, setMaskedToken] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
    reset,
  } = useForm<TokenForm>({
    resolver: zodResolver(tokenSchema),
  });

  useEffect(() => {
    checkFigmaToken().then((res) => {
      if (res.hasToken) {
        setMaskedToken(res.maskedToken);
      }
    });
  }, []);

  const onSubmit = async (data: TokenForm) => {
    setServerError(null);
    setSaved(false);
    const res = await saveFigmaToken(data.token);
    if (res.error) {
      setServerError(res.error);
      return;
    }
    setSaved(true);
    reset({ token: '' });
    const updated = await checkFigmaToken();
    setMaskedToken(updated.maskedToken);
    setTimeout(() => setSaved(false), 3000);
  };

  const onError = () => {
    setFocus('token');
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Settings</span>
        <h1 className={styles.title}>설정</h1>
        <p className={styles.description}>
          Figma API 토큰을 설정하여 디자인 파일에서 토큰을 추출할 수 있습니다.
        </p>
      </div>

      <Card className={styles.settingsCard}>
        <div className={styles.settingsContent}>
          <div className={styles.settingsLabel}>
            <Icon icon="solar:key-linear" width={20} height={20} />
            <div>
              <h2 className={styles.settingsTitle}>Figma API 토큰</h2>
              <p className={styles.settingsDesc}>
                Figma 계정 설정에서 Personal Access Token을 생성하여 입력하세요.
              </p>
            </div>
          </div>

          {maskedToken && (
            <div className={styles.currentToken}>
              <Icon icon="solar:check-circle-linear" width={14} height={14} />
              <span>현재 설정됨: {maskedToken}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit, onError)} noValidate>
            <div className={styles.inputRow}>
              <div className={styles.inputWrapper}>
                <label htmlFor="figma-token" className="sr-only">
                  Figma API 토큰
                </label>
                <input
                  id="figma-token"
                  type="password"
                  placeholder="figd_..."
                  className={styles.input}
                  aria-invalid={!!errors.token}
                  aria-describedby={errors.token ? 'token-error' : undefined}
                  {...register('token')}
                />
              </div>
              <Button type="submit" disabled={isSubmitting} leftIcon="solar:check-circle-linear">
                {isSubmitting ? '저장 중...' : '저장'}
              </Button>
            </div>
            {errors.token && (
              <p id="token-error" className={styles.error} role="alert">
                {errors.token.message}
              </p>
            )}
            {serverError && (
              <p className={styles.error} role="alert">{serverError}</p>
            )}
            {saved && (
              <p className={styles.success} role="status">
                <Icon icon="solar:check-circle-bold" width={14} height={14} />
                토큰이 저장되었습니다.
              </p>
            )}
          </form>
        </div>
      </Card>
    </div>
  );
}
