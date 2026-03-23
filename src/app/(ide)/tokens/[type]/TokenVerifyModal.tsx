'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import Modal from '@/components/common/Modal';
import Spinner from '@/components/common/Spinner';
import { verifyTokensAction, type VerifyTokensResult } from '@/lib/actions/tokens';
import styles from './page.module.scss';

interface TokenVerifyModalProps {
  type: string;
  typeLabel: string;
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'idle' | 'verifying' | 'done' | 'error';

export default function TokenVerifyModal({
  type,
  typeLabel,
  isOpen,
  onClose,
}: TokenVerifyModalProps) {
  const [step, setStep] = useState<Step>('idle');
  const [result, setResult] = useState<VerifyTokensResult | null>(null);

  const handleClose = () => {
    if (step === 'verifying') return;
    setStep('idle');
    setResult(null);
    onClose();
  };

  const handleVerify = async () => {
    setStep('verifying');
    const res = await verifyTokensAction(type);
    setResult(res);
    setStep(res.error ? 'error' : 'done');
  };

  const passed = result && result.countMatched && result.missingInDb.length === 0 && result.extraInDb.length === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`${typeLabel} 토큰 검증`}
      size="md"
      footer={
        step === 'idle' ? (
          <>
            <button type="button" className={styles.cancelBtn} onClick={handleClose}>
              취소
            </button>
            <button type="button" className={styles.verifyBtn} onClick={handleVerify}>
              <Icon icon="solar:shield-check-linear" width={14} height={14} />
              검증 시작
            </button>
          </>
        ) : step === 'verifying' ? (
          <button type="button" className={styles.verifyBtn} disabled>
            <Spinner size="sm" />
            검증 중...
          </button>
        ) : (
          <button type="button" className={styles.extractBtn} onClick={handleClose}>
            닫기
          </button>
        )
      }
    >
      {step === 'idle' && (
        <p className={styles.verifyDesc}>
          Figma 파일의 현재 {typeLabel} 토큰 목록을 가져와 DB에 저장된 토큰과
          이름·개수를 비교합니다.
        </p>
      )}

      {step === 'verifying' && (
        <div className={styles.extractProgress}>
          <Spinner size="sm" />
          <span>Figma에서 토큰 목록을 가져오는 중...</span>
        </div>
      )}

      {step === 'done' && result && (
        <div className={styles.verifyResult}>
          {/* 상단 상태 배지 */}
          <div className={`${styles.verifyStatus} ${passed ? styles.verifyStatusPass : styles.verifyStatusFail}`}>
            <Icon
              icon={passed ? 'solar:shield-check-linear' : 'solar:shield-warning-linear'}
              width={20}
              height={20}
            />
            <span>{passed ? '검증 통과 — 토큰이 일치합니다' : '불일치 발견'}</span>
          </div>

          {/* 카운트 비교 */}
          <div className={styles.verifySummary}>
            <div className={styles.verifyStatItem}>
              <span className={styles.verifyStatLabel}>Figma</span>
              <span className={styles.verifyStatValue}>{result.figmaCount}개</span>
            </div>
            <div className={styles.verifyStatItem}>
              <span className={styles.verifyStatLabel}>DB 저장</span>
              <span className={styles.verifyStatValue}>{result.dbCount}개</span>
            </div>
            <div className={styles.verifyStatItem}>
              <span className={styles.verifyStatLabel}>일치</span>
              <span className={`${styles.verifyStatValue} ${styles.verifyStatPass}`}>{result.matchedCount}개</span>
            </div>
          </div>

          {/* Figma에 있는데 DB에 없는 토큰 */}
          {result.missingInDb.length > 0 && (
            <div className={styles.verifyErrors}>
              <p className={styles.verifyErrorsTitle}>
                <Icon icon="solar:download-minimalistic-linear" width={13} height={13} />
                DB에 없는 토큰 ({result.missingInDb.length}개) — 재추출 필요
              </p>
              <ul className={styles.verifyErrorList}>
                {result.missingInDb.map((name) => (
                  <li key={name} className={styles.verifyErrorItem}>
                    <span className={styles.verifyErrorName}>{name}</span>
                    <span className={`${styles.verifyErrorReason} ${styles.verifyTagMissing}`}>누락</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* DB에 있는데 Figma에 없는 토큰 */}
          {result.extraInDb.length > 0 && (
            <div className={styles.verifyErrors}>
              <p className={styles.verifyErrorsTitle}>
                <Icon icon="solar:trash-bin-2-linear" width={13} height={13} />
                Figma에서 삭제된 토큰 ({result.extraInDb.length}개)
              </p>
              <ul className={styles.verifyErrorList}>
                {result.extraInDb.map((name) => (
                  <li key={name} className={styles.verifyErrorItem}>
                    <span className={styles.verifyErrorName}>{name}</span>
                    <span className={`${styles.verifyErrorReason} ${styles.verifyTagExtra}`}>잉여</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {step === 'error' && result && (
        <div className={styles.extractError}>
          <Icon icon="solar:danger-triangle-linear" width={20} height={20} />
          <p>{result.error ?? '알 수 없는 오류가 발생했습니다.'}</p>
        </div>
      )}
    </Modal>
  );
}
