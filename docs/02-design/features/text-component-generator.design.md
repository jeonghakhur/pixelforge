# Design: Text Component Generator

_DB Typography 토큰 기반 Text 컴포넌트 생성기 — COMPONENT_SET 없이 토큰에서 직접 생성_

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | Figma Untitled UI는 Text를 COMPONENT_SET이 아닌 Text Style로만 정의 → 플러그인 variants 추출 방식 불가. 현재 DB에 11개 size × 4 weight Typography 토큰이 있지만 컴포넌트로 조합되지 않는다. |
| Solution | DB `font-size / line-height / letter-spacing` 토큰을 직접 읽는 `generators/text/` 모듈 신설. `TypographyPayload` 독립 타입으로 Button generator 패턴 재사용. |
| Function UX Effect | 개발자가 `<Text size="display-xl" weight="semibold" color="primary" as="h1">` 형태로 디자인 토큰 1:1 대응 컴포넌트 사용. `srOnly`, `truncate`, `align`, `wrap` 접근성 props 포함. |
| Core Value | 플러그인 재추출 없이 수집된 Typography 토큰에서 생성. `tsx-builder.ts` 분기 금지 원칙 준수. CSS 값은 rem 단위(WCAG 1.4.4). |

---

## Overview

| 항목 | 내용 |
|------|------|
| Feature | text-component-generator |
| Goal | DB Typography 토큰 → `Text.tsx` + `Text.module.css` 자동 생성 |
| Core Value | 토큰 기반 생성, 접근성 props, dual font-family, tsx-builder 미사용 |
| Updated | 2026-04-13 |

---

## 1. 입력 데이터 분석

### 1-1. DB 토큰 구조

Button generator는 `NormalizedPayload`(COMPONENT_SET variants)를 입력으로 받지만,
Text generator는 **DB `tokens` 테이블**에서 직접 typography 토큰을 읽는다.

```
token.name         token.type  token.raw   → CSS 출력
─────────────────────────────────────────────────────
Font size/text-xs  dimension   12px        --font-size-text-xs: 0.75rem
Font size/text-sm  dimension   14px        --font-size-text-sm: 0.875rem
...
Font size/display-2xl dimension 72px       --font-size-display-2xl: 4.5rem

Line height/text-xs dimension  18px        --line-height-text-xs: 1.125rem
...

Letter spacing/display-2xl dimension -1.44px  --letter-spacing-display-2xl: -1.44px
(letter-spacing은 px 유지 — em 변환은 Phase 2)
```

### 1-2. 11개 size 목록 (Figma 원본 순서)

```
display-2xl  display-xl  display-lg  display-md  display-xs
text-xl  text-lg  text-md  text-sm  text-xs
```

> 총 10개. plan에서 11개로 명시했으나 실제 Untitled UI v8은 10개.
> token-resolver에서 DB 조회 결과를 그대로 사용하므로 하드코딩 없음.

### 1-3. Dual font-family 규칙

| 스케일 | CSS 변수 | 기본값 |
|--------|----------|--------|
| `display-*` | `--font-family-display` | Inter |
| `text-*` | `--font-family-body` | Inter |

---

## 2. 아키텍처 설계

### 2-1. 파일 구조

```
src/lib/component-generator/
├── generators/
│   ├── registry.ts              ← 변경 없음
│   ├── button/
│   └── text/                   ← 신설
│       ├── index.ts             ← generateText() 메인
│       └── token-resolver.ts   ← DB → TypographyPayload 변환
├── types.ts                    ← TypographyPayload + WarningCode 추가

src/lib/actions/components.ts   ← generateTextComponentAction() 추가

src/app/(main)/(ide)/components/AddComponentModal.tsx
  ← "토큰 기반 생성" 탭 추가 (기존 JSON 탭과 병렬)
```

### 2-2. 타입 정의 (`types.ts` 추가)

```ts
// ── Text 컴포넌트 전용 ────────────────────────────────────────
export interface TypographySizeToken {
  fontSize: string           // rem  (e.g. '4.5rem')
  lineHeight: string         // rem
  letterSpacing?: string     // px   (e.g. '-1.44px')
  fontFamily: 'display' | 'body'
}

export interface TypographyPayload {
  name: string               // 'Text'
  sizes: string[]            // ['display-2xl', ..., 'text-xs']
  weights: string[]          // ['regular', 'medium', 'semibold', 'bold']
  colorTokens: string[]      // ['primary', 'secondary', ...]  (--text-{colorToken})
  sizeTokenMap: Record<string, TypographySizeToken>
}

// WarningCode에 추가
// | 'TEXT_TOKEN_MISSING'      DB에 font-size 토큰 없음
// | 'TEXT_SIZE_BELOW_MIN'     font-size < 12px (WCAG 최소 권장)
```

