## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | 컴포넌트 생성기의 CSS 변수 매핑(SEMANTIC_MAP, COLOR_ABBREV), 변수명 생성 규칙(toVarName), Primitive/Semantic 판별이 하드코딩되어 다른 디자인 시스템에서 사용 불가. Sandbox는 button만 지원. |
| Solution | 프로젝트별 설정 UI(Settings 페이지) + DB 저장으로 매핑/규칙을 사용자가 관리. Sandbox를 element 동적 결정 방식으로 범용화. |
| Function UX Effect | Settings에서 색상 매핑, 약어, style 타입 규칙을 편집하면 토큰 추출과 컴포넌트 생성에 즉시 반영. 어떤 컴포넌트든 Sandbox에서 인터랙티브 프리뷰 가능. |
| Core Value | 디자인 시스템이 바뀌어도 코드 수정 없이 설정만으로 대응. Sandbox가 모든 컴포넌트를 지원하여 컴포넌트 가이드 페이지의 가치 극대화. |

---

# Plan: Generator Config 설정화 + Sandbox 범용화

> 하드코딩된 매핑/규칙을 프로젝트별 설정으로 외부화하고, Sandbox를 모든 컴포넌트에서 동작하도록 범용화

**작성**: 2026-04-09
**상태**: Plan
**선행 작업**: component-generator 통합 재설계 (완료)

---

## 1. 현재 상태 — 하드코딩 5건

### 1-1. SEMANTIC_MAP (범용성 ❌)

```typescript
// css-var-mapper.ts:24-37
const SEMANTIC_MAP: Record<string, string> = {
  'colors-gray-white': 'bg-elevated',
  'colors-gray-950':   'bg-body',
  'colors-gray-900':   'text-primary',
  // ... 9개 항목
};
```

PixelForge 전용. 다른 프로젝트에서는 gray-900이 text-primary가 아닐 수 있음.

### 1-2. COLOR_ABBREV (범용성 ⚠️)

```typescript
// css-generator.ts:27-29
const COLOR_ABBREV: Record<string, string> = {
  background: 'bg',
  foreground: 'fg',
};
```

Untitled UI 컨벤션 의존. `Surface/surface-*` 같은 패턴 미지원.

### 1-3. toVarName style 타입 분기 (범용성 ⚠️)

```typescript
// css-generator.ts:74
if (prefix === 'shadow' || prefix === 'gradient' || prefix === 'blur') {
  // 마지막 세그먼트를 그대로 CSS 변수명으로 사용
}
```

3개 타입만 특수 경로. 새 style 타입 추가 시 수동 확장 필요.

### 1-4. Primitive/Semantic 판별 (범용성 ⚠️)

```typescript
// css-generator.ts:213-216
const isPalette = /^\d+$/.test(lastPart) || ['white', 'black', 'transparent'].includes(lastPart);
```

숫자/키워드 기반 휴리스틱. edge case에서 오분류 가능.

### 1-5. Sandbox button 전용 (범용성 ❌)

```typescript
// ComponentGuideClient.tsx:425
{detectedType === 'button' ? <ButtonSandbox .../> : /* placeholder */}
```

iframe 내부에 `<button>` 하드코딩. 다른 컴포넌트 타입 미지원.

---

## 2. 설계 방향

### 2-1. DB 설정 테이블 활용

기존 `appSettings` 테이블(key-value)을 활용하여 프로젝트별 설정 저장:

| key | value (JSON) | 용도 |
|-----|-------------|------|
| `generator.semanticMap` | `{"colors-gray-900": "text-primary", ...}` | 색상 시맨틱 매핑 |
| `generator.colorAbbrev` | `{"background": "bg", "foreground": "fg"}` | 색상 그룹 약어 |
| `generator.styleTypePassthrough` | `["shadow", "gradient", "blur"]` | 마지막 세그먼트 직접 사용 타입 |
| `generator.paletteKeywords` | `["white", "black", "transparent"]` | Primitive 판별 키워드 |

### 2-2. 설정 흐름

```
Settings 페이지 → Server Action → appSettings DB 저장
                                         ↓
css-var-mapper.ts ← 런타임에 DB에서 로드 (캐시)
css-generator.ts  ← 런타임에 DB에서 로드 (캐시)
```

### 2-3. Sandbox 범용화

```
ButtonSandbox → ComponentSandbox (이름 변경)
  - iframe 내부 element를 detectedType/TSX에서 추출
  - detectedType 분기 제거 → 모든 컴포넌트에서 렌더링
  - TSX에서 element 타입 자동 감지 (forwardRef<HTMLButtonElement → button)
```

---

## 3. DB 스키마

기존 `appSettings` 테이블 활용 (신규 테이블 불필요):

```typescript
// 이미 존재:
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
```

초기값 마이그레이션:

