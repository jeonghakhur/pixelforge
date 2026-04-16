# Design: typography-refactor

_TypographyList 범용 재설계 — 하드코딩된 명칭 화이트리스트 제거 및 데이터 기반 렌더링_

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | `SIZE_ORDER`/`WEIGHT_ORDER` 화이트리스트와 이름 패턴 파싱으로 인해 `LG (Default)/h1` 같은 비표준 명칭 구조에서 화면이 완전히 빈 상태가 된다. `css-generator.ts`도 `display`를 이름으로 판별해 familySlug를 결정하는 하드코딩이 있다. |
| Solution | 스케일 맵을 **토큰 이름 기반 `groupKey()` 알고리즘**으로 그룹화한다. 순수 weight 단어(Regular/Bold 등) 또는 weight suffix(` medium`, ` strong`)를 제거해 그룹 키를 추출. weight/variant 정보는 JSON `fontWeight` 필드에서 읽는다. `toCssVar()` 로컬 함수를 `css-generator.ts`의 실제 `toVarName` 임포트로 교체한다. |
| Function/UX Effect | 어떤 Figma 프로젝트의 타이포그래피 토큰이든 TypographyList가 올바르게 렌더링된다. CSS 변수 표시도 실제 생성된 변수명과 일치한다. |
| Core Value | 범용성 확보 — 특정 디자인 시스템(Untitled UI 등)에 종속되지 않는 토큰 가이드 페이지 |

---

## Overview

| 항목 | 내용 |
|------|------|
| Feature | typography-refactor |
| Plan | `docs/01-plan/features/typography-refactor.plan.md` |
| Updated | 2026-04-15 |

**현재 상태 (코드 실측 기반)**

Plan 작성 이후 일부 항목이 이미 구현됨:

| 항목 | 상태 | 비고 |
|------|------|------|
| `parse-variables.ts` heading/text-style → typography 통일 | ✅ 완료 | 구버전 폴백도 모두 `type='typography'` |
| `TypographyList.tsx` — 단일 `tokens: TokenRow[]` prop | ✅ 완료 | `compositeTokens` prop 없음 |
| `TypographyList.tsx` — 범용 데이터 기반 파싱 | ❌ 미완 | `SIZE_ORDER`/`WEIGHT_ORDER` 하드코딩 잔존 |
| `css-generator.ts` — familySlug 이름 의존 | ❌ 미완 | `sizeSlug.startsWith('display')` 하드코딩 |
| `page.tsx` — text-style/heading 분기 제거 | ❌ 미완 | line 92-93 잔존 |

이번 설계의 핵심은 **❌ 3개 항목**의 구현 방법이다.

---

## 1. 변경 파일 및 책임

| 파일 | 변경 핵심 |
|------|-----------|
| `src/app/(main)/(ide)/tokens/[type]/TypographyList.tsx` | 범용 파싱 알고리즘으로 전면 교체 |
| `src/lib/tokens/css-generator.ts` | `familySlug` 결정 로직: 이름 → `parsed.category` |
| `src/app/(main)/(ide)/tokens/[type]/page.tsx` | `text-style`/`heading` 분기 2줄 삭제 |

---

## 2. TypographyList 범용 재설계

### 2.1 핵심 원칙 (memory 기반 규칙)

1. 특정 토큰 이름 배열(화이트리스트) 상수 금지
2. 그룹/카테고리 = `token.name.split('/')` 동적 추출
3. weight/variant 메타정보 = JSON `fontWeight`/`fontFamily` 필드에서 읽기
4. `.get('display-2xl')` 형태의 직접 키 참조 금지

### 2.2 스케일 맵 구조

