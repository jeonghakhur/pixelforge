'use server';

import { getFigmaToken, setFigmaToken } from '@/lib/config';

interface SaveTokenResult {
  error: string | null;
  success: boolean;
}

export async function saveFigmaToken(token: string): Promise<SaveTokenResult> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { error: 'API 토큰을 입력해주세요.', success: false };
  }

  if (trimmed.length < 10) {
    return { error: '올바른 Figma API 토큰이 아닌 것 같습니다.', success: false };
  }

  try {
    setFigmaToken(trimmed);
    return { error: null, success: true };
  } catch {
    return { error: '토큰 저장 중 오류가 발생했습니다.', success: false };
  }
}

export async function checkFigmaToken(): Promise<{ hasToken: boolean; maskedToken: string | null }> {
  const token = getFigmaToken();
  if (!token) return { hasToken: false, maskedToken: null };

  const masked = token.slice(0, 6) + '...' + token.slice(-4);
  return { hasToken: true, maskedToken: masked };
}
