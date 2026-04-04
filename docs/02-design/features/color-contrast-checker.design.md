# Design: 색상 명도대비 검사 시스템

_텍스트 vs 배경 색상의 WCAG 명도대비를 테마별로 검사_

---

## 📌 Overview

| 항목 | 내용 |
|------|------|
| Feature | color-contrast-checker |
| Goal | 팔레트 모드에서 의미있는 조합만 명도대비 표시 |
| Core Value | 텍스트 가독성 자동 검증 + 테마별 대응 |

---

## 🎯 Goals

1. **수동 모드**: 모든 색상 조합 명도대비 표
2. **팔레트 모드**: 텍스트 vs 배경 색상만 비교 (노이즈 제거)
3. **테마 대응**: Light/Dark 모드 동시 표시
4. **WCAG 등급**: AAA / AA / AA Large / FAIL 자동 분류

---

## 📐 UI 설계

### 팔레트 모드 레이아웃

```
┌─────────────────────────────────────────────────────┐
│ 명도대비 검사                                       │
│                                                     │
│ [수동] [팔레트]              필터: [전체] [실패만]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ color/text/primary  vs  color/background/light      │
│                                                     │
│ ┌── LIGHT ──────────┐  ┌── DARK ────────────┐      │
│ │ Aa  배경색  텍스트 │  │ Aa  배경색  텍스트 │      │
│ │    #FFFFFF #1A1A1A │  │    #0A0A0A #FFFFFF │      │
│ │    18.1:1  ✅ AAA  │  │    21:1    ✅ AAA  │      │
│ └────────────────────┘  └────────────────────┘      │
│                                                     │
│ color/text/secondary vs color/background/light      │
│                                                     │
│ ┌── LIGHT ──────────┐  ┌── DARK ────────────┐      │
│ │ Aa  배경색  텍스트 │  │ Aa  배경색  텍스트 │      │
│ │    #FFFFFF #666666 │  │    #0A0A0A #999999 │      │
│ │    4.5:1   ✅ AA   │  │    3.5:1   ❌ FAIL │      │
│ └────────────────────┘  └────────────────────┘      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📊 색상 카테고리 분류

```typescript
// 토큰 이름 기반 카테고리 자동 감지
function categorizeColor(name: string): ColorCategory {
  const lower = name.toLowerCase();
  
  if (/\/(text|label|foreground|fg|on-|content)/.test(lower)) return 'text';
  if (/\/(background|bg|surface|fill|canvas|base)/.test(lower)) return 'background';
  if (/\/(border|stroke|outline|divider|separator)/.test(lower)) return 'border';
  if (/\/(icon|pictogram)/.test(lower)) return 'icon';
  return 'other';
}

