import { useState, useEffect, useRef, useCallback } from 'react';

export interface ProgressStage {
  label: string;
  /** 이 단계에서 멈출 진행률 (0-100) */
  percent: number;
  /** 다음 단계로 넘어가기 전 대기 시간 (ms). 마지막 단계는 무시됨 */
  durationMs: number;
}

interface UseStageProgressReturn {
  percent: number;
  label: string;
  isRunning: boolean;
  start: () => void;
  complete: () => void;
  reset: () => void;
}

/**
 * 서버 작업의 단계별 진행 시뮬레이션 훅
 * - 각 단계를 자동으로 순서대로 진행
 * - 마지막 단계에서 대기 (complete() 호출 전까지)
 * - complete()가 호출되면 100%로 즉시 완료
 */
export function useStageProgress(stages: ProgressStage[]): UseStageProgressReturn {
  const [percent, setPercent] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stagesRef = useRef(stages);
  stagesRef.current = stages;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const advanceTo = useCallback((idx: number) => {
    const s = stagesRef.current;
    if (idx >= s.length) return;

    setPercent(s[idx].percent);
    setStageIdx(idx);

    // 마지막 단계가 아니면 타이머로 다음 단계 예약
    if (idx < s.length - 1) {
      timerRef.current = setTimeout(() => {
        advanceTo(idx + 1);
      }, s[idx].durationMs);
    }
  }, []);

  const start = useCallback(() => {
    clearTimer();
    setIsRunning(true);
    setPercent(0);
    setStageIdx(0);
    // 첫 단계로 즉시 이동
    timerRef.current = setTimeout(() => advanceTo(0), 80);
  }, [advanceTo]);

  const complete = useCallback(() => {
    clearTimer();
    setPercent(100);
    setStageIdx(stagesRef.current.length - 1);
    setTimeout(() => setIsRunning(false), 600);
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setPercent(0);
    setStageIdx(0);
    setIsRunning(false);
  }, []);

  useEffect(() => () => clearTimer(), []);

  return {
    percent,
    label: stages[stageIdx]?.label ?? '',
    isRunning,
    start,
    complete,
    reset,
  };
}
