# node-scan-quality Design

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 노드 순회 무차별 수집 → 노이즈 70%+, 타이포/간격/반경 0개. 생성 컴포넌트에 색상값 하드코딩 |
| **Solution** | Named Styles → 섹션 스코핑 → 패턴 필터 3-Layer 추출 + Bootstrap 5 패턴 CSS 변수 Export |
| **Function UX Effect** | Community 파일에서 4종 토큰 정확 추출, `tokens.css` 한 파일 복사/다운로드로 모든 컴포넌트 적용 |
| **Core Value** | Professional/Starter 99% 사용자에게 실질적 토큰 품질 + 다크/라이트 모드 자동 지원 |

---

## 1. 시스템 구조 개요

```
[Figma API]
    │
    ├── file.styles (Named Styles 목록)   ──→ StyleMap
    ├── file.document (노드 트리)          ──→ FigmaNode (확장)
    │
    └── extractTokensAction()
            │
            ├─ Variables API (Enterprise) → 기존 경로
            │
            └─ Node Scan v2 (개선)
                 │
                 ├─ Layer 1: extractByNamedStyles(node, styleMap)
                 ├─ Layer 2: extractBySectionScope(node)
                 └─ Layer 3: extractByPatternFilter(node)
                      │
                      └─ ExtractedTokens
                           │
                           ├─ SQLite 저장 (기존 스키마)
                           │     source: 'styles-api' | 'section-scan' | 'node-scan'
                           │
                           └─ css-exporter.ts
                                │
                                └─ tokens.css (CSS 변수 문자열)
```

---

## 2. 타입 확장 설계

### 2.1 `src/lib/figma/api.ts` — FigmaNode 확장

현재 `FigmaNode`에 누락된 필드를 추가한다.

```ts
interface FigmaNode {
  // 기존 필드 유지
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  fills?: FigmaPaint[];
  style?: FigmaTypeStyle;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  boundVariables?: {
    fills?: Array<{ type: 'VARIABLE_ALIAS'; id: string }>;
  };

  // ── 신규 추가 ──
  /** Named Style ID (fills) — "S:abc123" 형식 */
  fillStyleId?: string;
  /** Named Style ID (text) — "S:def456" 형식 */
  textStyleId?: string;
  /** Auto Layout 방향 (NONE | HORIZONTAL | VERTICAL) */
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  /** 노드 경계 박스 — 원형 판별용 */
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
}
```

### 2.2 `StyleMap` 타입

`project.ts`에서 `api.ts`의 `FigmaFileResponse.styles`를 extractor에 전달하기 위한 타입.

```ts
// src/lib/tokens/extractor.ts (상단 export)
export interface StyleInfo {
  name: string;          // "Primary/500"
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
}

/**
 * Figma node style ID → StyleInfo 매핑
 * key: "S:abc123" (Figma fillStyleId / textStyleId 값)
 */
export type StyleMap = Record<string, StyleInfo>;
```

### 2.3 `ExtractResult` source 타입 확장

`tokens.ts`의 `TokenRow.source`와 `project.ts`의 내부 타입을 3-Layer에 맞게 확장.

```ts
// src/lib/actions/tokens.ts
export interface TokenRow {
  // ...
  source: 'variables' | 'styles-api' | 'section-scan' | 'node-scan' | null;
}

// src/lib/actions/project.ts
type ExtSource = 'variables' | 'styles-api' | 'section-scan' | 'node-scan';
```

---

## 3. 3-Layer 추출 설계

### 3.1 진입점 — `extractTokens()` 시그니처 변경

```ts
// 기존
export function extractTokens(rootNode: FigmaNode): ExtractedTokens

// 신규: styleMap 추가, ExtractResult에 source 포함
export interface ExtractResult {
  tokens: ExtractedTokens;
  source: 'styles-api' | 'section-scan' | 'node-scan';
}

export function extractTokens(
  rootNode: FigmaNode,
  styleMap?: StyleMap,
): ExtractResult
```

내부 우선순위:
```ts
if (styleMap && hasNamedStyles(rootNode, styleMap)) {
  return { tokens: extractByNamedStyles(rootNode, styleMap), source: 'styles-api' };
}
const sectioned = extractBySectionScope(rootNode);
if (sectioned.hasData) {
  return { tokens: sectioned.tokens, source: 'section-scan' };
}
return { tokens: extractByPatternFilter(rootNode), source: 'node-scan' };
```

