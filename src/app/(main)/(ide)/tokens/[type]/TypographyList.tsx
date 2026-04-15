'use client';

import type { TokenRow } from '@/lib/actions/tokens';
import { toVarName, TYPE_PREFIX } from '@/lib/tokens/css-generator';
import styles from './token-views.module.scss';

// ─────────────────────────────────────────────
// weight 판별 정규식
// ─────────────────────────────────────────────
const PURE_WEIGHT_REGEX =
  /^(regular|medium|semibold|semi[-\s]?bold|bold|light|black|heavy|thin|extra[-\s]?bold|extra[-\s]?light|demi|book)$/i;

const WEIGHT_SUFFIX_REGEX =
  /\s+(regular|medium|semibold|semi[-\s]?bold|bold|light|black|heavy|thin|strong|stronger|emphasis)$/i;

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
interface VariantEntry {
  tokenName: string;
  label: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number | null;
  letterSpacing: string | null;
}

interface ScaleEntry {
  label: string;
  fontSize: number;
  variants: VariantEntry[];
}

interface PrimitiveToken {
  name: string;
  value: string;
  altValue?: string;
  cssVar: string;
}

// ─────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────
function parseLineHeightPx(raw: string | number | undefined | null): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw > 0 ? raw : null;
  const px = parseFloat(raw);
  return Number.isNaN(px) ? null : px;
}

function toRem(px: number): string {
  return `${(px / 16).toFixed(4).replace(/\.?0+$/, '')}rem`;
}

// ─────────────────────────────────────────────
// groupKey — 이름 기반 그룹 키 추출
// ─────────────────────────────────────────────
function groupKey(tokenName: string): string {
  const lastSlash = tokenName.lastIndexOf('/');
  const parent = lastSlash >= 0 ? tokenName.slice(0, lastSlash) : '';
  const lastSeg = lastSlash >= 0 ? tokenName.slice(lastSlash + 1) : tokenName;

  // 마지막 세그먼트가 순수 weight 단어 → parent가 그룹
  if (PURE_WEIGHT_REGEX.test(lastSeg.trim())) return parent;

  // 마지막 세그먼트에 weight suffix 존재 → suffix 제거한 base가 그룹
  const base = lastSeg.replace(WEIGHT_SUFFIX_REGEX, '').trim();
  if (base !== lastSeg) return parent ? `${parent}/${base}` : base;

  // 그 외: 토큰 이름 자체가 그룹 (단독 스타일)
  return tokenName;
}