```typescript
// 그룹 키: 이름 기반 (groupKey() 함수 결과)
// 이유: fontSize만으로는 의미적으로 다른 스타일을 구분할 수 없다.
//   SM/H3 (16px, 700) + SM/H4 (16px, 700) → fontSize 동일이지만 별개 그룹
//   Display 2xl/Regular + Display 2xl/Bold → weight 제거 시 동일 그룹 "Display 2xl"
//   LG (Default)/body1 + LG (Default)/body1 medium → suffix 제거 시 동일 그룹 "LG (Default)/body1"

type ScaleEntry = {
  label: string;        // 표시명 = groupKey 결과 (e.g. "Display 2xl", "LG (Default)/body1", "SM/H3")
  fontSize: number;     // 대표 fontSize (첫 variant 기준, 표시용)
  variants: VariantEntry[];  // fontWeight 오름차순 정렬
};

type VariantEntry = {
  tokenName: string;    // 원본 token.name (CSS var 생성용)
  label: string;        // 마지막 name 세그먼트 (e.g. "Regular", "bold", "H3")
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number | null;
  letterSpacing: string | null;
};
```

### 2.3 groupKey() + buildScaleMap 알고리즘

**핵심 아이디어**: 토큰 이름의 마지막 세그먼트가 weight 단어이거나 weight suffix를 포함하면 제거해 그룹 키를 추출한다.

```typescript
// weight 단어 전체인 경우 (Untitled UI 패턴: "Display 2xl/Regular")
const PURE_WEIGHT_REGEX =
  /^(regular|medium|semibold|semi[-\s]?bold|bold|light|black|heavy|thin|extra[-\s]?bold|extra[-\s]?light|demi|book)$/i;

// weight suffix로 끝나는 경우 (ISD 패턴: "LG (Default)/body1 medium")
const WEIGHT_SUFFIX_REGEX =
  /\s+(regular|medium|semibold|semi[-\s]?bold|bold|light|black|heavy|thin|strong|stronger|emphasis)$/i;

function groupKey(tokenName: string): string {
  const lastSlash = tokenName.lastIndexOf('/');
  const parent = lastSlash >= 0 ? tokenName.slice(0, lastSlash) : '';
  const lastSeg = lastSlash >= 0 ? tokenName.slice(lastSlash + 1) : tokenName;

  // 마지막 세그먼트가 순수 weight 단어 → parent가 그룹
  if (PURE_WEIGHT_REGEX.test(lastSeg.trim())) return parent;

  // 마지막 세그먼트에 weight suffix 존재 → suffix 제거한 base가 그룹
  const base = lastSeg.replace(WEIGHT_SUFFIX_REGEX, '').trim();
  if (base !== lastSeg) return parent ? `${parent}/${base}` : base;

  // 그 외: 토큰 이름 자체가 그룹 (단독 스타일, e.g. "SM/H3")
  return tokenName;
}
```

**검증 케이스:**

| 토큰 이름 | groupKey 결과 | 이유 |
|-----------|--------------|------|
| `Display 2xl/Regular` | `Display 2xl` | "Regular" = 순수 weight |
| `Display 2xl/Bold` | `Display 2xl` | "Bold" = 순수 weight |
| `LG (Default)/body1` | `LG (Default)/body1` | weight 아님 → 이름 자체가 그룹 |
| `LG (Default)/body1 medium` | `LG (Default)/body1` | " medium" suffix 제거 |
| `LG (Default)/Body2 Strong` | `LG (Default)/Body2` | " Strong" suffix 제거 |
| `SM/H3` | `SM/H3` | "H3" = weight 아님, suffix 없음 → 독립 그룹 |
| `SM/H4` | `SM/H4` | "H4" = 독립 그룹 (H3과 fontSize 같아도 분리) |
| `h1` (슬래시 없음) | `h1` | 플랫 이름 → 이름 자체가 그룹 |

