'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Icon } from '@iconify/react';
import Modal from '@/components/common/Modal';
import Spinner from '@/components/common/Spinner';
import { extractTokensByTypeAction } from '@/lib/actions/tokens';
import { getProjectFigmaUrl } from '@/lib/actions/settings';
import styles from './page.module.scss';

const schema = z.object({
  figmaUrl: z
    .string()
    .min(1, 'Figma URL을 입력해주세요.')
    .url('올바른 URL 형식이 아닙니다.')
    .refine((v) => v.includes('figma.com'), 'Figma URL을 입력해주세요.'),
});

type FormData = z.infer<typeof schema>;

type Step = 'idle' | 'extracting' | 'capturing' | 'done' | 'error';

interface TokenExtractModalProps {
  type: string;
  typeLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  initialUrl?: string;
}

export default function TokenExtractModal({
  type,
  typeLabel,
  isOpen,
  onClose,
  onSuccess,
  initialUrl,
}: TokenExtractModalProps) {
  const [step, setStep] = useState<Step>('idle');
  const [resultCount, setResultCount] = useState(0);
  const [isUnchanged, setIsUnchanged] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const figmaUrlValue = watch('figmaUrl');

  // 타입별 마지막 추출 URL 우선, 없으면 프로젝트 공통 URL fallback
  useEffect(() => {
    if (isOpen) {
      if (initialUrl) {
        reset({ figmaUrl: initialUrl });
      } else {
        getProjectFigmaUrl().then(({ url }) => {
          if (url) reset({ figmaUrl: url });
        });
      }
    }
  }, [isOpen, initialUrl, reset]);

  const handleClose = () => {
    if (step === 'extracting' || step === 'capturing') return;
    reset();
    setStep('idle');
    setServerError(null);
    setIsUnchanged(false);
    onClose();
  };

  const onValid = async ({ figmaUrl }: FormData) => {
    setStep('extracting');
    setServerError(null);
    setIsUnchanged(false);

    const result = await extractTokensByTypeAction(type, figmaUrl);

    if (result.error) {
      setStep('error');
      setServerError(result.error);
      return;
    }

    if (result.unchanged) {
      // 변경 없음 — 스크린샷 대기 없이 바로 done
      setResultCount(result.count);
      setIsUnchanged(true);
      setStep('done');
      return;
    }

    setStep('capturing');
    await new Promise<void>((resolve) => setTimeout(resolve, 800));

    setResultCount(result.count);
    setStep('done');
    onSuccess(result.count);
  };

  const isBusy = step === 'extracting' || step === 'capturing';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`${typeLabel} 토큰 추가하기`}
      size="lg"
      footer={
        step === 'done' ? (
          <button type="button" className={styles.extractBtn} onClick={handleClose}>
            닫기
          </button>
        ) : (
          <>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleClose}
              disabled={isBusy}
            >
              취소
            </button>
            <button
              type="submit"
              form="token-extract-form"
              className={styles.extractBtn}
              disabled={isBusy}
            >
              {isBusy ? <Spinner size="sm" /> : <Icon icon="solar:import-linear" width={14} height={14} />}
              {step === 'capturing' ? '스크린샷 캡처 중...' : isBusy ? '추출 중...' : '추출 시작하기'}
            </button>
          </>
        )
      }
    >
      {step === 'done' ? (
        <div className={styles.extractDone}>
          <Icon
            icon={isUnchanged ? 'solar:check-read-linear' : 'solar:check-circle-linear'}
            width={32} height={32}
            className={styles.extractDoneIcon}
          />
          {isUnchanged ? (
            <p className={styles.extractDoneText}>변경된 내용이 없습니다. ({resultCount}개 토큰)</p>
          ) : (
            <p className={styles.extractDoneText}>{resultCount}개 토큰이 추출되었습니다.</p>
          )}
        </div>
      ) : step === 'error' ? (
        <div className={styles.extractError}>
          <Icon icon="solar:danger-triangle-linear" width={20} height={20} />
          <p>{serverError ?? '알 수 없는 오류가 발생했습니다.'}</p>
          <form id="token-extract-form" onSubmit={handleSubmit(onValid)}>
            <div className={styles.formGroup}>
              <label htmlFor="figma-url-retry" className={styles.formLabel}>Figma URL</label>
              <input
                id="figma-url-retry"
                type="url"
                className={`${styles.formInput} ${errors.figmaUrl ? styles.formInputError : ''}`}
                placeholder="https://www.figma.com/design/..."
                aria-invalid={!!errors.figmaUrl}
                aria-describedby={errors.figmaUrl ? 'url-error' : undefined}
                {...register('figmaUrl')}
              />
              {errors.figmaUrl && (
                <p id="url-error" className={styles.formError} role="alert">
                  {errors.figmaUrl.message}
                </p>
              )}
            </div>
          </form>
        </div>
      ) : (
        <form id="token-extract-form" onSubmit={handleSubmit(onValid)}>
          <div className={styles.formGroup}>
            <label htmlFor="figma-url" className={styles.formLabel}>
              Figma URL
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="figma-url"
                type="url"
                className={`${styles.formInput} ${errors.figmaUrl ? styles.formInputError : ''}`}
                placeholder="https://www.figma.com/design/..."
                disabled={isBusy}
                aria-invalid={!!errors.figmaUrl}
                aria-describedby={errors.figmaUrl ? 'url-error' : 'url-hint'}
                {...register('figmaUrl')}
              />
              {figmaUrlValue && !isBusy && (
                <button
                  type="button"
                  className={styles.inputClearBtn}
                  onClick={() => setValue('figmaUrl', '', { shouldValidate: false })}
                  aria-label="입력값 지우기"
                  tabIndex={-1}
                >
                  <Icon icon="solar:close-circle-bold" width={16} height={16} />
                </button>
              )}
            </div>
            {errors.figmaUrl ? (
              <p id="url-error" className={styles.formError} role="alert">
                {errors.figmaUrl.message}
              </p>
            ) : (
              <p id="url-hint" className={styles.formHint}>
                특정 프레임 URL 권장 (?node-id=... 포함)
              </p>
            )}
          </div>
          {isBusy && (
            <div className={styles.extractProgress}>
              <Spinner size="sm" />
              <span>
                {step === 'capturing' ? 'UI 스크린샷 캡처 중...' : `${typeLabel} 토큰 추출 중...`}
              </span>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
