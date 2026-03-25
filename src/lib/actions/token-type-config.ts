'use server';

import { TOKEN_TYPES } from '@/lib/tokens/token-types';
import { getStoredTokenTypes, setStoredTokenTypes, type StoredTokenType } from '@/lib/config';

/** 빌트인 TOKEN_TYPES → StoredTokenType 변환 (초기값) */
function builtinToStored(): StoredTokenType[] {
  return TOKEN_TYPES.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    pattern: t.sectionPattern.source,
    cssPrefix: t.cssPrefix,
  }));
}

/** 현재 활성 토큰 타입 목록 반환 (config 우선, 없으면 빌트인) */
export async function getActiveTokenTypesAction(): Promise<StoredTokenType[]> {
  return getStoredTokenTypes() ?? builtinToStored();
}

/** 새 토큰 타입 추가 */
export async function addTokenTypeAction(
  type: StoredTokenType,
): Promise<{ error: string | null }> {
  const current = getStoredTokenTypes() ?? builtinToStored();
  if (current.some((t) => t.id === type.id)) {
    return { error: `'${type.id}' ID가 이미 존재합니다.` };
  }
  try {
    new RegExp(type.pattern);
  } catch {
    return { error: '올바르지 않은 정규식 패턴입니다.' };
  }
  setStoredTokenTypes([...current, type]);
  return { error: null };
}

/** 토큰 타입 삭제 */
export async function deleteTokenTypeAction(
  id: string,
): Promise<{ error: string | null }> {
  const current = getStoredTokenTypes() ?? builtinToStored();
  const updated = current.filter((t) => t.id !== id);
  if (updated.length === current.length) {
    return { error: '해당 타입을 찾을 수 없습니다.' };
  }
  setStoredTokenTypes(updated);
  return { error: null };
}

/** 토큰 타입 순서/내용 전체 저장 */
export async function saveTokenTypesAction(
  types: StoredTokenType[],
): Promise<{ error: string | null }> {
  if (types.length === 0) {
    return { error: '최소 1개 이상의 타입이 필요합니다.' };
  }
  setStoredTokenTypes(types);
  return { error: null };
}
