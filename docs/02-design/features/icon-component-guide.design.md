# Design: 아이콘 컴포넌트 가이드 (v3 — SVG 구조 자동 감지 생성)

_JSON 임포트 → SVG 구조 감지 → 전략별 TSX 생성 → `/icons/[name]` 상세 가이드_

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | variants 배열이 다양한 형태(1개/3개)로 들어오고, SVG 구조가 같은 경우(색상만 다름)와 다른 경우(모양 자체가 다름)를 구분 없이 처리해 의미없는 컴포넌트 API 생성 |
| **Solution** | SVG 구조 시그니처를 자동 추출해 "모양 동일 여부"를 판별. 모양이 같으면 props로 처리, 모양이 다르면 별도 컴포넌트 이름으로 생성 |
| **Function/UX Effect** | `<IconFeaturedIconLight size="md" color="brand" />`, `<IconFileTypeAEPDefault />` 처럼 Figma 설계 의도를 그대로 반영한 의미있는 API |
| **Core Value** | 플러그인 데이터 포맷에 관계없이 생성기가 자동으로 최적 컴포넌트 구조를 결정 |

---

## Overview

| 항목 | 내용 |
|------|------|
| Feature | icon-component-guide |
| Plan | `docs/01-plan/features/icon-component-guide.plan.md` |
| Updated | 2026-04-17 (v3 — SVG 구조 자동 감지) |

---

## 1. 핵심 원칙

```
색상 · 사이즈만 다름  →  props로 처리  →  1개 컴포넌트
모양 자체가 다름      →  다른 이름      →  별개 컴포넌트
```

---

## 2. SVG 구조 시그니처 감지

### 2-1. `structureSignature(svg)` 함수

SVG 내 태그 순서와 특수 속성(mask/filter/clip) 유무만 추출. 색상·좌표·크기 제외.

```ts
function structureSignature(svg: string): string {
  const tags = [...svg.matchAll(/<(\w+)([^>]*)>/g)]
    .map(([, tag, attrs]) => {
      const hasMask   = /\bmask=/.test(attrs)   ? '[mask]'   : '';
      const hasFilter = /\bfilter=/.test(attrs) ? '[filter]' : '';
      const hasClip   = /\bclip-path=/.test(attrs) ? '[clip]' : '';
      return tag + hasMask + hasFilter + hasClip;
    })
    .filter(t => t !== 'svg');
  return tags.join('>');
}
```

**예시**

| 아이콘 | 시그니처 |
|--------|---------|
| FileTypeAEP type-default | `path>path>rect>path` |
| FileTypeAEP type-gray | `mask>path>g[mask]>path>path>path>defs>linearGradient>stop>stop` |
| FileTypeAEP type-solid | `path>path>path` |
| FeaturedIcon type-light color-brand | `path>g[clip]>path>defs>clipPath>rect` |
| FeaturedIcon type-light color-error | `path>g[clip]>path>defs>clipPath>rect` ← 동일! |

---

## 3. 생성 전략 (3가지)

### 전략 판별 흐름

```
pascal 그룹 형성
  └─ 그룹 내 구조 시그니처 비교
       ├─ 시그니처 종류 = 1개
       │    ├─ 아이콘 1개          → Strategy A: 단일 컴포넌트
       │    └─ 아이콘 2개 이상     → Strategy C: 멀티-prop 컴포넌트
       └─ 시그니처 종류 2개 이상   → Strategy B: 구조별 분리 컴포넌트
```

---

### Strategy A — 단일 컴포넌트

**조건**: pascal 그룹 내 아이콘이 1개 (또는 variants 없음)

```tsx
// IconSomething.tsx
export const IconSomething = ({ color, className, ...props }) => (
  <svg ...>{/* 단일 SVG */}</svg>
);
```

---

### Strategy B — 구조별 분리 컴포넌트

**조건**: 같은 pascal 내 SVG 구조가 2가지 이상 → 모양이 다름

컴포넌트명 = `pascal` + 구조를 대표하는 variant key (PascalCase)

