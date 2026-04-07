## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | css-generator.ts에 Untitled UI 전용 하드코딩 15건. 다른 Figma 파일에서 그룹 분류·이름 축약·정렬 미적용 |
| Solution | 2-pass 생성 + 데이터 기반 패턴 감지 + definedVars 대조 alias 해석 |
| Function UX Effect | 어떤 Figma 디자인 시스템이든 동일한 품질의 tokens.css 자동 생성 |
| Core Value | Untitled UI 전용 도구 → 범용 토큰 매니저 확장 |

---

# Design: Token CSS Generator 범용화

_하드코딩 제거, 데이터 기반 패턴 감지, 2-pass alias 해석_

---

## Overview

| 항목 | 내용 |
|------|------|
| Feature | token-css-generalization |
| Goal | 어떤 Figma Variable 구조든 정확한 tokens.css 생성 |
| Constraint | Untitled UI 출력과 100% 하위 호환 유지 |
| Updated | 2026-04-06 |

---

## 1. 현재 아키텍처

```
TokenRow[] (DB)
    ↓
renderBlock(selector, tokens)
    ↓ 타입별 분기
buildGroups(tokens, prefix)
    ↓ 그룹핑 + toVarName + extractDisplayValue
TokenGroup[]
    ↓ 렌더
CSS 문자열
```

**문제**: `extractDisplayValue` → `resolveAliasRef` → `colorSlugToVarName`에서 alias 해석 시 **정의된 변수 목록을 모름**. 하드코딩으로 추측.

---

## 2. 설계: 2-Pass 생성 구조

### 2-1. Pass 1: 변수 정의 수집

모든 토큰의 `toVarName` 결과를 먼저 수집하여 `definedVars: Set<string>` 생성.

```typescript
interface GenerationContext {
  /** 이 블록에서 정의되는 모든 CSS 변수명 (--xxx) */
  definedVars: Set<string>;
  /** Component colors 원본 이름 → CSS 변수명 매핑 */
  componentColorMap: Map<string, string>;
}

function buildContext(tokens: TokenRow[]): GenerationContext {
  const definedVars = new Set<string>();
  const componentColorMap = new Map<string, string>();

  for (const token of tokens) {
    const prefix = TYPE_PREFIX[token.type] ?? token.type;
    const varName = toVarName(token.name, prefix === '' ? '' : prefix);
    definedVars.add(varName);

    // Component colors: slug → varName 매핑 (캐시 대체)
    if (token.type === 'color' && token.name.startsWith('Component colors/')) {
      const slug = token.name.replace(/\//g, '-').replace(/\s+/g, '-').toLowerCase();
      componentColorMap.set(slug, varName.slice(2)); // --xxx → xxx
    }
  }

  return { definedVars, componentColorMap };
}
```

### 2-2. Pass 2: alias 해석 (definedVars 대조)

`resolveAliasRef`가 `definedVars`를 참조하여 존재하는 변수로 매핑.

```typescript
function resolveAliasRef(rawVar: string, ctx: GenerationContext): string {
  return rawVar.replace(/var\(--([^)]+)\)/g, (_, varName: string) => {
    let slug = varName;
    if (slug.startsWith('color-')) slug = slug.slice('color-'.length);

    // 1. 정확히 일치하는 변수 찾기
    if (ctx.definedVars.has(`--${slug}`)) return `var(--${slug})`;

    // 2. colorSlugToVarName 변환 후 매칭
    if (slug.startsWith('colors-') || slug.startsWith('component-colors-')) {
      const resolved = colorSlugToVarName(slug, ctx);
      if (ctx.definedVars.has(`--${resolved}`)) return `var(--${resolved})`;
    }

    // 3. prefix 변형 시도 (layout-spacing, component- 등)
    for (const prefix of ['layout-', 'component-']) {
      if (ctx.definedVars.has(`--${prefix}${slug}`)) return `var(--${prefix}${slug})`;
    }

    // 4. 폴백: 변환 없이 원본
    return `var(--${slug})`;
  });
}
```

**효과**: `spacing >= 80` 하드코딩 제거. `--spacing-80`이 `definedVars`에 없으면 자동으로 `--layout-spacing-80` 탐색.

### 2-3. Component colors: 캐시 → 컨텍스트 매핑

`_componentColorCache` (globalThis 싱글턴) → `ctx.componentColorMap` (함수 스코프).

```typescript
function colorSlugToVarName(slug: string, ctx: GenerationContext): string {
  // component-colors slug → 컨텍스트 매핑 조회
  if (slug.startsWith('component-colors-')) {
    const cached = ctx.componentColorMap.get(slug);
    if (cached) return cached;
  }
  // 기존 로직 (Primitives/Semantic)
  ...
}
```

**효과**: `registerComponentColorMapping` 제거, 사이드이펙트 없는 순수 함수화.

---

## 3. 설계: 데이터 기반 그룹 감지

### 3-1. Semantic 그룹 자동 감지

```typescript
function detectColorGroups(tokens: TokenRow[]): {
  semanticGroups: string[];
  componentGroups: string[];
} {
  const semantic = new Set<string>();
  const component = new Set<string>();

  for (const t of tokens) {
    if (t.type !== 'color') continue;
    const parts = t.name.split('/');
    const isAlias = (t.raw ?? '').startsWith('var(');

    if (parts[0] === 'Component colors' && parts.length >= 2) {
      component.add(parts[1]);
    } else if (parts[0] === 'Colors' && parts.length >= 3) {
      const sub = parts[1];
      // alias 참조이거나, 하위에 3+ 세그먼트면 시맨틱 후보
      if (isAlias) semantic.add(sub);
    }
  }

  return {
    semanticGroups: [...semantic],   // Figma DB 순서 유지
    componentGroups: [...component],
  };
}
```

