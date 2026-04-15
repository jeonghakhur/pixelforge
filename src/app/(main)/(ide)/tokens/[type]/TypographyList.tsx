'use client';

import type { TokenRow } from '@/lib/actions/tokens';
import styles from './token-views.module.scss';

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const SIZE_ORDER = [
  'display-2xl', 'display-xl', 'display-lg', 'display-md', 'display-sm', 'display-xs',
  'text-xl', 'text-lg', 'text-md', 'text-sm', 'text-xs',
] as const;

type SizeKey = typeof SIZE_ORDER[number];

const WEIGHT_ORDER = [
  { key: 'regular',  label: 'Regular',  numeric: 400 },
  { key: 'medium',   label: 'Medium',   numeric: 500 },
  { key: 'semibold', label: 'Semibold', numeric: 600 },
  { key: 'bold',     label: 'Bold',     numeric: 700 },
] as const;

type WeightKey = typeof WEIGHT_ORDER[number]['key'];

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
interface ScaleCell {
  fontFamily: string;
  category: 'display' | 'body';
  fontSize: number;
  fontWeight: number;
  lineHeight: number | null;
  letterSpacing: string | null;
}

type TypeScaleMap = Map<SizeKey, Map<WeightKey, ScaleCell>>;

interface PrimitiveToken {
  name: string;
  value: string;       // CSS 변수에 저장되는 값 (rem 또는 원본)
  altValue?: string;   // 병행 표시용 보조값 (px 또는 em 등)
  cssVar: string;
}

// ─────────────────────────────────────────────
// CSS 변수명 생성 (css-generator.ts toVarName 'font' prefix 로직 재현)
// ─────────────────────────────────────────────
function toCssVar(tokenName: string): string {
  let slug = tokenName
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  // line-height: font prefix 없이 그대로
  if (slug.startsWith('line-height-')) return `--${slug}`;

  // letter-spacing: css-generator와 동일 — "letter-spacing-{n}" → "--letter-spacing-{n}"
  if (slug.startsWith('letter-spacing-')) return `--${slug}`;

  // font- prefix 반복 제거
  while (slug.startsWith('font-')) slug = slug.slice(5);

  // "family-font-family-display" → "family-display"
  if (slug.startsWith('family-font-family-')) {
    slug = slug.replace('family-font-family-', 'family-');
  }

  return `--font-${slug}`;
}

// ─────────────────────────────────────────────
// 파서 유틸
// ─────────────────────────────────────────────
function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/-{2,}/g, '-');
}

function parseName(name: string): { size: SizeKey; weight: WeightKey } | null {
  const parts = name.split('/').map(normalizeKey);
  if (parts.length < 2) return null;
  const rawWeight = parts[parts.length - 1] as WeightKey;
  if (!WEIGHT_ORDER.some((w) => w.key === rawWeight)) return null;
  const sizeRaw = parts.slice(0, -1).join('-');
  if (!SIZE_ORDER.includes(sizeRaw as SizeKey)) return null;
  return { size: sizeRaw as SizeKey, weight: rawWeight };
}

function parseLineHeight(raw: string | number | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw > 0 ? raw : null;
  const px = parseFloat(raw);
  return Number.isNaN(px) ? null : px;
}