```
FileTypeDesignAEPAfterEffects 그룹:
  type-default → 구조 A (outline)  → IconFileTypeDesignAEPAfterEffectsDefault
  type-gray    → 구조 B (gradient) → IconFileTypeDesignAEPAfterEffectsGray
  type-solid   → 구조 C (filled)   → IconFileTypeDesignAEPAfterEffectsSolid
```

```tsx
// IconFileTypeDesignAEPAfterEffectsDefault.tsx
export const IconFileTypeDesignAEPAfterEffectsDefault = ({ color, className, ...props }) => (
  <svg ...>{/* default 구조 SVG */}</svg>
);

// IconFileTypeDesignAEPAfterEffectsGray.tsx  (useId 필요)
export const IconFileTypeDesignAEPAfterEffectsGray = ({ color, className, ...props }) => {
  const uid = useId();
  return <svg ...>{/* gray 구조 SVG */}</svg>;
};
```

**variant key 정규화**

```ts
// "type-default" → "Default"
// "type-gray"    → "Gray"
// "size-sm"      → "Sm"
// "color-brand"  → "Brand"
function variantToPascal(v: string): string {
  return v.replace(/^(type|size|color)-/, '').replace(/(?:^|-)(\w)/g, (_, c) => c.toUpperCase());
}
```

---

### Strategy C — 멀티-prop 컴포넌트

**조건**: 같은 pascal 내 SVG 구조가 1가지 → 모양은 동일, 색상/사이즈만 다름

같은 pascal이라도 **variants 배열 중 구조를 결정하는 차원**이 있으면 해당 값으로 컴포넌트를 분리하고, 나머지 차원(color, size)은 props로 처리.

```
FeaturedIcon 그룹 (variants: ["size-*", "color-*", "type-*"]):
  구조 분석:
    type-light    → 모든 color 동일 구조 (6태그)   → IconFeaturedIconLight
    type-gradient → 모든 color 동일 구조 (13태그)  → IconFeaturedIconGradient
    type-dark     → 모든 color 동일 구조 (30태그)  → IconFeaturedIconDark
    type-modern   → 모든 color 동일 구조 (27태그)  → IconFeaturedIconModern
    type-modern-neue → 동일 구조 (34태그)         → IconFeaturedIconModernNeue

  각 컴포넌트 내부:
    size  차원 → size prop  (sm=32 / md=40 / lg=48 / xl=56)
    color 차원 → color prop (brand / gray / error / warning / success)
```

**size는 viewBox 고정 + width/height 교체로 처리 (path 재사용)**

```ts
// sm 기준 SVG를 base로 사용, width/height만 size에 따라 교체
const SIZE_MAP: Record<string, number> = { sm: 32, md: 40, lg: 48, xl: 56 };
```

**color는 fill/stroke 매핑 테이블로 처리**

```ts
// 그룹 내 color별 SVG에서 fill/stroke 고유값 추출 → 매핑 생성
// brand: { bg: "#F4EBFF", stroke: "#7F56D9" }
// gray:  { bg: "#F5F5F5", stroke: "#737373" }
const colorMap = buildColorMap(group);
```

**생성 예시**

```tsx
// IconFeaturedIconLight.tsx
import type { SVGProps } from "react";

type IconFeaturedIconLightSize  = "sm" | "md" | "lg" | "xl";
type IconFeaturedIconLightColor = "brand" | "gray" | "error" | "warning" | "success";

const SIZE_MAP: Record<IconFeaturedIconLightSize, number> = {
  sm: 32, md: 40, lg: 48, xl: 56,
};

const COLOR_MAP: Record<IconFeaturedIconLightColor, { bg: string; stroke: string }> = {
  brand:   { bg: "#F4EBFF", stroke: "#7F56D9" },
  gray:    { bg: "#F5F5F5", stroke: "#737373" },
  error:   { bg: "#FEF3F2", stroke: "#F04438" },
  warning: { bg: "#FFFAEB", stroke: "#F79009" },
  success: { bg: "#ECFDF3", stroke: "#12B76A" },
};

interface IconFeaturedIconLightProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?:  IconFeaturedIconLightSize;
  color?: IconFeaturedIconLightColor;
}

export const IconFeaturedIconLight = ({
  size = "md",
  color = "brand",
  className,
  ...props
}: IconFeaturedIconLightProps) => {
  const w = SIZE_MAP[size];
  const c = COLOR_MAP[color];
  return (
    <svg
      width={w} height={w}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={["icon-featured-icon-light", className].filter(Boolean).join(" ")}
      {...props}
    >
      {/* sm 기준 path — viewBox 스케일로 자동 대응 */}
      <path d="M0 20C0 8.954..." fill={c.bg} />
      <path d="M16.25 20..." stroke={c.stroke} strokeWidth="1.667" ... />
    </svg>
  );
};
```