### 2-3. token-resolver.ts

```ts
import { db } from '@/lib/db'
import { tokens } from '@/lib/db/schema'
import { getActiveProjectId } from '@/lib/db/active-project'
import { like, and, eq } from 'drizzle-orm'
import type { TypographyPayload, TypographySizeToken } from '../../types'

const DISPLAY_PREFIX_RE = /^display-/
const SIZE_ORDER = [
  'display-2xl', 'display-xl', 'display-lg', 'display-md', 'display-xs',
  'text-xl', 'text-lg', 'text-md', 'text-sm', 'text-xs',
]
const WEIGHTS = ['regular', 'medium', 'semibold', 'bold'] as const

export async function resolveTypographyPayload(): Promise<TypographyPayload> {
  const projectId = getActiveProjectId()

  // font-size 토큰 → size 목록 + rem 값 추출
  const fontSizeRows = await db.select()
    .from(tokens)
    .where(and(
      eq(tokens.projectId, projectId!),
      like(tokens.name, 'Font size/%'),
    ))

  // line-height 토큰
  const lineHeightRows = await db.select()
    .from(tokens)
    .where(and(
      eq(tokens.projectId, projectId!),
      like(tokens.name, 'Line height/%'),
    ))

  // letter-spacing 토큰 (없어도 무관)
  const letterSpacingRows = await db.select()
    .from(tokens)
    .where(and(
      eq(tokens.projectId, projectId!),
      like(tokens.name, 'Letter spacing/%'),
    ))

  // text-color 토큰 (--text-* 시맨틱)
  const colorRows = await db.select()
    .from(tokens)
    .where(and(
      eq(tokens.projectId, projectId!),
      like(tokens.name, 'Colors/Text/%'),
    ))

  // slug 추출 헬퍼: "Font size/text-xs" → "text-xs"
  function slug(name: string): string {
    return name.split('/').pop()!.toLowerCase().replace(/\s+/g, '-')
  }

  // px → rem
  function pxToRem(raw: string): string {
    const m = raw.match(/^(\d+(?:\.\d+)?)px$/)
    return m ? `${parseFloat(m[1]) / 16}rem` : raw
  }

  // 맵 구성
  const lineHeightMap = Object.fromEntries(
    lineHeightRows.map(r => [slug(r.name), pxToRem(r.raw ?? r.value)])
  )
  const letterSpacingMap = Object.fromEntries(
    letterSpacingRows.map(r => [slug(r.name), r.raw ?? r.value])
  )

  // size 목록 (SIZE_ORDER 순)
  const foundSizes = new Set(fontSizeRows.map(r => slug(r.name)))
  const sizes = SIZE_ORDER.filter(s => foundSizes.has(s))

  const sizeTokenMap: Record<string, TypographySizeToken> = {}
  for (const size of sizes) {
    const fsRow = fontSizeRows.find(r => slug(r.name) === size)
    sizeTokenMap[size] = {
      fontSize: pxToRem(fsRow?.raw ?? fsRow?.value ?? '1rem'),
      lineHeight: lineHeightMap[size] ?? '1.5rem',
      letterSpacing: letterSpacingMap[size],
      fontFamily: DISPLAY_PREFIX_RE.test(size) ? 'display' : 'body',
    }
  }

  // color token slug 추출: "Colors/Text/Primary" → "primary"
  const colorTokens = colorRows.map(r => slug(r.name))

  return {
    name: 'Text',
    sizes,
    weights: [...WEIGHTS],
    colorTokens: colorTokens.length > 0 ? colorTokens : ['primary', 'secondary', 'tertiary', 'disabled'],
    sizeTokenMap,
  }
}
```

### 2-4. generators/text/index.ts — generateText()

`NormalizedPayload` 대신 `TypographyPayload`를 받는 독립 함수.
`GeneratorOutput` 반환 타입은 동일.

```ts
import type { TypographyPayload, GeneratorOutput, GeneratorWarning } from '../../types'

export function generateText(payload: TypographyPayload): GeneratorOutput {
  const warnings: GeneratorWarning[] = []

  if (payload.sizes.length === 0) {
    warnings.push({ code: 'TEXT_TOKEN_MISSING', message: 'font-size 토큰이 없습니다. DB sync를 확인하세요.' })
  }

  const css = buildTextCSS(payload, warnings)
  const tsx = buildTextTSX(payload)

  return { name: 'Text', category: 'feedback', tsx, css, warnings }
}
```

**CSS 생성 (`buildTextCSS`)**:

```
1. Base rule (.root) — font-family-body, color: var(--text-primary), font-size/weight 초기화
2. Size rules — data-size='*' per size:
   - display-* → font-family-display override
   - font-size / line-height (rem)
   - letter-spacing (있을 때만)
3. Weight rules — data-weight='*' per weight (font-weight var)
4. Color rules — data-color='*' per colorToken (color: var(--text-{token}))
5. Align rules — data-align (left/center/right)
6. Wrap rules — data-wrap (balance/pretty/nowrap)
7. .truncate — overflow/text-overflow/white-space
8. .srOnly — VisuallyHidden 패턴
```

**TSX 생성 (`buildTextTSX`)**:

```tsx
// 생성되는 코드 구조 (template literal로 직접 생성)
export type TextSize = 'display-2xl' | 'display-xl' | ... | 'text-xs'
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold'
export type TextColor = 'primary' | 'secondary' | ...

interface TextProps extends React.HTMLAttributes<HTMLElement> {
  size?: TextSize
  weight?: TextWeight
  color?: TextColor
  as?: React.ElementType
  truncate?: boolean
  align?: 'left' | 'center' | 'right'
  wrap?: 'balance' | 'pretty' | 'nowrap'
  srOnly?: boolean
}

export function Text({ size = 'text-md', weight = 'regular', color = 'primary',
  as: Tag = 'p', truncate, align, wrap, srOnly, className, ...props }: TextProps) {
  const cls = [styles.root, truncate && styles.truncate, srOnly && styles.srOnly, className]
    .filter(Boolean).join(' ')
  return (
    <Tag
      className={cls}
      data-size={size}
      data-weight={weight}
      data-color={color}
      {...(align && { 'data-align': align })}
      {...(wrap && { 'data-wrap': wrap })}
      {...props}
    />
  )
}

export default Text  // file-writer.ts barrel과 호환 (export { default as Text })
```

### 2-5. registry.ts — 수정 없음

Text generator는 `importComponentFromJson` → `runPipeline` → `GENERATORS[resolvedType]` 경로를 전혀 거치지 않는다.
`GeneratorFn` 시그니처(`NormalizedPayload` 입력)와 `generateText`(`TypographyPayload` 입력)가 호환되지 않으며, 억지로 맞출 이유도 없다.

`registry.ts`는 변경 없음. Text generator는 독립 서버 액션에서만 호출된다.

### 2-6. 독립 서버 액션 (`actions/components.ts` 신규 함수)

Text generator는 플러그인 JSON 임포트(`importComponentFromJson`)를 거치지 않는다.
DB 토큰 → 생성의 별도 플로우가 필요하다.

```ts
// 기존 importComponentFromJson과 완전히 독립
export async function generateTextComponentAction(): Promise<{
  error: string | null
  component: ComponentRow | null
  regenerated: boolean   // 기존 존재 여부 (UI 피드백용)
}> {
  const project = db.select({ id: projects.id })
    .from(projects).orderBy(desc(projects.updatedAt)).limit(1).get()
  if (!project) return { error: '프로젝트 없음', component: null, regenerated: false }

  const { resolveTypographyPayload } = await import(
    '@/lib/component-generator/generators/text/token-resolver'
  )
  const { generateText } = await import('@/lib/component-generator/generators/text')

  const typographyPayload = await resolveTypographyPayload()
  const result = generateText(typographyPayload)

  // 기존 Text 컴포넌트 여부 (버튼 레이블 피드백용)
  const existing = db.select({ id: components.id, version: components.version })
    .from(components).where(eq(components.name, 'Text')).get()

  // DB upsert
  if (existing) {
    db.update(components).set({
      tsx: result.tsx,
      scss: result.css,
      version: (existing.version ?? 0) + 1,
      updatedAt: new Date(),
    }).where(eq(components.id, existing.id)).run()
  } else {
    // INSERT (menuOrder, category 등)
    ...
  }

  // 파일 쓰기 (file-writer 재사용)
  writeComponentFiles('Text', result.tsx, result.css)

  return { error: null, component: ..., regenerated: !!existing }
}
```

**UI 처리**: `regenerated: true`이면 "재생성 완료", `false`이면 "Text 컴포넌트 생성됨" 토스트 메시지.

---

## 3. CSS 상세 설계

### 3-1. Base + Size 규칙 (전체 예시)