// ─────────────────────────────────────────────
// 복합 토큰 파서 (가이드 스케일용)
// ─────────────────────────────────────────────
function parseScaleTokens(tokens: TokenRow[]): {
  scaleMap: TypeScaleMap;
  fontFamilyDisplay: string;
  fontFamilyBody: string;
} {
  const scaleMap: TypeScaleMap = new Map();

  for (const token of tokens) {
    let cv: Record<string, unknown>;
    try {
      cv = JSON.parse(token.value) as Record<string, unknown>;
    } catch { continue; }
    if (typeof cv.fontSize !== 'number') continue;

    const parsed = parseName(token.name);
    if (!parsed) continue;
    const { size, weight } = parsed;

    if (!scaleMap.has(size)) scaleMap.set(size, new Map());
    scaleMap.get(size)!.set(weight, {
      fontFamily:    typeof cv.fontFamily === 'string' ? cv.fontFamily : 'Inter',
      category:      cv.category === 'display' ? 'display' : 'body',
      fontSize:      cv.fontSize,
      fontWeight:    typeof cv.fontWeight === 'number' ? cv.fontWeight
                       : WEIGHT_ORDER.find((w) => w.key === weight)?.numeric ?? 400,
      lineHeight:    parseLineHeight(cv.lineHeight as string | number | undefined),
      letterSpacing: typeof cv.letterSpacing === 'string' && cv.letterSpacing !== '0'
                       ? cv.letterSpacing : null,
    });
  }

  const displayRef = scaleMap.get('display-2xl')?.get('regular')
    ?? scaleMap.get('display-xl')?.get('regular');
  const bodyRef = scaleMap.get('text-md')?.get('regular')
    ?? scaleMap.get('text-sm')?.get('regular');

  return {
    scaleMap,
    fontFamilyDisplay: displayRef?.fontFamily ?? 'Inter',
    fontFamilyBody:    bodyRef?.fontFamily    ?? 'Inter',
  };
}

// ─────────────────────────────────────────────
// 원시 토큰 파서 (Token Reference용)
// ─────────────────────────────────────────────
function parsePrimitiveTokens(tokens: TokenRow[]): {
  fontSizes: PrimitiveToken[];
  lineHeights: PrimitiveToken[];
  fontFamilies: PrimitiveToken[];
  fontWeights: PrimitiveToken[];
  letterSpacings: PrimitiveToken[];
} {
  const fontSizes: PrimitiveToken[] = [];
  const lineHeights: PrimitiveToken[] = [];
  const fontFamilies: PrimitiveToken[] = [];
  const fontWeights: PrimitiveToken[] = [];
  const letterSpacings: PrimitiveToken[] = [];

  // rem → px 변환 (표시용)
  const remToPx = (rem: string): string | undefined => {
    const m = rem.match(/^(\d+(?:\.\d+)?)rem$/);
    return m ? `${Math.round(parseFloat(m[1]) * 16)}px` : undefined;
  };
  // em → % 변환 (letter-spacing 표시용)
  const emToPercent = (em: string): string | undefined => {
    const m = em.match(/^-?(\d+(?:\.\d+)?)em$/);
    return m ? `${Math.round(parseFloat(em) * 100)}%` : undefined;
  };

  for (const token of tokens) {
    // 복합 JSON 토큰은 건너뜀
    try {
      const v = JSON.parse(token.value) as Record<string, unknown>;
      if (typeof v.fontSize === 'number') continue;
    } catch { /* 원시값 — 처리 계속 */ }

    const lower = token.name.toLowerCase();

    // font-weight italic은 CSS font-weight 속성과 무관 → 제외
    if (lower.includes('font') && lower.includes('weight') && lower.includes('italic')) continue;

    const val = token.value;
    const cssVar = toCssVar(token.name);

    if (lower.includes('font') && lower.includes('size')) {
      // DB 값이 숫자("12")인 경우 rem 변환, 이미 rem이면 그대로
      const numPx = parseFloat(val);
      const remVal = val.endsWith('rem') ? val : isNaN(numPx) ? val : `${numPx / 16}rem`;
      const pxVal  = val.endsWith('rem') ? `${Math.round(parseFloat(val) * 16)}px` : `${numPx}px`;
      fontSizes.push({ name: token.name, value: remVal, altValue: pxVal, cssVar });
    } else if (lower.includes('line') && lower.includes('height')) {
      const numPx = parseFloat(val);
      const remVal = val.endsWith('rem') ? val : isNaN(numPx) ? val : `${numPx / 16}rem`;
      const pxVal  = val.endsWith('rem') ? `${Math.round(parseFloat(val) * 16)}px` : `${numPx}px`;
      lineHeights.push({ name: token.name, value: remVal, altValue: pxVal, cssVar });
    } else if (lower.includes('font') && lower.includes('family')) {
      fontFamilies.push({ name: token.name, value: val, cssVar });
    } else if (lower.includes('font') && lower.includes('weight')) {
      fontWeights.push({ name: token.name, value: val, cssVar });
    } else if (lower.includes('letter') && lower.includes('spacing')) {
      letterSpacings.push({ name: token.name, value: val, altValue: emToPercent(val), cssVar });
    }
  }

  return { fontSizes, lineHeights, fontFamilies, fontWeights, letterSpacings };
}