```typescript
function buildScaleMap(tokens: TokenRow[]): ScaleEntry[] {
  // 복합 JSON 토큰만 처리 (fontFamily + fontSize 있는 것)
  const compositeTokens = tokens.filter(t => {
    try {
      const v = JSON.parse(t.value) as Record<string, unknown>;
      return typeof v.fontFamily === 'string' && typeof v.fontSize === 'number';
    } catch { return false; }
  });

  // groupKey → VariantEntry[] 맵 (insertion order = 원본 파일 순서 유지)
  const byGroup = new Map<string, VariantEntry[]>();

  for (const token of compositeTokens) {
    const cv = JSON.parse(token.value) as CompositeValue;
    const key = groupKey(token.name);
    const parts = token.name.split('/');
    const entry: VariantEntry = {
      tokenName: token.name,
      label: parts[parts.length - 1],
      fontFamily: cv.fontFamily,
      fontSize: cv.fontSize,
      fontWeight: typeof cv.fontWeight === 'number' ? cv.fontWeight : 400,
      lineHeight: parseLineHeightPx(cv.lineHeight),
      letterSpacing: typeof cv.letterSpacing === 'string' && cv.letterSpacing !== '0'
        ? cv.letterSpacing : null,
    };
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(entry);
  }

  // insertion order 유지 (원본 토큰 파일 순서 반영)
  return [...byGroup.entries()].map(([key, variants]) => {
    variants.sort((a, b) => a.fontWeight - b.fontWeight);
    return {
      label: key,
      nameSlug: key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      fontSize: variants[0].fontSize,
      variants,
    };
  });
}
```

### 2.3.1 섹션 헤더 (ISD 다중 모드 자동 감지)

ISD처럼 첫 path segment가 여러 그룹을 포함하는 구조에서는 섹션 헤더를 표시한다.

```typescript
// 첫 번째 path segment별 그룹 수 계산
const firstSegCount = new Map<string, number>();
for (const entry of scaleEntries) {
  const firstSeg = entry.label.split('/')[0];
  firstSegCount.set(firstSeg, (firstSegCount.get(firstSeg) ?? 0) + 1);
}

// 해당 segment에 그룹 2개 이상 → 섹션 헤더 표시
const showSectionHeader = (entry: ScaleEntry) =>
  (firstSegCount.get(entry.label.split('/')[0]) ?? 0) > 1;
```

**렌더 예시:**

| 구조 | 섹션 헤더 표시 여부 |
|------|-------------------|
| Untitled UI: `Display 2xl`, `Text xl`, ... | ❌ 없음 (각 그룹이 독립적) |
| ISD: `LG (Default)/h1`, `LG (Default)/h2`, ... | ✅ "LG (Default)" 헤더 → 아래 h1, h2, ... 그룹 |

**엣지 케이스:**

| 상황 | 처리 방법 |
|------|-----------|
| 순수 weight 단어만인 variant | 대표 표시명 = parent 경로; 단독 variant면 label = 마지막 세그먼트 |
| 플랫 이름 (슬래시 없음, e.g. `h1`) | variants 1개 → 단독 행 렌더 |
| variants 0개 | 발생 불가 (byGroup 맵 구조상) |
| 토큰 1개만 존재 | scale 1행, variant 1열 → 정상 렌더 |

### 2.4 CSS 변수명 생성 — `toCssVar` 교체

**현재 문제**: `TypographyList.tsx:49-72`의 `toCssVar()` 함수는 `css-generator.ts`의 `toVarName`을 수동으로 복제한 것이다. 두 구현이 이미 미세하게 다르다.

**해결**: `toCssVar` 함수 전체 삭제 → `toVarName` import.

```typescript
// 변경 전
import type { TokenRow } from '@/lib/actions/tokens';

function toCssVar(tokenName: string): string { ... } // 70줄 수동 복제

// 변경 후
import type { TokenRow } from '@/lib/actions/tokens';
import { toVarName, TYPE_PREFIX } from '@/lib/tokens/css-generator';

// 사용처:
const cssVar = toVarName(token.name, TYPE_PREFIX['typography']); // → 'font'
```

**복합 토큰의 shorthand CSS var 참조:**

```typescript
// 변경 전 — 하드코딩
const fontVar = `--font-${sizeKey}-${w.key}`;

// 변경 후 — 실제 token.name 기반
const fontVar = toVarName(variant.tokenName, 'font');
// e.g. "Display 2xl/Regular" → "--font-display-2xl-regular"
// e.g. "LG (Default)/h1"    → "--font-lg-default-h1"
```