```css
/* ── Base ── */
.root {
  font-family: var(--font-family-body, Inter);
  font-size: var(--font-size-text-md, 1rem);
  line-height: var(--line-height-text-md, 1.5rem);
  font-weight: var(--font-weight-regular, 400);
  color: var(--text-primary);
  margin: 0;
}

/* ── Size ── */
.root[data-size='display-2xl'] {
  font-family: var(--font-family-display, Inter);
  font-size: var(--font-size-display-2xl, 4.5rem);
  line-height: var(--line-height-display-2xl, 5.625rem);
  letter-spacing: -1.44px;
}
.root[data-size='display-xl'] {
  font-family: var(--font-family-display, Inter);
  font-size: var(--font-size-display-xl, 3.75rem);
  line-height: var(--line-height-display-xl, 4.5rem);
  letter-spacing: -1.2px;
}
/* ... display-lg ~ text-xs ... */

/* ── Weight ── */
.root[data-weight='medium']   { font-weight: var(--font-weight-medium, 500); }
.root[data-weight='semibold'] { font-weight: var(--font-weight-semibold, 600); }
.root[data-weight='bold']     { font-weight: var(--font-weight-bold, 700); }

/* ── Color ── */
.root[data-color='secondary']  { color: var(--text-secondary); }
.root[data-color='tertiary']   { color: var(--text-tertiary); }
.root[data-color='disabled']   { color: var(--text-disabled); }
/* primary는 base에서 처리 */

/* ── Align ── */
.root[data-align='left']   { text-align: left; }
.root[data-align='center'] { text-align: center; }
.root[data-align='right']  { text-align: right; }

/* ── Wrap ── */
.root[data-wrap='balance'] { text-wrap: balance; }
.root[data-wrap='pretty']  { text-wrap: pretty; }
.root[data-wrap='nowrap']  { white-space: nowrap; }

/* ── Truncate ── */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── sr-only (VisuallyHidden) ── */
.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### 3-2. font-weight fallback 값 (DB `--font-weight-*` 토큰 기반)

| weight | var | fallback |
|--------|-----|----------|
| regular | `--font-weight-regular` | 400 |
| medium | `--font-weight-medium` | 500 |
| semibold | `--font-weight-semibold` | 600 |
| bold | `--font-weight-bold` | 700 |

---

## 4. 구현 순서 (Do Phase)

### Phase 1 — 타입 확장 (5분)
1. `types.ts` — `TypographySizeToken`, `TypographyPayload` 인터페이스 추가
2. `types.ts` — `WarningCode`에 `'TEXT_TOKEN_MISSING' | 'TEXT_SIZE_BELOW_MIN'` 추가

### Phase 2 — token-resolver.ts (15분)
3. `generators/text/token-resolver.ts` 신설
4. `resolveTypographyPayload()` 구현 — DB 조회 + slug 추출 + rem 변환

### Phase 3 — generateText() (25분)
5. `generators/text/index.ts` 신설
6. `buildTextCSS()` — base + size + weight + color + align + wrap + truncate + srOnly
7. `buildTextTSX()` — 타입 union + TextProps + Text 함수 컴포넌트
   - **반드시 마지막에 `export default Text` 포함** — `file-writer.ts`가 생성하는 barrel이 `export { default as Text, type TextProps }`를 사용하므로 default export 없으면 TS 빌드 에러

### Phase 4 — 서버 액션 + UI (20분)
8. `actions/components.ts` — `generateTextComponentAction()` 신규 함수
9. `AddComponentModal.tsx` — "토큰 기반 생성" 탭 추가
   - Text 항목 카드: 설명 + [생성] / [재생성] 버튼
   - DB 폰트 토큰 없을 때 disabled + 안내 문구
10. 생성 완료 시 기존 `onCreated` 콜백으로 사이드바 갱신

### Phase 5 — 검증 (10분)
10. `npm run build` 통과
11. 개발 서버에서 Text 컴포넌트 생성 → 코드 미리보기 확인
12. Sandbox 렌더링 확인 (`as="h1"`, `srOnly`, `truncate`)

---

## 5. 의존성

| 의존 | 상태 |
|------|------|
| DB `tokens` 테이블 — `Font size/*` 토큰 존재 | ✅ 기존 sync 완료 |
| `--font-size-*` CSS 변수가 rem 단위 | ✅ css-generator.ts 픽스 완료 (2026-04-13) |
| `--font-weight-*` 토큰 (`regular/medium/semibold/bold`) | ✅ DB 존재 확인 |
| `--font-family-display`, `--font-family-body` 토큰 | ✅ tokens.css 존재 |
| `--text-primary` 등 semantic text color 토큰 | ✅ DB 존재 |

---

## 6. 성공 기준 (Design 기준)

- [ ] `TypographyPayload` 타입이 `NormalizedPayload`와 완전히 분리됨
- [ ] `generators/text/token-resolver.ts`가 DB 없이 단위 테스트 가능한 순수 함수 구조
- [ ] `generateText()` 출력 CSS에 `.srOnly`, `.truncate` 클래스 포함
- [ ] display 스케일 → `font-family-display`, text 스케일 → `font-family-body`
- [ ] `tsx-builder.ts` 미수정
- [ ] `registry.ts` GeneratorFn 시그니처 변경 없음 (어댑터 또는 액션 레이어 분기)
- [ ] `npm run build` 통과