**효과**: `SEMANTIC_ORDER`, `COMP_ORDER` 하드코딩 제거.

### 3-2. classifyColorGroup 범용화

```typescript
function classifyColorGroup(
  token: TokenRow,
  semanticGroups: Set<string>,
  componentGroups: string[],
): string {
  const parts = token.name.split('/');
  const isAlias = (token.raw ?? '').startsWith('var(');

  // Component colors
  if (parts[0] === 'Component colors') {
    const sub = parts[1] ?? '';
    const idx = componentGroups.indexOf(sub);
    const sortKey = String(idx >= 0 ? idx : 99).padStart(2, '0');
    // 마지막 세그먼트가 변수명인 그룹은 단일 그룹 (Alpha 등)
    const hasSubCategories = parts.length >= 4;
    const thirdGroup = hasSubCategories ? parts[2] : '';
    return `3-component-${sortKey}-${sub}${thirdGroup ? '-' + thirdGroup : ''}`;
  }

  const subGroup = parts[1] ?? '';

  // Semantic: alias이거나 감지된 시맨틱 그룹
  if (isAlias || semanticGroups.has(subGroup)) {
    const idx = [...semanticGroups].indexOf(subGroup);
    const sortKey = String(idx >= 0 ? idx : 99).padStart(2, '0');
    return `2-semantic-${sortKey}-${subGroup}`;
  }

  // Primitives
  return '1-primitives';
}
```

**효과**: 어떤 Figma 파일이든 `Colors/Surface/...` → 시맨틱, `Colors/Red/50` → Primitives 자동 분류.

### 3-3. isPalette 범용화

```typescript
// 현재: alpha/effect 예외 하드코딩
// 범용: semanticGroups에 포함된 그룹은 팔레트가 아님
const isPalette = (/^\d+$/.test(lastPart) || BASE_NAMES.includes(lastPart))
  && !semanticGroups.has(second);
```

---

## 4. 설계: 범용 slug dedup

### 4-1. 복수형 자동 감지

```typescript
function deduplicateSlugSegments(slug: string, prefix: string): string {
  const parts = slug.split('-');
  const result: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // prefix의 복수형 (shadow → shadows, blur → blurs)
    if (i === 0 && (part === prefix + 's' || part === prefix + 'es')) continue;
    // 이전 세그먼트와 동일하면 스킵
    if (result.length > 0 && part === result[result.length - 1]) continue;
    result.push(part);
  }

  return result.join('-');
}
```

**효과**: `backdrop-blurs-`, `focus-rings-` 등 하드코딩 제거. 어떤 복수형이든 자동 처리.

---

## 5. 파일별 변경 요약

| 파일 | 변경 |
|------|------|
| `css-generator.ts` | 2-pass 구조, `GenerationContext`, `detectColorGroups`, `classifyColorGroup` 범용화, `deduplicateSlugSegments` 범용화, `_componentColorCache` 제거, `resolveAliasRef` definedVars 대조 |
| `css-var-mapper.ts` | `colorSlugToVarName` ctx 파라미터 추가 (옵션) |

---

## 6. 하위 호환 검증

| 테스트 | 방법 |
|--------|------|
| Untitled UI 동일 출력 | 현재 tokens.css를 스냅샷으로 저장 → 범용화 후 diff 0 확인 |
| 다른 Figma 파일 | Material Design / Apple HIG 토큰 JSON으로 테스트 |
| 엣지 케이스 | 빈 토큰, 단일 컬렉션, alias 없는 파일 |

스냅샷 비교 스크립트:

```bash
# 범용화 전 스냅샷
cp design-tokens/tokens.css design-tokens/tokens.snapshot.css

# 범용화 후 재생성
npx tsx scripts/regenerate-tokens.ts

# diff
diff design-tokens/tokens.snapshot.css design-tokens/tokens.css
```

---

## 7. 구현 순서

| 순서 | 작업 | 의존 |
|------|------|------|
| 1 | 스냅샷 저장 (현재 tokens.css) | 없음 |
| 2 | `GenerationContext` + `buildContext` 구현 | 없음 |
| 3 | `resolveAliasRef` → definedVars 대조 | #2 |
| 4 | `detectColorGroups` + `classifyColorGroup` 범용화 | #2 |
| 5 | `deduplicateSlugSegments` 범용화 | 없음 |
| 6 | `isPalette` → semanticGroups 기반 | #4 |
| 7 | `_componentColorCache` → `ctx.componentColorMap` | #2 |
| 8 | spacing 리매핑 → definedVars 대조 | #3 |
| 9 | Untitled UI 스냅샷 diff 0 확인 | #3~#8 |
| 10 | 다른 Figma 파일 테스트 | #9 |
| 11 | 플러그인 변환 규칙 공유 문서 작성 | #9 |

---

## 8. 검증 기준

| # | 항목 | 기대 |
|---|------|------|
| V1 | Untitled UI tokens.css diff | **0줄** (하위 호환 완전) |
| V2 | Material Design 토큰 | 정상 그룹 분류 + alias 해석 |
| V3 | 빈 Figma 파일 | `/* 토큰이 없습니다. */` 출력 |
| V4 | `grep -c 'SEMANTIC_ORDER\|COMP_ORDER\|backdrop-blurs\|focus-rings\|avatars\|portfolio-mockups\|spacing >= 80' css-generator.ts` | **0** |
| V5 | `_componentColorCache` 제거 | globalThis 사이드이펙트 없음 |
| V6 | 끊어진 var() 참조 | **0건** (definedVars 대조) |