```typescript
const GENERATOR_DEFAULTS = {
  'generator.semanticMap': JSON.stringify({
    'colors-gray-white': 'bg-elevated',
    'colors-gray-50': 'bg-surface',
    'colors-gray-100': 'glass-bg',
    'colors-gray-200': 'glass-border',
    'colors-gray-950': 'bg-body',
    'colors-gray-900': 'text-primary',
    'colors-gray-700': 'text-secondary',
    'colors-gray-500': 'text-muted',
    'colors-gray-300': 'border-color',
  }),
  'generator.colorAbbrev': JSON.stringify({
    background: 'bg',
    foreground: 'fg',
  }),
  'generator.styleTypePassthrough': JSON.stringify(['shadow', 'gradient', 'blur']),
  'generator.paletteKeywords': JSON.stringify(['white', 'black', 'transparent']),
};
```

---

## 4. Server Actions

### 4-1. 설정 조회/저장

```typescript
// lib/actions/generator-config.ts
'use server';

export async function getGeneratorConfig(): Promise<GeneratorConfig>;
export async function updateGeneratorConfig(key: string, value: string): Promise<{ error?: string }>;
```

### 4-2. 캐시 전략

- `css-var-mapper.ts`: `getSemanticMap()` — DB에서 로드, 모듈 레벨 캐시
- `css-generator.ts`: `getColorAbbrev()`, `getStyleTypePassthrough()`, `getPaletteKeywords()` — 동일 패턴
- 설정 변경 시 캐시 무효화 (서버 재시작 또는 `revalidatePath`)

---

## 5. Settings UI

기존 Settings 페이지(`/settings`)에 "Generator" 탭 추가:

### 5-1. Semantic Map 에디터

| Figma 변수 | 프로젝트 토큰 | 삭제 |
|---|---|---|
| `colors-gray-900` | `text-primary` | [x] |
| `colors-gray-700` | `text-secondary` | [x] |
| [+ 추가] | | |

### 5-2. Color Abbreviations

| 전체 이름 | 약어 | 삭제 |
|---|---|---|
| `background` | `bg` | [x] |
| `foreground` | `fg` | [x] |
| [+ 추가] | | |

### 5-3. Style Type Passthrough

체크박스 목록: `[x] shadow` `[x] gradient` `[x] blur` `[ ] + 추가`

### 5-4. Palette Keywords

태그 입력: `white` `black` `transparent` `[+ 추가]`

---

## 6. Sandbox 범용화

### 6-1. Element 자동 감지

생성된 TSX에서 HTML element를 추출:

```typescript
function parseElementType(tsx: string): string {
  // forwardRef<HTMLButtonElement → 'button'
  // forwardRef<HTMLInputElement → 'input'
  // forwardRef<HTMLDivElement → 'div'
  const match = tsx.match(/forwardRef<HTML(\w+)Element/);
  if (!match) return 'div';
  return match[1].toLowerCase();
}
```

### 6-2. ComponentSandbox

```typescript
function ComponentSandbox({ name, css, tsx }: Props) {
  const element = parseElementType(tsx ?? '');
  // ...
  // iframe HTML:
  <${element} type="${element === 'button' ? 'button' : ''}" class="root" ${attrs}>
    ${childrenText || name}
  </${element}>
}
```

### 6-3. detectedType 분기 제거

```typescript
// Before:
{detectedType === 'button' ? <ButtonSandbox /> : <placeholder />}

// After:
<ComponentSandbox name={name} css={css} tsx={tsx} />
```

---

## 7. 구현 순서

| # | 작업 | 파일 | 의존 |
|---|------|------|------|
| 1 | Server Action: generator-config CRUD | `lib/actions/generator-config.ts` | - |
| 2 | css-var-mapper 설정 연동 | `css-var-mapper.ts` | #1 |
| 3 | css-generator 설정 연동 | `css-generator.ts` | #1 |
| 4 | Settings UI: Generator 탭 | `app/(ide)/settings/` | #1 |
| 5 | Sandbox 범용화 | `ComponentGuideClient.tsx` | - |
| 6 | SCSS 정리 | `page.module.scss` | #5 |
| 7 | 테스트 | 빌드 + 수동 검증 | #1~#6 |

---

## 8. 완료 기준

- [ ] `appSettings`에서 4개 설정 키 CRUD 동작
- [ ] Settings 페이지에서 SEMANTIC_MAP 편집 → 컴포넌트 재생성 시 반영
- [ ] Settings 페이지에서 COLOR_ABBREV 편집 → tokens.css 재생성 시 반영
- [ ] `css-var-mapper.ts`, `css-generator.ts`에 하드코딩된 상수 제거
- [ ] Sandbox가 모든 detectedType에서 렌더링 (button, badge, card 등)
- [ ] iframe 내부 element가 TSX에서 자동 감지
- [ ] `npm run build` 성공
- [ ] `npm run lint` 통과

---

## 9. 예상 결과

| 지표 | 현재 | 완료 후 |
|------|------|---------|
| SEMANTIC_MAP | 하드코딩 9개 | DB 설정, UI 편집 |
| COLOR_ABBREV | 하드코딩 2개 | DB 설정, UI 편집 |
| Style type passthrough | 코드 조건문 3개 | DB 배열, UI 체크박스 |
| Palette keywords | 하드코딩 3개 | DB 배열, UI 태그 |
| Sandbox 지원 | button만 | 모든 컴포넌트 |
| 다른 디자인 시스템 적용 | 코드 수정 필요 | 설정만 변경 |
