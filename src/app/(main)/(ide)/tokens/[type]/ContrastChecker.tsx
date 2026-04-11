'use client';

import { useState, useMemo } from 'react';
import type { TokenRow } from '@/lib/actions/tokens';
import { ContrastPairCard } from './ContrastPairCard';
import type { ContrastResult, WCAGLevel } from './ContrastPairCard';
import styles from './token-views.module.scss';

// ── WCAG 계산 ────────────────────────────────────────────

interface ParsedColor {
  r: number;
  g: number;
  b: number;
}

function parseColorRGB(value: string): ParsedColor | null {
  // JSON 포맷 { hex, rgba }
  try {
    const parsed = JSON.parse(value) as { hex?: string; rgba?: { r: number; g: number; b: number; a: number } };
    if (parsed.hex) {
      const hex = parsed.hex.slice(0, 7);
      return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
      };
    }
  } catch { /* fall through */ }

  // plain hex #rrggbb
  const hexMatch = value.match(/^#([0-9a-fA-F]{6})/);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1].slice(0, 2), 16),
      g: parseInt(hexMatch[1].slice(2, 4), 16),
      b: parseInt(hexMatch[1].slice(4, 6), 16),
    };
  }

  // rgba(r, g, b, a)
  const rgbaMatch = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3]),
    };
  }

  return null;
}