---

## 4. generate.ts 수정 설계

### 4-1. 전략 판별 함수

```ts
type GenerationStrategy = 'single' | 'split' | 'multi-prop';

interface StrategyResult {
  strategy: GenerationStrategy;
  // split: 구조별 서브그룹
  subGroups?: Map<string, { variantKey: string; icons: IconInput[] }>;
  // multi-prop: 타입별 서브그룹 + 색상/사이즈 차원
  propGroups?: Map<string, {
    typeKey: string;
    baseIcon: IconInput;        // size 최소 기준 SVG
    sizeMap: Record<string, number>;
    colorMap: Record<string, { [attr: string]: string }>;
  }>;
}

function detectStrategy(group: IconInput[]): StrategyResult {
  if (group.length === 1) return { strategy: 'single' };

  // 구조 시그니처 계산
  const sigs = group.map(icon => ({
    icon,
    sig: structureSignature(icon.svg),
    variantDims: parseVariantDimensions(icon.variants ?? []),
  }));

  const uniqueSigs = new Set(sigs.map(s => s.sig));

  if (uniqueSigs.size > 1) {
    // 구조가 다름 → split
    const subGroups = new Map<string, { variantKey: string; icons: IconInput[] }>();
    for (const { icon, sig } of sigs) {
      if (!subGroups.has(sig)) {
        const variantKey = variantToPascal(icon.variants?.[0] ?? '');
        subGroups.set(sig, { variantKey, icons: [] });
      }
      subGroups.get(sig)!.icons.push(icon);
    }
    return { strategy: 'split', subGroups };
  }

  // 구조가 같음 → multi-prop 가능 여부 확인
  // variants 배열에서 차원 파악 (size-* / color-* / type-*)
  const dims = detectVariantDimensions(group);
  if (dims.typeKeys.length > 1 || dims.sizeKeys.length > 1 || dims.colorKeys.length > 1) {
    return { strategy: 'multi-prop', propGroups: buildPropGroups(group, dims) };
  }

  return { strategy: 'single' };
}
```

### 4-2. variants 차원 파싱

```ts
interface VariantDimensions {
  typeKeys:  string[];   // ["light", "dark", "gradient", ...]
  sizeKeys:  string[];   // ["sm", "md", "lg", "xl"]
  colorKeys: string[];   // ["brand", "gray", "error", ...]
}

function parseVariantDimensions(variants: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const v of variants) {
    if (v.startsWith('type-'))  result.type  = v.slice(5);
    if (v.startsWith('size-'))  result.size  = v.slice(5);
    if (v.startsWith('color-')) result.color = v.slice(6);
  }
  return result;
}
```

### 4-3. color 매핑 자동 추출

```ts
function buildColorMap(icons: IconInput[]): Record<string, Record<string, string>> {
  // 각 icon의 variants에서 color 키 추출
  // SVG에서 fill/stroke 고유값 추출 (currentColor·none·inherit 제외)
  // { brand: { "#F4EBFF": "bg", "#7F56D9": "stroke" }, gray: {...} }
}
```

### 4-4. 컴포넌트 빌더 목록