---

### 3.2 Layer 1: Named Styles 추출

**목표:** `node.fillStyleId` / `node.textStyleId`가 `styleMap`에 존재하면 해당 노드만 추출.

```ts
function hasNamedStyles(node: FigmaNode, styleMap: StyleMap): boolean {
  if (node.fillStyleId && styleMap[node.fillStyleId]) return true;
  if (node.textStyleId && styleMap[node.textStyleId]) return true;
  return (node.children ?? []).some((c) => hasNamedStyles(c, styleMap));
}

function extractByNamedStyles(
  node: FigmaNode,
  styleMap: StyleMap,
): ExtractedTokens {
  const colors: ColorToken[] = [];
  const typography: TypographyToken[] = [];
  // spacing, radius는 Layer 1에서 추출하지 않음
  // (Named Styles에 spacing/radius 타입 없음)

  function traverse(n: FigmaNode) {
    if (n.fillStyleId) {
      const info = styleMap[n.fillStyleId];
      if (info?.styleType === 'FILL' && n.fills) {
        for (const fill of n.fills) {
          if (fill.type === 'SOLID' && fill.color) {
            colors.push({
              name: normalizeStyleName(info.name), // "Primary/500" → "Primary/500"
              hex: figmaColorToHex(fill.color),
              rgba: figmaColorToRgba(fill.color),
            });
          }
        }
      }
    }
    if (n.textStyleId) {
      const info = styleMap[n.textStyleId];
      if (info?.styleType === 'TEXT' && n.type === 'TEXT' && n.style) {
        typography.push({
          name: normalizeStyleName(info.name),
          fontFamily: n.style.fontFamily,
          fontSize: n.style.fontSize,
          fontWeight: n.style.fontWeight,
          lineHeight: n.style.lineHeightPx,
          letterSpacing: n.style.letterSpacing,
        });
      }
    }
    (n.children ?? []).forEach(traverse);
  }

  traverse(node);

  return {
    colors: deduplicateByKey(colors, (c) => c.hex),
    typography: deduplicateByKey(typography, (t) => `${t.fontFamily}-${t.fontSize}-${t.fontWeight}`),
    spacing: [],
    radius: [],
  };
}
```

**`normalizeStyleName(name: string): string`**

| 입력 | 출력 |
|------|------|
| `"Primary/500"` | `"Primary/500"` (그대로) |
| `"Text Style/Heading XL"` | `"Heading XL"` (마지막 세그먼트) |
| `"Colors/Brand/Blue 500"` | `"Brand/Blue 500"` (최상위 카테고리 제거) |

규칙: `"Colors/"`, `"Text Style/"`, `"Typography/"` 등 최상위 카테고리 프리픽스가 타입명이면 제거.

---

### 3.3 Layer 2: 섹션 기반 스코핑

**목표:** 페이지 직계 자식 중 패턴에 매칭되는 FRAME/SECTION의 **직계 자식만** 스캔.

```ts
const SECTION_PATTERNS: Record<keyof ExtractedTokens, RegExp> = {
  colors:     /^(colors?|colours?|palette|색상|팔레트|fill)/i,
  typography: /^(typ(e|o|ography)?|font|text.?style|텍스트|타이포|글자)/i,
  spacing:    /^(spacing|space|gap|간격|여백|padding)/i,
  radius:     /^(radius|corner|rounded|반경|모서리|round)/i,
};

interface SectionResult {
  hasData: boolean;
  tokens: ExtractedTokens;
}

function extractBySectionScope(rootNode: FigmaNode): SectionResult {
  const result: ExtractedTokens = { colors: [], typography: [], spacing: [], radius: [] };
  let found = false;

  const topLevel = rootNode.type === 'DOCUMENT'
    ? (rootNode.children ?? []).flatMap((page) => page.children ?? [])
    : (rootNode.children ?? []);

  for (const section of topLevel) {
    for (const [tokenType, pattern] of Object.entries(SECTION_PATTERNS) as [keyof ExtractedTokens, RegExp][]) {
      if (pattern.test(section.name)) {
        found = true;
        // 직계 자식 depth=1 스캔 (섹션 내부만)
        for (const child of section.children ?? []) {
          extractSingleNode(child, tokenType, result);
        }
      }
    }
  }

  return { hasData: found, tokens: deduplicateAll(result) };
}
```

