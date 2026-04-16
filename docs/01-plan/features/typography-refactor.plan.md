# typography-refactor Planning Document

> **Summary**: 분산된 타이포그래피 토큰 3타입(typography/heading/text-style)을 하나로 통합하고, 플러그인 전송 단위도 단일화한다.
>
> **Project**: PixelForge
> **Author**: Jeonghak Hur
> **Date**: 2026-04-13
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | `typography` / `heading` / `text-style` 3개 DB 타입이 중복 데이터를 저장하고, 플러그인에서 4개 카드를 따로 선택·전송해야 해서 충돌이 발생한다 |
| **Solution** | 복합 스타일 토큰(headings + textStyles 44개)만 `typography` 타입으로 통일 저장; FLOAT/STRING 원시값은 CSS 생성 시 자동 추출 |
| **Function/UX Effect** | 플러그인 "Typography" 카드 1개 선택으로 완전한 타이포그래피 데이터 전송; 가이드 페이지 data source 단순화 |
| **Core Value** | 중복 제거 + 전송 오류 방지 + 코드 단순화 |

---

## 1. Overview

### 1.1 현재 문제

```
플러그인 카드 4개 → 각각 별도 전송
  Typography · Float  (22개) ─┐
  Typography · String (10개) ─┤ 같은 type='typography'로 저장
  Text Styles         (20개) ─ type='text-style'
  Headings            (24개) ─ type='heading'
```

- `Float`와 `String`을 따로 보내면 두 번째 전송이 첫 번째를 DELETE하는 충돌 발생
- `heading` / `text-style` 복합 토큰에 `Float`/`String`의 모든 값이 이미 포함됨 (중복)
- `TypographyList.tsx`가 `tokens` + `compositeTokens` 두 prop을 받아 분기 처리하는 복잡한 구조

### 1.2 목표 구조

```
플러그인 카드 1개 → 단일 전송
  Typography (44개)
    ├── styles.headings   24개  (Display 2xl~xs × 4 weights)
    └── styles.textStyles 20개  (Text xl~xs × 4 weights)
```

DB:
```
type='typography' 44개
  name: "Display 2xl/Regular"
  value: {"fontFamily":"Inter","fontSize":72,"fontWeight":400,
          "lineHeight":"90px","letterSpacing":"-0.02em"}
```

CSS 생성 시 복합 토큰에서 CSS 변수 자동 추출:
```css
--font-size-display-2xl: 72px;
--line-height-display-2xl: 90px;
--letter-spacing-display-2xl: -0.02em;
--font-family-display: Inter;
--font-weight-regular: 400;
```

---

## 2. Scope

### 2.1 In Scope

- [ ] `parse-variables.ts`: `styles.headings` / `styles.textStyles` → `type='typography'` 통일
- [ ] `parse-variables.ts`: `extraVars` FLOAT/STRING 타이포그래피 항목 무시(또는 저장은 하되 CSS 생성에서 복합 토큰 우선)
- [ ] `css-generator.ts`: `type='typography'` 복합 JSON에서 CSS 변수 추출 로직 추가
- [ ] `TypographyList.tsx`: `compositeTokens` prop 제거, `tokens` 단일 파싱
- [ ] `page.tsx`: `heading`/`text-style` 별도 fetch 제거
- [ ] Plugin `tab-extract.js`: `Typography` 단일 집합 카드로 통합

### 2.2 Out of Scope

- `/tokens/heading`, `/tokens/text-style` 개별 페이지 라우트 — 현재 토큰 없으면 빈 페이지이므로 삭제 불필요
- 이탤릭 변형 지원 (`Font weight/regular-italic` 등) — 가이드 페이지 미사용
- CSS 유틸리티 클래스 생성 (`display-2xl-semibold` 등) — 별도 기능

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | `styles.headings` 토큰이 `type='typography'`로 저장된다 | High |
| FR-02 | `styles.textStyles` 토큰이 `type='typography'`로 저장된다 | High |
| FR-03 | 두 타입을 같은 payload로 전송해도 중복/충돌 없이 저장된다 | High |
| FR-04 | CSS 생성기가 복합 토큰에서 `--font-size-*`, `--line-height-*`, `--letter-spacing-*` 변수를 추출한다 | High |
| FR-05 | `TypographyList`가 `tokens` 하나로 가이드 페이지를 렌더한다 | High |
| FR-06 | 플러그인에서 "Typography" 카드 1개 선택으로 완전한 데이터가 전송된다 | High |
| FR-07 | `letter-spacing` 값이 가이드 페이지 specs에 표시된다 | Medium |