// ─────────────────────────────────────────────
// 복합 토큰 파서 (가이드 스케일용)
// ─────────────────────────────────────────────
function buildScaleMap(tokens: TokenRow[]): ScaleEntry[] {
  const byGroup = new Map<string, VariantEntry[]>();

  for (const token of tokens) {
    let cv: { fontFamily?: string; fontSize?: number; fontWeight?: number; lineHeight?: string | number | null; letterSpacing?: string | null };
    try {
      cv = JSON.parse(token.value) as typeof cv;
    } catch { continue; }
    if (typeof cv.fontFamily !== 'string' || typeof cv.fontSize !== 'number') continue;

    const key = groupKey(token.name);
    const parts = token.name.split('/');
    const entry: VariantEntry = {
      tokenName: token.name,
      label: parts[parts.length - 1],
      fontFamily: cv.fontFamily,
      fontSize: cv.fontSize,
      fontWeight: typeof cv.fontWeight === 'number' ? cv.fontWeight : 400,
      lineHeight: parseLineHeightPx(cv.lineHeight),
      letterSpacing:
        typeof cv.letterSpacing === 'string' && cv.letterSpacing !== '0'
          ? cv.letterSpacing
          : null,
    };

    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(entry);
  }

  // insertion order 유지 (원본 토큰 파일 순서 반영)
  return [...byGroup.entries()].map(([key, variants]) => {
    variants.sort((a, b) => a.fontWeight - b.fontWeight);
    return {
      label: key,
      fontSize: variants[0].fontSize,
      variants,
    };
  });
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
    const cssVar = toVarName(token.name, TYPE_PREFIX['typography']);

    if (lower.includes('font') && lower.includes('size')) {
      const numPx = parseFloat(val);
      const remVal = val.endsWith('rem') ? val : isNaN(numPx) ? val : `${numPx / 16}rem`;
      const pxVal = val.endsWith('rem') ? `${Math.round(parseFloat(val) * 16)}px` : `${numPx}px`;
      fontSizes.push({ name: token.name, value: remVal, altValue: pxVal, cssVar });
    } else if (lower.includes('line') && lower.includes('height')) {
      const numPx = parseFloat(val);
      const remVal = val.endsWith('rem') ? val : isNaN(numPx) ? val : `${numPx / 16}rem`;
      const pxVal = val.endsWith('rem') ? `${Math.round(parseFloat(val) * 16)}px` : `${numPx}px`;
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
const WEIGHT_LABEL: Record<number, string> = {
  100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular',
  500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black',
};

export default function TypographyList({ tokens }: { tokens: TokenRow[] }) {
  if (tokens.length === 0) return null;

  const scaleEntries = buildScaleMap(tokens);
  if (scaleEntries.length === 0) return null;

  const { fontSizes, lineHeights, fontFamilies, fontWeights, letterSpacings } =
    parsePrimitiveTokens(tokens);

  // Typeface Specimen: 고유 fontFamily 수집
  const specimenFont =
    scaleEntries[0]?.variants[0]?.fontFamily ?? 'sans-serif';

  // Weight specimen: 전체 고유 fontWeight 수집
  const uniqueWeights = [
    ...new Set(scaleEntries.flatMap((e) => e.variants.map((v) => v.fontWeight))),
  ].sort((a, b) => a - b);

  // 섹션 헤더: 첫 번째 path segment별 그룹 수 계산
  const firstSegCount = new Map<string, number>();
  for (const entry of scaleEntries) {
    const firstSeg = entry.label.split('/')[0];
    firstSegCount.set(firstSeg, (firstSegCount.get(firstSeg) ?? 0) + 1);
  }

  // 각 multi-group first segment의 첫 번째 entry label을 섹션 헤더 표시 대상으로 등록
  const sectionHeaderBefore = new Set<string>();
  const seenSections = new Set<string>();
  for (const entry of scaleEntries) {
    const firstSeg = entry.label.split('/')[0];
    if ((firstSegCount.get(firstSeg) ?? 0) > 1 && !seenSections.has(firstSeg)) {
      seenSections.add(firstSeg);
      sectionHeaderBefore.add(entry.label);
    }
  }

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
          {uniqueWeights.map((w) => (
            <div key={w} className={styles.typoWeightItem}>
              <span
                className={styles.typoWeightAa}
                style={{ fontFamily: specimenFont, fontWeight: w }}
              >
                Aa
              </span>
              <div className={styles.typoWeightInfo}>
                <span className={styles.typoWeightLabel} style={{ fontWeight: w }}>
                  {WEIGHT_LABEL[w] ?? `Weight ${w}`}
                </span>
                <span className={styles.typoWeightValue}>Font weight: {w}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Type Scale ───────────────────────── */}
      <div className={styles.typoScale}>
        {scaleEntries.map((entry) => {
          const ref = entry.variants[0];
          const firstSeg = entry.label.split('/')[0];
          const displayLabel = entry.label.includes('/')
            ? entry.label.split('/').slice(1).join('/')
            : entry.label;

          const specParts: string[] = [
            `Font size: ${entry.fontSize}px / ${toRem(entry.fontSize)}`,
          ];
          if (ref.lineHeight)
            specParts.push(`Line height: ${ref.lineHeight}px / ${toRem(ref.lineHeight)}`);
          if (ref.letterSpacing)
            specParts.push(`Letter spacing: ${ref.letterSpacing}`);

          return (
            <div key={entry.label}>
              {/* 섹션 헤더 (ISD 다중 모드 등 multi-group first segment) */}
              {sectionHeaderBefore.has(entry.label) && (
                <div className={styles.typoScaleGroupHeader}>
                  <span className={styles.typoScaleGroupLabel}>{firstSeg}</span>
                </div>
              )}

              {/* 스케일 row */}
              <div className={styles.typoScaleRow}>
                <div className={styles.typoScaleRowHead}>
                  <span className={styles.typoScaleRowLabel}>{displayLabel}</span>
                  <span className={styles.typoScaleRowSpecs}>{specParts.join(' | ')}</span>
                </div>

                <div className={styles.typoScaleWeightRows}>
                  {entry.variants.map((variant) => {
                    const variantVar = toVarName(variant.tokenName, TYPE_PREFIX['typography']);
                    const fallbackFont = [
                      variant.fontWeight,
                      `${variant.fontSize / 16}rem`,
                      '/',
                      variant.lineHeight ? `${variant.lineHeight / 16}rem` : 'normal',
                      `'${variant.fontFamily}'`,
                    ].join(' ');

                    const lsMatch = variant.letterSpacing?.match(/^-?(\d+(?:\.\d+)?)em$/);
                    const lsVarN = lsMatch ? Math.round(parseFloat(lsMatch[1]) * 100) : null;
                    const lsVar = lsVarN ? `--letter-spacing-${lsVarN}` : null;

                    return (
                      <div key={variant.tokenName} className={styles.typoScaleWeightRow}>
                        <p
                          className={styles.typoScaleSpecimenText}
                          style={{
                            font: `var(${variantVar}, ${fallbackFont})`,
                            letterSpacing: lsVar ? `var(${lsVar})` : undefined,
                          }}
                        >
                          {displayLabel}
                        </p>
                        <div className={styles.typoScaleVarMeta}>
                          <code className={styles.typoScaleVarName}>{variantVar}</code>
                          {lsVar && (
                            <code className={styles.typoScaleVarName}>{lsVar}</code>
                          )}
                          <span className={styles.typoScaleWeightLabel}>{variant.label}</span>
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