`extractSingleNode(node, tokenType, result)` — depth=1 추출로 섹션 외부 오염 방지.

---

### 3.4 Layer 3: 패턴 필터 (개선)

기존 무차별 순회에서 **노이즈 필터**를 추가한다.

#### 색상 필터 추가

```ts
// 기존 조건에 추가:
const NOISE_NAMES = /^(rectangle \d+|ellipse \d+|vector \d+|icon|arrow|chevron|close|check|menu)/i;

// RECTANGLE, ELLIPSE 타입만 허용 (TEXT 아이콘 제외)
// 자동생성 이름 제거
if (NOISE_NAMES.test(node.name)) return;
if (!['RECTANGLE', 'ELLIPSE', 'VECTOR', 'COMPONENT', 'INSTANCE'].includes(node.type)) {
  // FRAME도 배경색으로 포함 가능하지만 최소화
}
```

#### 타이포그래피 필터 추가

```ts
// fontSize 범위: 10~96px
// 자동생성 TEXT 이름 제거: "Text 123", "Label", "Placeholder"
const VALID_FONT_SIZE = (size: number) => size >= 10 && size <= 96;
const NOISE_TEXT = /^(text \d+|label \d+|placeholder|hint)/i;
```

#### 간격 필터 추가

```ts
// layoutMode가 HORIZONTAL 또는 VERTICAL인 FRAME만
// 균일 padding (top === bottom AND left === right) 또는 균일 gap만
const isUniformPadding = (n: FigmaNode) =>
  n.paddingTop === n.paddingBottom && n.paddingLeft === n.paddingRight;
const hasLayoutMode = (n: FigmaNode) =>
  n.layoutMode === 'HORIZONTAL' || n.layoutMode === 'VERTICAL';
```

#### 반경 필터 추가

```ts
// 원 제외: cornerRadius >= min(width, height) / 2
// 범위: 0 < value <= 100
// 자동생성 이름 제거
const isCircle = (n: FigmaNode): boolean => {
  const box = n.absoluteBoundingBox;
  if (!box) return false;
  const minDim = Math.min(box.width, box.height);
  return (n.cornerRadius ?? 0) >= minDim / 2;
};
```

---

## 4. CSS Exporter 모듈 설계

### 4.1 파일: `src/lib/tokens/css-exporter.ts`

```ts
// 공개 인터페이스
export interface CssExportOptions {
  fileName?: string;
  extractedAt?: string;
  method?: 'styles-api' | 'section-scan' | 'node-scan';
}

export interface TokensByMode {
  light: TokenRow[];
  dark: TokenRow[];
  single: TokenRow[];  // mode 없는 토큰
}

/**
 * TokenRow[] → tokens.css 문자열 생성
 * Bootstrap 5 패턴: HEX + RGB + text-emphasis + bg-subtle + border-subtle
 */
export function generateTokensCss(
  tokens: TokenRow[],
  options?: CssExportOptions,
): string
```

### 4.2 네이밍 변환 함수

```ts
/**
 * Figma 토큰 이름 → CSS 변수명
 *
 * 규칙:
 * - 슬래시(/) → 하이픈(-)
 * - 대문자 → 소문자
 * - 공백 → 하이픈
 * - 특수문자 제거
 *
 * 예시:
 *   "Primary/500"      → "--pf-color-primary-500"
 *   "Gray/900"         → "--pf-color-gray-900"
 *   "Heading/XL"       → "--pf-font-size-heading-xl"
 *   "spacing/4"        → "--pf-spacing-4"
 *   "radius/sm"        → "--pf-radius-sm"
 */
function toCssVarName(tokenType: string, name: string): string {
  const prefix = TYPE_PREFIX[tokenType]; // color, font-size, spacing, radius
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[/\\]/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return `--pf-${prefix}-${slug}`;
}

const TYPE_PREFIX: Record<string, string> = {
  color:      'color',
  typography: 'font',
  spacing:    'spacing',
  radius:     'radius',
};
```

### 4.3 색상 처리 — Bootstrap 5 5-Variable 패턴