### 3.2 Non-Functional Requirements

| Category | Criteria |
|----------|----------|
| 하위 호환 | 기존 DB에 `heading`/`text-style` 타입 데이터가 있어도 페이지가 깨지지 않는다 |
| 빌드 | `npm run build` 통과 |
| 타입 안전 | TypeScript strict, `any` 없음 |

---

## 4. 데이터 흐름 (변경 전 → 후)

### 변경 전

```
Figma
  styles.headings (24)   →  parse  →  type='heading'   (DB)
  styles.textStyles (20) →  parse  →  type='text-style' (DB)
  extraVars FLOAT (22)   →  parse  →  type='typography' (DB)  ← 충돌
  extraVars STRING (10)  →  parse  →  type='typography' (DB)  ← 충돌

page.tsx
  getTokensByType('typography')       → TypographyList tokens
  getTokensByType('heading')          → TypographyList compositeTokens  (병합)
  getTokensByType('text-style')       → TypographyList compositeTokens  (병합)
```

### 변경 후

```
Figma
  styles.headings (24)   →  parse  →  type='typography' (DB)
  styles.textStyles (20) →  parse  →  type='typography' (DB)
  extraVars FLOAT/STRING →  parse  →  type='typography' (DB, 기존 그대로 저장)
    ※ CSS 생성 시 복합 토큰 우선 사용

page.tsx
  getTokensByType('typography')  →  TypographyList tokens (단일)

css-generator.ts
  type='typography' + JSON value  →  --font-size-*, --line-height-*, --letter-spacing-*
```

---

## 5. 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/sync/parse-variables.ts` | `textStyleGroups` 타입 매핑 변경: heading/text-style → typography |
| `src/lib/tokens/css-generator.ts` | typography 복합 JSON에서 CSS 변수 추출 로직 추가 |
| `src/app/(main)/(ide)/tokens/[type]/TypographyList.tsx` | `compositeTokens` prop 제거, 단일 파싱 |
| `src/app/(main)/(ide)/tokens/[type]/page.tsx` | heading/text-style 별도 fetch 제거 |
| `/Users/jeonghak/work/pixelforge-plugin-/src/ui/tab-extract.js` | Typography 집합 카드 통합 |

---

## 6. 구현 순서

```
Step 1. parse-variables.ts 수정
        heading/text-style → typography 타입 통일

Step 2. css-generator.ts 수정
        복합 토큰 → CSS 변수 추출

Step 3. TypographyList.tsx 단순화
        compositeTokens 분기 제거

Step 4. page.tsx 정리
        별도 fetch 제거

Step 5. 빌드 검증
        npm run build

Step 6. 플러그인 tab-extract.js 수정
        Typography 카드 통합
```

---

## 7. Success Criteria

- [ ] `npm run build` 성공
- [ ] `/tokens/typography` 페이지: Display 2xl~xs + Text xl~xs 전체 스케일 렌더
- [ ] 각 스케일 row: letterSpacing 값 정확히 표시 (Display 2xl~md: -0.02em)
- [ ] CSS 변수 파일에 `--font-size-*`, `--line-height-*`, `--letter-spacing-*` 포함
- [ ] 플러그인에서 Typography 카드 1개 전송으로 44개 토큰 정상 저장

---

## 8. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| 기존 DB `heading`/`text-style` 데이터 → 재동기화 필요 | Medium | 재동기화 가이드 제공 |
| css-generator 복합 토큰 파싱 로직 추가 시 기존 CSS 변수 깨짐 | Medium | 기존 FLOAT 토큰도 유지하여 fallback |
| 플러그인 수정 후 기존 사용자 혼란 | Low | UI 레이블 명확히 |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-04-13 | Initial draft |
