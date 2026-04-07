## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | css-generator.ts에 Untitled UI 전용 하드코딩이 30% 존재. 다른 Figma 파일에서 그룹 분류, 이름 축약, 정렬이 적용 안 됨 |
| Solution | 하드코딩 대신 토큰 데이터 자체에서 패턴을 감지하는 범용 로직으로 전환 |
| Function UX Effect | 어떤 Figma 디자인 시스템이든 동일한 품질의 tokens.css 자동 생성 |
| Core Value | PixelForge가 Untitled UI 전용 도구가 아닌 범용 토큰 매니저로 확장 가능 |

---

# Plan: Token CSS Generator 범용화

> Untitled UI 전용 하드코딩을 제거하고 어떤 Figma 파일이든 적응하는 범용 토큰 CSS 생성기

**작성**: 2026-04-06
**상태**: 계획
**선행 작업**: Untitled UI 기준 안정화 완료 (dd0966c)

---

## 1. 현재 하드코딩 목록

### 1-1. 색상 그룹 분류 (`classifyColorGroup`)

| 하드코딩 | 위치 | Untitled UI 전용 |
|---------|------|-----------------|
| `SEMANTIC_ORDER = ['Background', 'Text', 'Foreground', 'Border', 'Effects']` | 정렬 순서 | 다른 시스템은 Surface, Content, Stroke 등 사용 가능 |
| `COMP_ORDER = ['Utility', 'Components', 'Alpha']` | Component colors 하위 분류 | Untitled UI 구조 전용 |
| `subGroup === 'Effects'` | Effects 판별 | 다른 이름 (Elevation, Shadows 등) 미대응 |
| `subGroup.toLowerCase().includes('alpha')` | Alpha 판별 | 다른 투명도 이름 미대응 |
| `subGroup.toLowerCase() === 'alpha'` | Alpha 단일 그룹 처리 | Untitled UI 전용 |

### 1-2. 변수명 축약 (`deduplicateSlugSegments`)

| 하드코딩 | 위치 |
|---------|------|
| `backdrop-blurs-`, `focus-rings-`, `avatars-`, `portfolio-mockups-` | Untitled UI 전용 그룹명 |

### 1-3. 팔레트 판별 (`isPalette`)

| 하드코딩 | 위치 |
|---------|------|
| `!fullSlug.includes('alpha') && !fullSlug.includes('effect')` | alpha/effect 예외 |

### 1-4. Component colors 캐시 (`_componentColorCache`)

| 하드코딩 | 위치 |
|---------|------|
| `colorSlugToVarName`의 `KNOWN_PREFIXES = ['utility-', 'components-', 'alpha-']` | slug→varName 역매핑 |

### 1-5. 기타

| 하드코딩 | 위치 |
|---------|------|
| `COLOR_ABBREV = { background: 'bg', foreground: 'fg' }` | 약어 매핑 (비교적 범용) |
| `font prefix && family-font-family-` 패턴 | font-family 이중 prefix 보정 |
| `spacing >= 80 → layout-spacing` 리매핑 | Untitled UI spacing 분리 구조 전용 |

---

## 2. 범용화 전략

### 2-1. 데이터 기반 그룹 감지

하드코딩된 `SEMANTIC_ORDER` 대신, 토큰 데이터에서 패턴을 감지:

```typescript
// 현재 (하드코딩)
const SEMANTIC_ORDER = ['Background', 'Text', 'Foreground', 'Border'];

// 범용화: 토큰 경로에서 자동 추출
function detectSemanticGroups(tokens: TokenRow[]): string[] {
  const groups = new Set<string>();
  for (const t of tokens) {
    if (!t.raw?.startsWith('var(')) continue; // alias만
    const parts = t.name.split('/');
    if (parts[0] === 'Colors' && parts.length >= 3) {
      groups.add(parts[1]); // Background, Text, etc.
    }
  }
  return [...groups]; // Figma DB 순서 유지
}
```