```ts
function generateColorVars(name: string, hex: string, r: number, g: number, b: number): string[] {
  const base = toCssVarName('color', name);
  // shade/tint 계산 (명도 조작)
  const textEmphasis = darkenHex(hex, 0.3);   // 30% 어둡게 (AA 보장)
  return [
    `  ${base}:                  ${hex};`,
    `  ${base}-rgb:              ${r}, ${g}, ${b};`,
    `  ${base}-text:             ${textEmphasis};`,
    `  ${base}-bg-subtle:        rgba(${r}, ${g}, ${b}, 0.08);`,
    `  ${base}-border-subtle:    rgba(${r}, ${g}, ${b}, 0.2);`,
  ];
}
```

### 4.4 타이포그래피 처리

```ts
function generateTypoVars(name: string, value: TypographyValue): string[] {
  const slug = toCssSlug(name);
  return [
    `  --pf-font-family-${slug}:       '${value.fontFamily}', system-ui, sans-serif;`,
    `  --pf-font-size-${slug}:         ${value.fontSize}px;`,
    `  --pf-font-weight-${slug}:       ${value.fontWeight};`,
    ...(value.lineHeight ? [`  --pf-line-height-${slug}:        ${(value.lineHeight / value.fontSize).toFixed(2)};`] : []),
    ...(value.letterSpacing ? [`  --pf-letter-spacing-${slug}:   ${value.letterSpacing}px;`] : []),
  ];
}
```

### 4.5 생성 출력 전체 구조

```css
/* === PixelForge Design Tokens ===
 * Source: My Design System
 * Extracted: 2025-01-15T10:30:00.000Z
 * Method: styles-api
 *
 * Usage:
 *   background: var(--pf-color-primary);
 *   background: rgba(var(--pf-color-primary-rgb), 0.1);
 *   font-size: var(--pf-font-size-heading-xl);
 */

:root {
  /* ── Colors ── */
  --pf-color-primary:                 #3b82f6;
  --pf-color-primary-rgb:             59, 130, 246;
  --pf-color-primary-text:            #1d4ed8;
  --pf-color-primary-bg-subtle:       rgba(59, 130, 246, 0.08);
  --pf-color-primary-border-subtle:   rgba(59, 130, 246, 0.2);

  /* ── Typography ── */
  --pf-font-family-base:              'Pretendard', system-ui, sans-serif;
  --pf-font-size-heading-xl:          48px;
  --pf-font-weight-heading-xl:        700;
  --pf-line-height-heading-xl:        1.20;

  /* ── Spacing ── */
  --pf-spacing-4:                     16px;
  --pf-spacing-8:                     32px;

  /* ── Border Radius ── */
  --pf-radius-sm:                     4px;
  --pf-radius-md:                     8px;
  --pf-radius-lg:                     16px;
}

/* Dark mode — Figma Light/Dark 모드 분기 시 자동 생성 */
[data-theme="dark"] {
  --pf-color-primary:                 #60a5fa;
  --pf-color-primary-rgb:             96, 165, 250;
  --pf-color-primary-text:            #bfdbfe;
  --pf-color-primary-bg-subtle:       rgba(96, 165, 250, 0.08);
  --pf-color-primary-border-subtle:   rgba(96, 165, 250, 0.2);
}
```

---

## 5. globals.scss `-rgb` 버그 수정 설계

### 5.1 현재 상태 확인

`globals.scss`에 다음 변수들이 **없음** (토큰 뷰어가 hardcoded fallback으로 버팀):

```scss
// token-views.module.scss 에서 발견된 workaround:
rgba(var(--accent-rgb, 99, 102, 241), 0.1)
//                   ↑ 폴백값 — 실제 변수 없음
```

### 5.2 수정 내용

```scss
// globals.scss 수정 — 두 테마 블록에 각각 추가

:root[data-theme="dark"] {
  // 기존 변수들 유지...

  // ── 신규 추가: -rgb 채널 변수 ──
  --accent-rgb:   59, 130, 246;     /* $blue-500 = #3b82f6 */
  --danger-rgb:   248, 113, 113;    /* $danger dark = #f87171 */
  --warning-rgb:  251, 191, 36;     /* $warning dark = #fbbf24 */
  --success-rgb:  52, 211, 153;     /* $success dark = #34d399 */
  --info-rgb:     96, 165, 250;     /* $blue-400 = #60a5fa */
}

:root[data-theme="light"] {
  // 기존 변수들 유지...

  // ── 신규 추가: -rgb 채널 변수 ──
  --accent-rgb:   37, 99, 235;      /* $blue-600 = #2563eb */
  --danger-rgb:   220, 38, 38;      /* #dc2626 */
  --warning-rgb:  217, 119, 6;      /* #d97706 */
  --success-rgb:  5, 150, 105;      /* #059669 */
  --info-rgb:     37, 99, 235;      /* $blue-600 */
}
```