### 2.5 Typeface Specimen 렌더링

**fontFamily 추출**: 화이트리스트 키(`display-2xl`, `text-md`) 대신 모든 복합 토큰에서 고유 fontFamily 수집.

```typescript
const fontFamilies = [...new Set(
  scaleEntries.flatMap(e => e.variants.map(v => v.fontFamily))
)];
```

### 2.6 타입 스케일 행 렌더링

각 ScaleEntry → 1개 섹션, 그 아래 variants 행.

**CSS var 참조 + inline fallback 이중 전략:**

```typescript
// CSS 파일이 아직 생성되지 않았을 때도 렌더링 가능하도록
// 1순위: CSS var (tokens.css가 로드된 경우 동작)
// 2순위: inline style (항상 동작)
<p
  style={{
    fontFamily: variant.fontFamily,           // fallback
    fontSize: `${variant.fontSize / 16}rem`,  // fallback
    fontWeight: variant.fontWeight,            // fallback
    lineHeight: variant.lineHeight ? `${variant.lineHeight / 16}rem` : 'normal', // fallback
    // CSS var로 덮어쓰기 (지원 환경에서는 CSS var가 우선)
    // @ts-expect-error CSS custom property
    '--_font-var': `var(${fontVar}, initial)`,
  }}
>
```

실제로는 `font: var(${fontVar})` 단축속성으로 적용하되, `var(${fontVar})` 안에 fallback을 인라인 빌드하는 방식:

```typescript
const fallbackFont = [
  variant.fontWeight,
  `${variant.fontSize / 16}rem`,
  '/',
  variant.lineHeight ? `${variant.lineHeight / 16}rem` : 'normal',
  `'${variant.fontFamily}'`,
].join(' ');

// style={{ font: `var(${fontVar}, ${fallbackFont})` }}
// CSS var가 없으면 fallback font 값 사용
```

### 2.7 Token Reference 테이블 — 원시 토큰 파싱

`parsePrimitiveTokens`는 현재 `toCssVar`를 사용한다. `toVarName` import로 교체하면 동일하게 동작.

원시 토큰 분류 로직(`lower.includes('font')` 등)은 유지.

---

## 3. css-generator.ts 변경

### 3.1 familySlug 결정 로직 (line 473)

**현재 코드:**
```typescript
const familySlug = sizeSlug.startsWith('display') ? 'display' : 'body';
```

**문제**: `LG (Default)` 같은 그룹명에서 `display` prefix가 없으면 항상 `'body'`로 fallback.

**변경:**
```typescript
// parsed.category 필드 우선 사용
// parse-variables.ts가 styles.headings → category='display', styles.textStyles → category='body' 로 저장
// payload.typography.textStyles는 명시적 category 필드 포함
const familySlug = parsed.category === 'display'
  ? 'display'
  : parsed.category === 'body'
    ? 'body'
    : sizeSlug.startsWith('display')  // fallback (구버전 category 없는 DB 데이터)
      ? 'display'
      : 'body';
```

**주의**: `parse-variables.ts`의 구버전 폴백 경로(styles.headings/textStyles → JSON 생성)에는 `category` 필드가 없다. fallback 로직 유지 필수.

---

## 4. page.tsx 변경

```typescript
// 삭제 대상 (line 92-93):
{(type === 'text-style' || type === 'heading') && <TypographyList tokens={tokenRows} />}
```

`text-style`/`heading` 타입 토큰은 이제 모두 `typography`로 저장되므로 이 분기는 데드코드.

---

## 5. 구현 순서

