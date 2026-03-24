import type { TokenRow } from '@/lib/actions/tokens';

// ===========================
// Drift 결과 타입
// ===========================

export interface DriftItem {
  type: string;
  name: string;
  /** Figma 현재 값 (JSON 문자열) */
  figmaValue: string | null;
  /** DB 현재 값 (JSON 문자열) */
  dbValue: string | null;
  /** Figma 현재 raw 표기 */
  figmaRaw: string | null;
  /** DB 현재 raw 표기 */
  dbRaw: string | null;
  /** Drift 유형 */
  drift: 'new_in_figma' | 'removed_from_figma' | 'value_changed';
}

export interface DriftReport {
  /** Figma에 있지만 DB에 없는 토큰 */
  newInFigma: DriftItem[];
  /** DB에 있지만 Figma에서 삭제된 토큰 */
  removedFromFigma: DriftItem[];
  /** 값이 달라진 토큰 */
  valueChanged: DriftItem[];
  /** 타입별 drift 수 */
  countsByType: Record<string, { newInFigma: number; removedFromFigma: number; valueChanged: number }>;
  /** 검사 시각 (ISO) */
  checkedAt: string;
  /** drift 없음 = true */
  clean: boolean;
}

// ===========================
// Figma 토큰 → 비교용 맵 구축
// ===========================

export interface FigmaTokenForCompare {
  type: string;
  name: string;
  value: string;
  raw: string | null;
  mode: string | null;
}

function tokenKey(type: string, name: string, mode: string | null): string {
  return `${type}::${name}::${mode ?? ''}`;
}

// ===========================
// Drift 계산
// ===========================

export function computeDrift(
  figmaTokens: FigmaTokenForCompare[],
  dbTokens: TokenRow[],
): DriftReport {
  const figmaMap = new Map<string, FigmaTokenForCompare>();
  for (const t of figmaTokens) {
    figmaMap.set(tokenKey(t.type, t.name, t.mode), t);
  }

  const dbMap = new Map<string, TokenRow>();
  for (const t of dbTokens) {
    dbMap.set(tokenKey(t.type, t.name, t.mode), t);
  }

  const newInFigma: DriftItem[] = [];
  const removedFromFigma: DriftItem[] = [];
  const valueChanged: DriftItem[] = [];

  // Figma에 있는데 DB에 없거나 값이 다른 경우
  for (const [key, figmaToken] of figmaMap) {
    const dbToken = dbMap.get(key);
    if (!dbToken) {
      newInFigma.push({
        type: figmaToken.type,
        name: figmaToken.name,
        figmaValue: figmaToken.value,
        dbValue: null,
        figmaRaw: figmaToken.raw,
        dbRaw: null,
        drift: 'new_in_figma',
      });
    } else if (figmaToken.value !== dbToken.value) {
      valueChanged.push({
        type: figmaToken.type,
        name: figmaToken.name,
        figmaValue: figmaToken.value,
        dbValue: dbToken.value,
        figmaRaw: figmaToken.raw,
        dbRaw: dbToken.raw,
        drift: 'value_changed',
      });
    }
  }

  // DB에 있는데 Figma에 없는 경우
  for (const [key, dbToken] of dbMap) {
    if (!figmaMap.has(key)) {
      removedFromFigma.push({
        type: dbToken.type,
        name: dbToken.name,
        figmaValue: null,
        dbValue: dbToken.value,
        figmaRaw: null,
        dbRaw: dbToken.raw,
        drift: 'removed_from_figma',
      });
    }
  }

  // 타입별 집계
  const countsByType: Record<string, { newInFigma: number; removedFromFigma: number; valueChanged: number }> = {};
  const ensureType = (type: string) => {
    if (!countsByType[type]) countsByType[type] = { newInFigma: 0, removedFromFigma: 0, valueChanged: 0 };
  };
  for (const item of newInFigma) { ensureType(item.type); countsByType[item.type].newInFigma++; }
  for (const item of removedFromFigma) { ensureType(item.type); countsByType[item.type].removedFromFigma++; }
  for (const item of valueChanged) { ensureType(item.type); countsByType[item.type].valueChanged++; }

  const totalDrift = newInFigma.length + removedFromFigma.length + valueChanged.length;

  return {
    newInFigma,
    removedFromFigma,
    valueChanged,
    countsByType,
    checkedAt: new Date().toISOString(),
    clean: totalDrift === 0,
  };
}