/** hex 정규화: 숫자가 있으면 hex로, 없으면 원본 반환 */
function normalizeHex(value: string): string {
  const c = parseColorRGB(value);
  if (!c) return value;
  return `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`.toUpperCase();
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(c1: ParsedColor, c2: ParsedColor): number {
  const l1 = getRelativeLuminance(c1.r, c1.g, c1.b);
  const l2 = getRelativeLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getWCAGLevel(ratio: number): WCAGLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA_LARGE';
  return 'FAIL';
}

// ── 토큰 분류 ────────────────────────────────────────────

type ColorCategory = 'text' | 'background' | 'border' | 'icon' | 'other';

function categorizeColor(name: string): ColorCategory {
  const lower = name.toLowerCase();
  if (/\/(text|label|foreground|fg|on-|content)/.test(lower)) return 'text';
  if (/\/(background|bg|surface|fill|canvas|base)/.test(lower)) return 'background';
  if (/\/(border|stroke|outline|divider|separator)/.test(lower)) return 'border';
  if (/\/(icon|pictogram)/.test(lower)) return 'icon';
  return 'other';
}

// ── 모드별 그룹핑 ────────────────────────────────────────

interface TokenWithModes {
  name: string;
  values: {
    light?: string;
    dark?: string;
    default?: string;
  };
}

function groupByMode(tokens: TokenRow[]): TokenWithModes[] {
  const map = new Map<string, TokenWithModes>();
  for (const token of tokens) {
    if (!map.has(token.name)) {
      map.set(token.name, { name: token.name, values: {} });
    }
    const entry = map.get(token.name)!;
    const mode = token.mode?.toLowerCase();
    if (mode === 'light') entry.values.light = token.value;
    else if (mode === 'dark') entry.values.dark = token.value;
    else entry.values.default = token.value;
  }
  return Array.from(map.values());
}

// ── 대비율 계산 ──────────────────────────────────────────

function calculateContrast(
  textToken: TokenWithModes,
  bgToken: TokenWithModes,
): ContrastResult {
  const result: ContrastResult = {
    textToken: textToken.name,
    bgToken: bgToken.name,
  };

  for (const theme of ['light', 'dark'] as const) {
    const textColorRaw = textToken.values[theme] ?? textToken.values.default;
    const bgColorRaw = bgToken.values[theme] ?? bgToken.values.default;
    if (!textColorRaw || !bgColorRaw) continue;

    const tc = parseColorRGB(textColorRaw);
    const bc = parseColorRGB(bgColorRaw);
    if (!tc || !bc) continue;

    const ratio = getContrastRatio(tc, bc);
    result[theme] = {
      textColor: normalizeHex(textColorRaw),
      bgColor: normalizeHex(bgColorRaw),
      ratio: Math.round(ratio * 100) / 100,
      level: getWCAGLevel(ratio),
    };
  }

  return result;
}

// ── 컴포넌트 ─────────────────────────────────────────────

interface ContrastCheckerProps {
  tokens: TokenRow[];
}

type CheckerMode = 'palette' | 'manual';
type FilterMode = 'all' | 'fail';

export default function ContrastChecker({ tokens }: ContrastCheckerProps) {
  const [mode, setMode] = useState<CheckerMode>('palette');
  const [filter, setFilter] = useState<FilterMode>('all');

  const tokensByMode = useMemo(() => groupByMode(tokens), [tokens]);

  const textTokens = useMemo(
    () => tokensByMode.filter((t) => categorizeColor(t.name) === 'text'),
    [tokensByMode],
  );
  const bgTokens = useMemo(
    () => tokensByMode.filter((t) => categorizeColor(t.name) === 'background'),
    [tokensByMode],
  );

  // 팔레트 모드: text vs background 조합
  const palettePairs = useMemo(() => {
    const pairs = textTokens.flatMap((text) =>
      bgTokens.map((bg) => calculateContrast(text, bg)),
    );
    if (filter === 'fail') {
      return pairs.filter(
        (p) => p.light?.level === 'FAIL' || p.dark?.level === 'FAIL',
      );
    }
    return pairs;
  }, [textTokens, bgTokens, filter]);

  // 수동 모드: 전체 조합 (자기 자신 제외)
  const manualPairs = useMemo(() => {
    const all = tokensByMode;
    const pairs: ContrastResult[] = [];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        pairs.push(calculateContrast(all[i], all[j]));
      }
    }
    if (filter === 'fail') {
      return pairs.filter(
        (p) => p.light?.level === 'FAIL' || p.dark?.level === 'FAIL',
      );
    }
    return pairs;
  }, [tokensByMode, filter]);

  const pairs = mode === 'palette' ? palettePairs : manualPairs;

  return (
    <div className={styles.contrastChecker}>
      {/* 툴바 */}
      <div className={styles.contrastToolbar}>
        <div className={styles.contrastModeGroup}>
          <button
            type="button"
            className={`${styles.contrastModeBtn} ${mode === 'palette' ? styles.contrastModeBtnActive : ''}`}
            onClick={() => setMode('palette')}
          >
            팔레트
          </button>
          <button
            type="button"
            className={`${styles.contrastModeBtn} ${mode === 'manual' ? styles.contrastModeBtnActive : ''}`}
            onClick={() => setMode('manual')}
          >
            수동
          </button>
        </div>

        <div className={styles.contrastFilterGroup}>
          <button
            type="button"
            className={`${styles.contrastFilterBtn} ${filter === 'all' ? styles.contrastFilterBtnActive : ''}`}
            onClick={() => setFilter('all')}
          >
            전체
          </button>
          <button
            type="button"
            className={`${styles.contrastFilterBtn} ${filter === 'fail' ? styles.contrastFilterBtnFail : ''}`}
            onClick={() => setFilter(filter === 'fail' ? 'all' : 'fail')}
          >
            실패만
          </button>
        </div>

        <span className={styles.contrastCount}>{pairs.length}개 조합</span>
      </div>

      {/* 빈 상태 */}
      {pairs.length === 0 && (
        <div className={styles.contrastEmpty}>
          {mode === 'palette' ? (
            <>
              <p className={styles.contrastEmptyTitle}>분류 가능한 색상 조합이 없습니다</p>
              <p className={styles.contrastEmptyHint}>
                토큰 이름에 <code>/text/</code>, <code>/background/</code> 등의 경로를 포함시키면
                팔레트 모드에서 자동으로 분류됩니다.
              </p>
            </>
          ) : (
            <p className={styles.contrastEmptyTitle}>
              {filter === 'fail' ? 'FAIL 등급 조합이 없습니다 ✅' : '색상 토큰이 없습니다'}
            </p>
          )}
        </div>
      )}

      {/* 조합 목록 */}
      {pairs.length > 0 && (
        <div className={styles.contrastList}>
          {pairs.map((pair) => (
            <ContrastPairCard
              key={`${pair.textToken}__${pair.bgToken}`}
              pair={pair}
            />
          ))}
        </div>
      )}
    </div>
  );
}
