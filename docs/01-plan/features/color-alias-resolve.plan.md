## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | 색상 토큰 857개 중 480개(56%)가 alias(`var(--*)`)여서 ColorGrid에 스와치가 표시되지 않음. 시맨틱·컴포넌트 색상이 모두 누락 |
| Solution | DB에서 alias → hex 체인 해석하여 실제 색상값을 resolve. 서버 액션에서 해석 후 ColorGrid에 전달 |
| Function UX Effect | 모든 색상 토큰이 스와치로 표시됨 + alias 참조 경로 표시 + Light/Dark 모드 필터링 |
| Core Value | 색상 가이드의 완전성 — Primitives뿐 아니라 시맨틱·컴포넌트 토큰까지 시각적으로 검수 가능 |

---

# Plan: Color Alias 해석 (ColorGrid 완전 표시)

> alias 색상 토큰의 실제 hex값을 해석하여 ColorGrid에서 100% 스와치 표시

**작성**: 2026-04-07
**상태**: 계획

---

## 1. 현재 상태

### 1-1. 데이터 분석

| 분류 | 수량 | ColorGrid 표시 |
|------|------|:--------------:|
| hex/rgba 직접값 (Primitives) | 377개 | 표시됨 |
| alias `var(--*)` (Semantic + Component) | 480개 | **표시 안 됨** |
| **합계** | 857개 | 44%만 표시 |

### 1-2. alias 해석 가능성 (검증 완료)

| 해석 방법 | 성공 |
|-----------|------|
| 직접 매칭 (alias → hex 토큰) | 458/480 (95.4%) |
| 체인 매칭 (alias → alias → hex) | **480/480 (100%)** |

체인 최대 깊이 2 (alias→alias→hex). 22건의 2단 체인도 모두 해석 가능.

### 1-3. 현재 코드 문제

```tsx
// ColorGrid.tsx line 179
const color = parseColor(token.value);
if (!color) return null;  // ← var(--*) 480개 전부 탈락
```

`parseColor`가 JSON/hex/rgba만 처리하고 `var()` 문자열을 처리하지 않음.

---

## 2. 설계 방향

### 2-1. 해석 위치: 서버 액션 (DB 조회)

alias 해석은 **다른 토큰의 값을 참조**해야 하므로 서버 액션에서 수행.

```
DB 조회 (getTokensByType)
    ↓
alias 해석 (resolveAliasColors)
    ↓ 각 alias 토큰에 resolvedHex 추가
ColorGrid (resolvedHex로 스와치 표시)
```

### 2-2. 해석 알고리즘

```typescript
interface ResolvedTokenRow extends TokenRow {
  resolvedHex?: string;    // alias 해석된 실제 hex 값
  aliasTarget?: string;    // 참조 대상 변수명 (--colors-neutral-900)
}

function resolveAliasColors(tokens: TokenRow[]): ResolvedTokenRow[] {
  // 1. hex/rgba 토큰을 CSS 변수명으로 인덱싱
  const hexMap = new Map<string, string>(); // varName → hex
  
  // 2. 각 alias 토큰: var(--xxx) → hexMap에서 조회 (체인 2단까지)
  
  // 3. resolvedHex + aliasTarget 추가하여 반환
}
```

### 2-3. ColorGrid 변경

```tsx
// 기존: parseColor 실패 시 skip
const color = parseColor(token.value);
if (!color) return null;

// 개선: resolvedHex 우선, 원본 value 폴백
const color = parseColor(token.resolvedHex ?? token.value);
if (!color) return null;

// alias 참조 표시
{token.aliasTarget && (
  <span className={styles.aliasRef}>→ {token.aliasTarget}</span>
)}
```

### 2-4. Light/Dark 모드 필터링

현재 같은 이름의 토큰이 Light/Dark 2개씩 있어 카드 중복.

```tsx
// 모드 필터 상태
const [modeFilter, setModeFilter] = useState<'all' | 'light' | 'dark'>('all');

// 필터링
const filtered = tokens.filter(t => 
  modeFilter === 'all' || 
  (!t.mode && modeFilter === 'light') ||
  t.mode?.toLowerCase().includes(modeFilter)
);
```

---

## 3. 변경 대상 파일

| 파일 | 변경 |
|------|------|
| `src/lib/actions/tokens.ts` | `resolveAliasColors()` 함수 추가, `getTokensByType`에서 호출 |
| `src/app/(ide)/tokens/[type]/ColorGrid.tsx` | `resolvedHex` 사용, alias 참조 표시, 모드 필터 |
| `src/app/(ide)/tokens/[type]/token-views.module.scss` | alias 참조 스타일, 모드 필터 UI |

---

## 4. 구현 순서

| 순서 | 작업 | 의존 |
|------|------|------|
| 1 | `resolveAliasColors()` 서버 함수 구현 | 없음 |
| 2 | `getTokensByType` → `resolveAliasColors` 연결 | #1 |
| 3 | ColorGrid에서 `resolvedHex` 사용 + alias 참조 표시 | #2 |
| 4 | Light/Dark 모드 필터 UI | 없음 |
| 5 | 빌드 검증 | #1~#4 |

---

## 5. 검증 기준

| # | 항목 | 기대 |
|---|------|------|
| V1 | ColorGrid 표시 토큰 수 | 857개 전체 (현재 377개) |
| V2 | alias 스와치 색상 | 참조 대상의 실제 hex 표시 |
| V3 | alias 참조 경로 | "→ colors-neutral-900" 표시 |
| V4 | 모드 필터 | Light/Dark 토글 시 해당 모드만 표시 |
| V5 | 해석 실패 | 0건 (체인 해석으로 100% 커버) |