type ColorCategory = 'text' | 'background' | 'border' | 'icon' | 'other';
```

---

## 🧮 명도대비 계산

```typescript
// WCAG 2.1 기준 상대 휘도
function getRelativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// 명도대비 계산
function getContrastRatio(color1: ParsedColor, color2: ParsedColor): number {
  const l1 = getRelativeLuminance(color1.r, color1.g, color1.b);
  const l2 = getRelativeLuminance(color2.r, color2.g, color2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG 등급 판정
function getWCAGLevel(ratio: number): WCAGLevel {
  if (ratio >= 7)   return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3)   return 'AA_LARGE'; // 18px 이상 또는 14px bold
  return 'FAIL';
}

type WCAGLevel = 'AAA' | 'AA' | 'AA_LARGE' | 'FAIL';
```

---

## 🎨 테마별 토큰 값 처리

```typescript
// DB에서 mode별 값 조회
interface TokenWithModes {
  name: string;
  values: {
    light?: string;   // Light 모드 값
    dark?: string;    // Dark 모드 값
    default?: string; // 모드 없는 기본값
  };
}

// tokens 테이블에서 mode별 그룹핑
function groupByMode(tokens: TokenRow[]): TokenWithModes[] {
  const map = new Map<string, TokenWithModes>();
  
  for (const token of tokens) {
    const key = token.name;
    if (!map.has(key)) {
      map.set(key, { name: key, values: {} });
    }
    const entry = map.get(key)!;
    const mode = token.mode?.toLowerCase();
    
    if (mode === 'light') entry.values.light = token.value;
    else if (mode === 'dark') entry.values.dark = token.value;
    else entry.values.default = token.value;
  }
  
  return Array.from(map.values());
}

// 테마별 대비율 계산
interface ContrastResult {
  textToken: string;
  bgToken: string;
  light?: {
    textColor: string;
    bgColor: string;
    ratio: number;
    level: WCAGLevel;
  };
  dark?: {
    textColor: string;
    bgColor: string;
    ratio: number;
    level: WCAGLevel;
  };
}

function calculateContrast(
  textToken: TokenWithModes,
  bgToken: TokenWithModes,
): ContrastResult {
  const result: ContrastResult = {
    textToken: textToken.name,
    bgToken: bgToken.name,
  };

  for (const theme of ['light', 'dark'] as const) {
    const textColor = textToken.values[theme] ?? textToken.values.default;
    const bgColor = bgToken.values[theme] ?? bgToken.values.default;
    
    if (!textColor || !bgColor) continue;
    
    const tc = parseColor(textColor);
    const bc = parseColor(bgColor);
    if (!tc || !bc) continue;
    
    const ratio = getContrastRatio(tc, bc);
    result[theme] = {
      textColor,
      bgColor,
      ratio: Math.round(ratio * 100) / 100,
      level: getWCAGLevel(ratio),
    };
  }

  return result;
}
```

---

## 🏗️ 컴포넌트 구조

```
src/app/(ide)/tokens/[type]/
├── ColorGrid.tsx              (기존 - 팔레트 표시)
├── ContrastChecker.tsx        (신규 - 명도대비 검사)
├── ContrastPairCard.tsx       (신규 - 개별 쌍 카드)
└── token-views.module.scss    (기존 - 스타일 추가)
```

### ContrastChecker.tsx

```typescript
interface ContrastCheckerProps {
  tokens: TokenRow[];
}

export default function ContrastChecker({ tokens }: ContrastCheckerProps) {
  const [mode, setMode] = useState<'manual' | 'palette'>('palette');
  const [filter, setFilter] = useState<'all' | 'fail'>('all');

  // 토큰 분류
  const tokensByMode = useMemo(() => groupByMode(tokens), [tokens]);
  const textTokens = useMemo(
    () => tokensByMode.filter(t => categorizeColor(t.name) === 'text'),
    [tokensByMode]
  );
  const bgTokens = useMemo(
    () => tokensByMode.filter(t => categorizeColor(t.name) === 'background'),
    [tokensByMode]
  );

  // 팔레트 모드: 텍스트 vs 배경만
  const palettePairs = useMemo(() => {
    const pairs = textTokens.flatMap(text =>
      bgTokens.map(bg => calculateContrast(text, bg))
    );
    
    if (filter === 'fail') {
      return pairs.filter(p =>
        p.light?.level === 'FAIL' || p.dark?.level === 'FAIL'
      );
    }
    return pairs;
  }, [textTokens, bgTokens, filter]);

  return (
    <div>
      {/* 모드 탭 */}
      <div className={styles.contrastTabs}>
        <button onClick={() => setMode('palette')}>팔레트</button>
        <button onClick={() => setMode('manual')}>수동</button>
        
        {/* 필터 */}
        <select onChange={(e) => setFilter(e.target.value as 'all' | 'fail')}>
          <option value="all">전체</option>
          <option value="fail">실패만</option>
        </select>
      </div>

      {/* 결과 목록 */}
      <div className={styles.contrastList}>
        {palettePairs.map(pair => (
          <ContrastPairCard key={`${pair.textToken}-${pair.bgToken}`} pair={pair} />
        ))}
      </div>
    </div>
  );
}
```

### ContrastPairCard.tsx

```typescript
interface ContrastPairCardProps {
  pair: ContrastResult;
}

export function ContrastPairCard({ pair }: ContrastPairCardProps) {
  return (
    <div className={styles.contrastPairCard}>
      {/* 토큰 이름 */}
      <div className={styles.contrastPairHeader}>
        <span className={styles.textTokenName}>{pair.textToken}</span>
        <span className={styles.vsLabel}>vs</span>
        <span className={styles.bgTokenName}>{pair.bgToken}</span>
      </div>

      {/* 테마별 결과 */}
      <div className={styles.contrastThemes}>
        {pair.light && (
          <ContrastThemeCard
            theme="Light"
            textColor={pair.light.textColor}
            bgColor={pair.light.bgColor}
            ratio={pair.light.ratio}
            level={pair.light.level}
          />
        )}
        {pair.dark && (
          <ContrastThemeCard
            theme="Dark"
            textColor={pair.dark.textColor}
            bgColor={pair.dark.bgColor}
            ratio={pair.dark.ratio}
            level={pair.dark.level}
          />
        )}
      </div>
    </div>
  );
}

function ContrastThemeCard({ theme, textColor, bgColor, ratio, level }) {
  const levelColor = {
    AAA: '#16a34a',
    AA: '#2563eb',
    AA_LARGE: '#d97706',
    FAIL: '#dc2626',
  }[level];

  return (
    <div
      className={styles.contrastThemeCard}
      style={{ backgroundColor: bgColor }}
    >
      {/* 미리보기 텍스트 */}
      <span style={{ color: textColor, fontWeight: 'bold', fontSize: '24px' }}>Aa</span>
      <span style={{ color: textColor, fontSize: '12px' }}>가나다</span>

      {/* 색상값 */}
      <div className={styles.colorValues}>
        <span>{bgColor}</span>
        <span>{textColor}</span>
      </div>

      {/* 대비율 + 등급 */}
      <div className={styles.ratioRow}>
        <span className={styles.ratio}>{ratio}:1</span>
        <span className={styles.level} style={{ color: levelColor }}>
          {level === 'AA_LARGE' ? 'AA Large' : level}
          {level !== 'FAIL' ? ' ✅' : ' ❌'}
        </span>
      </div>

      <div className={styles.themeLabel}>{theme}</div>
    </div>
  );
}
```

---

## 🚀 Implementation Phases

### Phase 1: 기본 대비율 계산 (Day 1)
- [ ] `getContrastRatio` 함수 구현
- [ ] `getWCAGLevel` 함수 구현
- [ ] `categorizeColor` 함수 구현
- [ ] `groupByMode` 함수 구현

### Phase 2: UI 컴포넌트 (Day 2)
- [ ] `ContrastPairCard.tsx` 구현
- [ ] `ContrastChecker.tsx` 구현
- [ ] `ColorGrid`에 탭 추가 (팔레트 탭 안에 통합)
- [ ] 스타일 추가

### Phase 3: 필터 & UX (Day 3)
- [ ] 실패만 필터
- [ ] 모드 토글 (Light/Dark)
- [ ] 복사 기능 (토큰명 복사)
- [ ] 빈 상태 처리

---

## ✅ Acceptance Criteria

- [ ] 팔레트 모드: 텍스트 vs 배경만 표시
- [ ] Light/Dark 테마 동시 표시
- [ ] WCAG 등급 (AAA/AA/AA Large/FAIL) 표시
- [ ] 실패 조합 필터 동작
- [ ] 토큰이 한 모드만 있어도 표시
- [ ] 대비율 소수점 2자리 표시

---

**작성**: 2026-04-04
**상태**: Draft