### 5.3 workaround 제거 범위

`globals.scss` 수정 후 아래 파일에서 hardcoded fallback 제거:

| 파일 | 변경 전 | 변경 후 |
|------|--------|--------|
| `token-views.module.scss` | `rgba(var(--accent-rgb, 99, 102, 241), 0.1)` | `rgba(var(--accent-rgb), 0.1)` |
| 기타 SCSS 모듈 | `rgba(var(--danger-rgb, 248, 113, 113), ...)` | `rgba(var(--danger-rgb), ...)` |

---

## 6. project.ts 연동 설계

### 6.1 `extractTokensAction()` 변경 포인트

```ts
// 변경 전
const file = await client.getFile(fileKey);
const extracted = extractFromNode(file.document);

// 변경 후
const file = await client.getFile(fileKey);
const styleMap: StyleMap = buildStyleMap(file.styles);  // 신규
const { tokens: extracted, source } = extractFromNode(file.document, styleMap);  // 반환값 변경

// source: 'styles-api' | 'section-scan' | 'node-scan'
```

### 6.2 `buildStyleMap()` 유틸리티

```ts
// project.ts 내부 함수
function buildStyleMap(
  styles: Record<string, { name: string; styleType: string }>
): StyleMap {
  const map: StyleMap = {};
  for (const [id, style] of Object.entries(styles)) {
    map[id] = {
      name: style.name,
      styleType: style.styleType as StyleInfo['styleType'],
    };
  }
  return map;
}
```

---

## 7. CSS Export 액션 설계

### 7.1 `src/lib/actions/tokens.ts` 추가 액션

```ts
export interface CssExportResult {
  error: string | null;
  css: string | null;
  tokenCount: number;
}

/**
 * 현재 프로젝트의 모든 토큰을 tokens.css 형식으로 내보냄
 */
export async function exportTokensCssAction(): Promise<CssExportResult> {
  // 1. 전체 토큰 조회 (4가지 타입 모두)
  const allTokens = db.select().from(tokens).all();

  if (allTokens.length === 0) {
    return { error: '내보낼 토큰이 없습니다.', css: null, tokenCount: 0 };
  }

  // 2. 프로젝트 메타 조회 (헤더 주석용)
  const project = db.select().from(projects).limit(1).get();

  // 3. CSS 생성
  const css = generateTokensCss(allTokens, {
    fileName: project?.name ?? 'Design Tokens',
    extractedAt: new Date().toISOString(),
  });

  return { error: null, css, tokenCount: allTokens.length };
}
```

---

## 8. TokenPageActions.tsx UI 설계

### 8.1 위치

토큰 목록 페이지 헤더에 기존 "전체 삭제" 버튼 옆에 "CSS 내보내기" 버튼 추가.

```
[ CSS 내보내기 ]  [ 전체 삭제 ]
```

### 8.2 컴포넌트 로직

```ts
'use client';

export default function TokenPageActions({ type }: { type: TokenType }) {
  const [exporting, setExporting] = useState(false);
  const [exportMode, setExportMode] = useState<'copy' | 'download' | null>(null);

  const handleExport = async (mode: 'copy' | 'download') => {
    setExporting(true);
    const { css, error } = await exportTokensCssAction();
    setExporting(false);

    if (error || !css) {
      // 에러 토스트
      return;
    }

    if (mode === 'copy') {
      await navigator.clipboard.writeText(css);
      // 성공 토스트: "클립보드에 복사했습니다."
    } else {
      // 파일 다운로드
      const blob = new Blob([css], { type: 'text/css' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tokens.css';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Dropdown 컴포넌트로 "복사" / "다운로드" 선택 제공
}
```

### 8.3 UI 상태