### 2-2. 범용 slug dedup

하드코딩된 그룹명 제거 대신, **반복 패턴 자동 감지**:

```typescript
// 현재 (하드코딩)
if (s.startsWith('backdrop-blurs-')) s = s.slice('backdrop-blurs-'.length);

// 범용화: slug 내 반복 세그먼트 자동 제거
function deduplicateSlugGeneric(slug: string): string {
  const parts = slug.split('-');
  // 연속된 동일/유사 세그먼트 제거
  // shadows-shadow-xs → shadow-xs
  // utility-brand-utility-brand-600 → utility-brand-600
}
```

### 2-3. Spacing alias 범용 리매핑

`spacing >= 80` 하드코딩 대신, **실제 정의된 변수 목록과 대조**:

```typescript
// 현재 (하드코딩)
if (numMatch && parseInt(numMatch[1]) >= 80) {
  return `var(--layout-${slug})`;
}

// 범용화: 정의된 변수 Set에서 존재 여부 확인
function resolveAlias(slug: string, definedVars: Set<string>): string {
  if (definedVars.has(`--${slug}`)) return `var(--${slug})`;
  // 폴백: prefix 변형 시도 (layout-, component- 등)
  for (const prefix of ['layout-', 'component-']) {
    if (definedVars.has(`--${prefix}${slug}`)) return `var(--${prefix}${slug})`;
  }
  return `var(--${slug})`;
}
```

### 2-4. Component colors 캐시 제거

`_componentColorCache` 대신, **2-pass 생성** (1pass: 변수 정의 수집, 2pass: alias 해석):

```typescript
// 1pass: 모든 토큰의 varName 수집
const definedVars = new Set(allTokens.map(t => toVarName(t.name, prefix)));

// 2pass: alias 해석 시 definedVars에서 매칭
```

---

## 3. 플러그인 협업 개선

### 3-1. 플러그인에 공유할 파일

| 파일 | 역할 |
|------|------|
| `css-generator.ts` | 변수명 변환 규칙 전체 (학습용) |
| `design-tokens/tokens.css` | 최종 결과물 참조 표본 |
| `css-var-mapper.ts` | 컴포넌트 CSS가 토큰을 참조하는 규칙 |

### 3-2. 이상적 흐름

```
현재: 플러그인 (독자 변환) → 서버 (사후 보정) → CSS
이상: 플러그인 (공유 규칙) → 서버 (그대로 출력) → CSS
```

플러그인이 `css-generator.ts`의 `toVarName` 규칙을 내장하면 서버의 `resolveAliasRef`, `colorSlugToVarName`, `_componentColorCache` 보정 코드가 불필요해짐.

---

## 4. 구현 순서

| 순서 | 작업 | 의존 |
|------|------|------|
| 1 | 2-pass 생성 구조 (정의 수집 → alias 해석) | 없음 |
| 2 | 데이터 기반 그룹 감지 (`detectSemanticGroups`) | #1 |
| 3 | 범용 slug dedup | #1 |
| 4 | Spacing alias 범용 리매핑 (definedVars 대조) | #1 |
| 5 | Component colors 캐시 제거 | #1, #4 |
| 6 | 다른 Figma 파일로 테스트 (Material Design 토큰 등) | #1~#5 |
| 7 | 플러그인에 변환 규칙 공유 | #1~#5 안정화 후 |

---

## 5. 검증 기준

| # | 검증 | 기대 |
|---|------|------|
| V1 | Untitled UI 토큰 → 현재와 동일한 tokens.css | 하위 호환 유지 |
| V2 | Material Design 토큰 → 정상 그룹 분류 + 정렬 | 범용성 |
| V3 | 빈 Figma 파일 → 오류 없이 빈 CSS | 엣지 케이스 |
| V4 | 하드코딩 grep 0건 | `SEMANTIC_ORDER`, `COMP_ORDER`, `backdrop-blurs` 등 |