// ─────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────
function formatScaleLabel(key: string): string {
  const [first, ...rest] = key.split('-');
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

function toRem(px: number): string {
  return `${(px / 16).toFixed(4).replace(/\.?0+$/, '')}rem`;
}

// ─────────────────────────────────────────────
// 서브 컴포넌트: Token Reference 테이블
// ─────────────────────────────────────────────
interface RefGroup {
  label: string;
  items: PrimitiveToken[];
}

function TokenRefTable({ groups }: { groups: RefGroup[] }) {
  const filled = groups.filter((g) => g.items.length > 0);
  if (filled.length === 0) return null;

  return (
    <div className={styles.typoRefSection}>
      <h3 className={styles.typoRefTitle}>Token Reference</h3>
      <p className={styles.typoRefDesc}>
        CSS 변수명으로 직접 참조할 수 있는 원시 토큰입니다.
      </p>
      <div className={styles.typoRefGroups}>
        {filled.map((group) => (
          <div key={group.label} className={styles.typoRefGroup}>
            <div className={styles.typoRefGroupHeader}>
              <span className={styles.typoRefGroupLabel}>{group.label}</span>
              <span className={styles.typoRefGroupCount}>{group.items.length}</span>
            </div>
            <div className={styles.typoRefTableHead}>
              <span>Token</span>
              <span>Value</span>
              <span>CSS Variable</span>
            </div>
            {group.items.map((item) => (
              <div key={item.name} className={styles.typoRefRow}>
                <span className={styles.typoRefTokenName}>
                  {item.name.split('/').pop()}
                </span>
                <span className={styles.typoRefValue}>
                  {item.value}
                  {item.altValue && (
                    <span className={styles.typoRefAlt}> / {item.altValue}</span>
                  )}
                </span>
                <span className={styles.typoRefVar}>{item.cssVar}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
export default function TypographyList({ tokens }: { tokens: TokenRow[] }) {
  if (tokens.length === 0) return null;

  const { scaleMap, fontFamilyDisplay, fontFamilyBody } = parseScaleTokens(tokens);
  const orderedScale = SIZE_ORDER.filter((k) => scaleMap.has(k));

  if (orderedScale.length === 0) return null;

  const { fontSizes, lineHeights, fontFamilies, fontWeights, letterSpacings } = parsePrimitiveTokens(tokens);

  const specimenFont = orderedScale.some((k) => k.startsWith('display'))
    ? fontFamilyDisplay
    : fontFamilyBody;

  const resolvedWeights = WEIGHT_ORDER.map((w) => {
    const cell = scaleMap.get('display-2xl')?.get(w.key)
      ?? scaleMap.get('text-md')?.get(w.key)
      ?? scaleMap.get(orderedScale[0])?.get(w.key);
    return { ...w, resolved: cell?.fontWeight ?? w.numeric };
  });

  // 그룹 헤더 표시 여부
  const hasDisplay = orderedScale.some((k) => k.startsWith('display'));
  const hasText    = orderedScale.some((k) => k.startsWith('text'));

  return (
    <div>
      {/* ── Typeface Specimen ────────────────── */}
      <div className={styles.typoSpecimen}>
        <div className={styles.typoSpecimenLeft} style={{ fontFamily: specimenFont }}>
          <span className={styles.typoFontName}>{specimenFont}</span>
          <span className={styles.typoFontAg}>Ag</span>
          <span className={styles.typoAlphabet}>
            ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />
            abcdefghijklmnopqrstuvwxyz<br />
            가나다라마바사아자차카타파하<br />
            0123456789 !@#$%^&amp;*()
          </span>
        </div>

        <div className={styles.typoWeightList}>
          {resolvedWeights.map((w) => (
            <div key={w.key} className={styles.typoWeightItem}>
              <span
                className={styles.typoWeightAa}
                style={{ fontFamily: specimenFont, fontWeight: w.resolved }}
              >
                Aa
              </span>
              <div className={styles.typoWeightInfo}>
                <span className={styles.typoWeightLabel} style={{ fontWeight: w.resolved }}>
                  {w.label}
                </span>
                <span className={styles.typoWeightValue}>Font weight: {w.resolved}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Type Scale ───────────────────────── */}
      <div className={styles.typoScale}>
        {orderedScale.map((sizeKey, idx) => {
          const weightMap = scaleMap.get(sizeKey)!;
          const ref = weightMap.get('regular') ?? [...weightMap.values()][0];
          if (!ref) return null;

          // 그룹 헤더: display 첫 번째, text 첫 번째 앞에 표시
          const isFirstDisplay = hasDisplay && sizeKey === orderedScale.find((k) => k.startsWith('display'));
          const isFirstText    = hasText    && sizeKey === orderedScale.find((k) => k.startsWith('text'));
          void idx;

          const specParts: string[] = [
            `Font size: ${ref.fontSize}px / ${toRem(ref.fontSize)}`,
          ];
          if (ref.lineHeight)    specParts.push(`Line height: ${ref.lineHeight}px / ${toRem(ref.lineHeight)}`);
          if (ref.letterSpacing) specParts.push(`Letter spacing: ${ref.letterSpacing}`);

          return (
            <div key={sizeKey}>
              {/* 그룹 헤더 */}
              {isFirstDisplay && (
                <div className={styles.typoScaleGroupHeader}>
                  <span className={styles.typoScaleGroupLabel}>Display</span>
                  <span className={styles.typoScaleGroupDesc}>제목·히어로 텍스트</span>
                </div>
              )}
              {isFirstText && (
                <div className={styles.typoScaleGroupHeader}>
                  <span className={styles.typoScaleGroupLabel}>Text</span>
                  <span className={styles.typoScaleGroupDesc}>본문·UI 텍스트</span>
                </div>
              )}

              {/* 스케일 row */}
              <div className={styles.typoScaleRow}>
                <div className={styles.typoScaleRowHead}>
                  <span className={styles.typoScaleRowLabel}>{formatScaleLabel(sizeKey)}</span>
                  <span className={styles.typoScaleRowSpecs}>{specParts.join(' | ')}</span>
                </div>

                {/* 웨이트별 전체 너비 스펙시맨 */}
                <div className={styles.typoScaleWeightRows}>
                  {WEIGHT_ORDER.map((w) => {
                    const cell = weightMap.get(w.key);
                    if (!cell) return null;
                    const fontVar = `--font-${sizeKey}-${w.key}`;
                    // letterSpacing 값(-0.02em)에서 --letter-spacing-{n} 직접 도출
                    const lsMatch = cell.letterSpacing?.match(/^-?(\d+(?:\.\d+)?)em$/);
                    const lsVarN  = lsMatch ? Math.round(parseFloat(lsMatch[1]) * 100) : null;
                    const lsVar   = lsVarN ? `--letter-spacing-${lsVarN}` : null;
                    return (
                      <div key={w.key} className={styles.typoScaleWeightRow}>
                        <p
                          className={styles.typoScaleSpecimenText}
                          style={{
                            font:          `var(${fontVar})`,
                            letterSpacing: lsVar ? `var(${lsVar})` : undefined,
                          }}
                        >
                          {formatScaleLabel(sizeKey)}
                        </p>
                        <div className={styles.typoScaleVarMeta}>
                          <code className={styles.typoScaleVarName}>{fontVar}</code>
                          {lsVar && (
                            <code className={styles.typoScaleVarName}>{lsVar}</code>
                          )}
                          <span className={styles.typoScaleWeightLabel}>{w.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Token Reference ──────────────────── */}
      <TokenRefTable
        groups={[
          { label: 'Font Size',      items: fontSizes      },
          { label: 'Line Height',    items: lineHeights    },
          { label: 'Letter Spacing', items: letterSpacings },
          { label: 'Font Family',    items: fontFamilies   },
          { label: 'Font Weight',    items: fontWeights    },
        ]}
      />
    </div>
  );
}