| 상태 | 표시 |
|------|------|
| 기본 | `CSS 내보내기` 버튼 (아이콘: solar:export-linear) |
| 로딩 | 스피너 + 비활성화 |
| 성공(복사) | 2초간 `복사됨` 표시 후 원복 |
| 성공(다운로드) | `tokens.css` 파일 저장 |
| 오류 | 에러 토스트 |

---

## 9. 데이터 흐름 다이어그램

```
사용자 액션: "토큰 추출" (특정 노드 선택)
     │
     ▼
extractTokensAction(figmaUrl, { nodeIds })
     │
     ├── client.getFile(fileKey)
     │      └── file.name, file.styles, file.document
     │                        │
     │                        └── buildStyleMap(file.styles)
     │                                 └── StyleMap { "S:abc": { name, styleType } }
     │
     ├── [nodeIds 있는 경우] client.getNodes(fileKey, nodeIds)
     │      └── nodes[id].document (선택 노드 트리)
     │
     └── extractFromNode(rootNode, styleMap)
              │
              ├── hasNamedStyles(rootNode, styleMap) ──→ true
              │      └── extractByNamedStyles()
              │             source: 'styles-api'
              │
              ├── hasNamedStyles() → false
              │      extractBySectionScope(rootNode) ──→ hasData: true
              │             └── source: 'section-scan'
              │
              └── hasNamedStyles() → false, hasData: false
                     extractByPatternFilter(rootNode)
                            source: 'node-scan'

                  ↓
           ExtractedTokens + source
                  │
                  ├── SQLite 저장 (기존 스키마, source 값만 변경)
                  └── 반환 → ExtractResult (화면 표시)

---

사용자 액션: "CSS 내보내기 → 복사"
     │
     ▼
exportTokensCssAction()
     │
     ├── db.select(tokens) — 전체 토큰
     ├── db.select(projects) — 파일명
     │
     └── generateTokensCss(tokens, options)
              │
              ├── splitByMode(tokens) → { light, dark, single }
              ├── generateColorVars() — 5변수 패턴
              ├── generateTypoVars()
              ├── generateSpacingVars()
              ├── generateRadiusVars()
              │
              └── CSS 문자열 ":root { ... } [data-theme='dark'] { ... }"
                       │
                       └── navigator.clipboard.writeText(css)
```

---

## 10. 구현 순서 및 의존 관계

```
Step 1  globals.scss -rgb 수정
  └── 독립 (즉시 효과, 다른 단계 블로킹 없음)

Step 2  api.ts FigmaNode 타입 확장
  └── Step 3, 4, 5 의존

Step 3  extractor.ts StyleMap 타입 + extractTokens() 시그니처 변경
  └── Step 2 완료 후

Step 4  extractor.ts Layer 1 (Named Styles)
  └── Step 3 완료 후

Step 5  extractor.ts Layer 2 (Section Scope)
  └── Step 3 완료 후 (Step 4와 병렬 가능)

Step 6  extractor.ts Layer 3 (Pattern Filter 개선)
  └── Step 3 완료 후 (Step 4, 5와 병렬 가능)

Step 7  project.ts 연동 (buildStyleMap, source 전달)
  └── Step 3 완료 후

Step 8  css-exporter.ts 신규 작성
  └── 독립 (TokenRow 타입만 의존)

Step 9  tokens.ts exportTokensCssAction 추가
  └── Step 8 완료 후

Step 10 TokenPageActions.tsx CSS Export 버튼
  └── Step 9 완료 후
```

---

## 11. 테스트 포인트

| 시나리오 | 기대 결과 |
|---------|---------|
| Untitled UI (Named Styles 있음) | source: `'styles-api'`, 색상 정확 추출 |
| 색상 팔레트 전용 프레임 (섹션명: "Colors") | source: `'section-scan'`, 직계 자식만 |
| 아무 구조 없는 파일 | source: `'node-scan'`, 패턴 필터 적용 |
| Figma 원형 (cornerRadius = width/2) | radius 추출에서 제외 |
| layoutMode = 'NONE' FRAME | spacing 추출에서 제외 |
| 토큰 0개 시 CSS Export | 에러: "내보낼 토큰이 없습니다." |
| Light/Dark 모드 토큰 존재 시 | `[data-theme="dark"]` 블록 자동 생성 |
| globals.scss -rgb 수정 후 | token-views.module.scss fallback 값 불필요 |