```ts
// 기존 유지
function buildSingleComponent(name, kebab, viewBox, w, h, inner, needsUid): string

// Strategy B: 구조별 분리 — 기존 buildSingleComponent 재사용 (이름만 다름)

// Strategy C: 멀티-prop 신규
function buildMultiPropComponent(
  componentName: string,
  kebabName: string,
  baseInner: string,       // sm 기준 SVG inner
  viewBox: string,
  sizeMap: Record<string, number>,
  colorMap: Record<string, Record<string, string>>,  // color → { oldHex: newExpr }
  needsUid: boolean,
): string
```

---

## 5. 파일 구조

```
src/lib/icons/
  generate.ts              ← 핵심 수정: 구조 감지 + 3전략 분기

src/generated/icons/
  // Strategy B 예시
  IconFileTypeDesignAEPAfterEffectsDefault/
  IconFileTypeDesignAEPAfterEffectsGray/
  IconFileTypeDesignAEPAfterEffectsSolid/

  // Strategy C 예시
  IconFeaturedIconLight/
  IconFeaturedIconDark/
  IconFeaturedIconGradient/
  IconFeaturedIconModern/
  IconFeaturedIconModernNeue/
```

---

## 6. 상세 페이지 prop selector UI

### 6-1. 컴포넌트 메타데이터 확장

Strategy C 컴포넌트는 `size` / `color` prop이 있으므로 상세 페이지에서 selector 필요.

```ts
interface IconEntry {
  name: string;
  svg: string;
  section?: string;
  pascal?: string;
  variants?: string[];   // Strategy B: ["default","gray","solid"] (정규화)
  sizeOptions?:  string[];  // Strategy C: ["sm","md","lg","xl"]
  colorOptions?: string[];  // Strategy C: ["brand","gray","error","warning","success"]
}
```

### 6-2. IconDetailClient prop selector

```
PropSelector (sizeOptions 또는 colorOptions 있을 때 표시)
├── Size 버튼 그룹: sm | md | lg | xl
└── Color 버튼 그룹: brand | gray | error | warning | success

선택 시 IconRenderer에 size/color prop 전달 + 스니펫 자동 반영
```

---

## 7. 구현 순서 (체크리스트)

### Step 1 — `generate.ts` 핵심 수정
- [ ] `structureSignature(svg)` 함수 구현
- [ ] `parseVariantDimensions(variants)` 함수 구현
- [ ] `detectStrategy(group)` 함수 구현
- [ ] `buildColorMap(icons)` 함수 구현 (Strategy C용)
- [ ] `buildMultiPropComponent()` 신규 구현 (Strategy C용)
- [ ] `generateIconFiles()`: 3전략 분기 로직 추가

### Step 2 — 파일 재생성 검증
- [ ] icons-node-153.json 임포트 → Strategy B 생성 확인
- [ ] icons-node-68.json 임포트 → Strategy C 생성 확인
- [ ] `IconFileTypeDesignAEPAfterEffectsDefault.tsx` 구조 확인
- [ ] `IconFeaturedIconLight.tsx` size/color prop 확인

### Step 3 — `lib/actions/icons.ts` 수정
- [ ] `getIconByComponentName`: Strategy C 컴포넌트 탐색 시 sizeOptions/colorOptions 반환

### Step 4 — `IconDetailClient.tsx` 수정
- [ ] Strategy C: size/color selector UI 추가
- [ ] IconRenderer에 size/color prop 전달
- [ ] buildSnippet에 size/color 반영

### Step 5 — 빌드 검증
- [ ] `npm run build` 타입 에러 없음

---

## 8. 검증 기준

| 항목 | 기준 |
|------|------|
| Strategy B | `<IconFileTypeDesignAEPAfterEffectsGray />` 독립 컴포넌트 생성 |
| Strategy C | `<IconFeaturedIconLight size="md" color="error" />` prop 동작 |
| 구조 자동 감지 | 새 JSON 투입 시 수동 설정 없이 전략 자동 결정 |
| size 스케일 | viewBox 고정 + width/height 교체로 path 재사용 |
| color 매핑 | 원본 hex → prop 기반 동적 값으로 자동 치환 |
| id 충돌 없음 | mask/gradient 있는 컴포넌트에 useId() 자동 적용 |
| 빌드 | `npm run build` 타입 에러 없음 |