```
Step 1. css-generator.ts — familySlug 로직 수정 (5줄)
        테스트: TypographyList 이전에 CSS var 생성 확인

Step 2. TypographyList.tsx — toCssVar 제거 + toVarName import

Step 3. TypographyList.tsx — buildScaleMap 구현 + parsePrimitiveTokens 연동
        기존 parseScaleTokens / parseName 제거

Step 4. TypographyList.tsx — 렌더링 교체 (Specimen, TypeScale, TokenRef)

Step 5. page.tsx — text-style/heading 분기 삭제

Step 6. npm run build + 린트 통과 확인
```

---

## 6. 인터페이스 변경 요약

### 제거되는 내부 타입/함수

| 항목 | 이유 |
|------|------|
| `SIZE_ORDER` 상수 | 하드코딩 화이트리스트 금지 |
| `WEIGHT_ORDER` 상수 | JSON fontWeight 필드로 대체 |
| `SizeKey` 타입 | SIZE_ORDER 기반 |
| `WeightKey` 타입 | WEIGHT_ORDER 기반 |
| `parseName()` | 이름 패턴 의존 파서 |
| `parseScaleTokens()` | SIZE_ORDER/WEIGHT_ORDER 사용 |
| `toCssVar()` | toVarName 중복 구현 |
| `formatScaleLabel()` | SIZE_ORDER 기반 포매터 |

### 추가되는 내부 타입/함수

| 항목 | 설명 |
|------|------|
| `ScaleEntry` 타입 | 이름 기반 그룹 키 스케일 엔트리 (`label`, `fontSize`, `variants`) |
| `VariantEntry` 타입 | fontWeight/name 기반 변형 |
| `groupKey()` | 토큰 이름 → 그룹 키 추출 (weight 단어/suffix 제거) |
| `buildScaleMap()` | 범용 스케일 맵 빌더 (groupKey 기반) |
| `toVarName` import | css-generator.ts에서 import |

### 변경되지 않는 항목

| 항목 | 이유 |
|------|------|
| 외부 prop `{ tokens: TokenRow[] }` | 이미 단일 prop |
| `TokenRefTable` 서브 컴포넌트 구조 | 유지 (파서만 교체) |
| `parsePrimitiveTokens()` 분류 로직 | `lower.includes(...)` 패턴 유지, `toCssVar`만 교체 |
| SCSS 모듈 클래스명 | 렌더링 구조 동일 유지 목표 |

---

## 7. 테스트 기준

| 시나리오 | 기대 결과 |
|----------|-----------|
| Untitled UI 토큰 (`Display 2xl/Regular` 등 44개) | 기존과 동일 렌더 |
| 비표준 명칭 토큰 (`LG (Default)/h1` 등) | 빈 화면 없이 렌더 |
| 플랫 이름 토큰 (`h1`, `body-large`) | 1열 row로 렌더 |
| 토큰 0개 | `null` 반환 (기존 동일) |
| Token Reference 원시 토큰 없음 | 섹션 자체 미표시 |
| CSS 파일 미로드 | inline fallback으로 specimen 텍스트 렌더 |

---

## 8. 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| weight 단어 목록 외의 weight 표현 (e.g. 숫자 `700`, 언어권 특수 단어) | groupKey가 그룹 키로 처리 → 단독 행 렌더 | 허용 가능: 단독 행으로 표시되더라도 빈 화면보다 낫다. PURE_WEIGHT_REGEX에 패턴 추가로 확장 가능 |
| `toVarName` import 시 순환 의존 | 빌드 실패 | `TypographyList.tsx`는 클라이언트, `css-generator.ts`는 공유 라이브러리 — 순환 없음 |
| 기존 SCSS 클래스명이 sizeKey/weightKey 기반일 경우 | 스타일 깨짐 | token-views.module.scss 는 클래스명이 레이아웃 기반 (typoScaleRow 등), 이름 의존 없음 |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-04-15 | Initial design — 범용 재설계 집중 |
| 0.2 | 2026-04-15 | 2.3 buildScaleMap 알고리즘 교체: fontSize 기반 → groupKey() 이름 기반. ISD SM/H3·H4 (동일 fontSize·weight) 충돌 케이스 검증 후 수정. 섹션 헤더 로직(2.3.1) 추가. |
