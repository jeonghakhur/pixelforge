## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | AvatarImage는 Figma COMPONENT_SET으로, `variantOptions`·`variants[]`·`componentProperties`를 동적으로 읽어 하드코딩 없이 TSX + CSS Module을 생성해야 한다. 초기 구현은 노드에 없는 값(aspect-ratio, width: 100%, disabled)을 생성기가 임의로 추가하고, 노드에 있는 값(width, height, align-self, align-items)을 누락하는 문제가 있었다. |
| **Solution** | **노드 데이터를 생성의 유일한 기준**으로 삼도록 생성기를 재정립. `variants[i].styles`에서 루트 스타일을, `childStyles['Image']`에서 이미지 height·align-self를, `componentProperties`에서 boolean prop을 직접 읽는다. 파생 계산(aspect-ratio 등)은 노드에 명시된 값이 있으면 사용하지 않는다. |
| **Function/UX Effect** | `AvatarImage.node.json` 임포트 → `<AvatarImage type src displayName jobTitle source />` TSX + data-attribute 기반 CSS Module 자동 생성. Figma 노드의 실제 치수(320px, 320px/440px)가 CSS에 그대로 반영된다. |
| **Core Value** | "노드 데이터 = 생성 기준"이라는 원칙을 확립. 이후 모든 전용 제너레이터는 이 원칙을 따른다. 생성기가 임의 판단을 하지 않으므로 Figma 설계 변경이 코드에 예측 가능하게 반영된다. |

---

# Plan — avatar-generator

> AvatarImage Figma COMPONENT_SET → TSX + CSS Module 범용 제너레이터

**작성**: 2026-04-16
**최종 업데이트**: 2026-04-16 (노드 데이터 기준 원칙 재정립 + 생성기 수정)
**상태**: Do (구현 완료)

---

## 1. 배경 및 현황

### 1-1. AvatarImage.node.json 구조 (COMPONENT_SET)

```
_Avatar image (COMPONENT_SET)
├── variantOptions: { "type": ["Square", "Portrait"] }
├── componentProperties:
│   └── "Source#3287:4621": { type: "BOOLEAN", defaultValue: true }
└── variants[]:
    ├── [type=Square]  — width:320, Image.height:320  → aspect-ratio: 1/1
    └── [type=Portrait] — width:320, Image.height:440 → aspect-ratio: 8/11
```

| 필드 | 값 | 의미 |
|------|-----|------|
| `meta.nodeType` | `"COMPONENT_SET"` | variants[] + variantOptions 완비 |
| `variantOptions` | `{ "type": ["Square", "Portrait"] }` | variant prop 이름 + 유니언 값 목록 |
| `componentProperties` | `{ "Source#3287:4621": BOOLEAN }` | 표시/숨김 boolean prop |
| `variants[].childStyles["Image"]` | `{ height: "320" }` / `{ height: "440" }` | 각 variant 이미지 높이 → aspect-ratio 계산 |

### 1-2. 버튼 생성기와 구조 비교

| 항목 | Button | AvatarImage |
|------|--------|-------------|
| Figma 노드 | COMPONENT_SET | COMPONENT_SET |
| variant 기준 | 시각 상태 (Primary/Secondary/Ghost) | 형태 (Square/Portrait) |
| boolean props | 없음 | `source` (Source 텍스트 표시 여부) |
| 이미지 처리 | 없음 | `<img>` + isSafeUrl 검증 |
| 핵심 CSS | bg·border·text-color (상태별) | aspect-ratio·border-radius (variant별) |

---

## 2. 목표 및 스코프

### 2-1. 목표

1. COMPONENT_SET payload를 동적으로 읽어 **하드코딩 없이** TSX + CSS Module 생성
2. `variantOptions` 첫 번째 키 → variant prop 이름 (`type`)
3. 각 variant 이미지 width/height → GCD로 aspect-ratio 계산
4. `componentProperties` BOOLEAN → boolean prop (`source`)
5. `#id` 접미사 제거 + 다단어 camelCase 변환 (`"Show Source"` → `"showSource"`)

### 2-2. In Scope

- `generators/avatar/extract.ts` — AvatarStyles 동적 추출
- `generators/avatar/index.ts` — TSX + CSS 생성
- `detect.ts` — `avatar` 패턴 + `figure` 요소
- `registry.ts` — `avatar: generateAvatar` 등록
- Sandbox SKIP 수정 — `ComponentGuideClient.tsx`에서 `'type'` 제거

### 2-3. Out of Scope

- Avatar Group (여러 아바타 겹치기) — Phase 2
- Circle 변형 (현재 COMPONENT_SET에 없음 — 추후 `/circle/i` 자동 감지 지원)
- 플러그인 수정

---

## 3. 핵심 원칙

### 3-0. 노드 데이터 기준 원칙

> **생성기는 노드 데이터를 생성의 유일한 기준으로 삼는다.**

| 구분 | 원칙 |
|------|------|
| 노드에 있는 값 | 그대로 읽어서 CSS에 반영 |
| 노드에 없는 값 | 생성기가 임의로 추가하지 않음 |
| 파생 계산 | 노드에 명시된 값이 있으면 파생 계산(aspect-ratio 등) 사용 금지 |
| 예외 허용 | HTML 렌더 보정(`display: block`), 보안(`isSafeUrl`), 빈 상태 UI (`background: var(--bg-secondary)`) |

**이 원칙을 위반하는 예 (수정 완료):**
- `aspect-ratio: 1/1` — GCD 계산으로 파생, 노드에 없는 값
- `width: 100%` — 노드의 `align-self: stretch`를 다른 값으로 대체
- `disabled` prop — 노드 `componentProperties`에 없는 값을 Sandbox SKIP에 포함

---

## 4. 기술 설계

### 4-1. 생성 TSX 컴포넌트 API (실제 구현)

```tsx
export type AvatarImageType = 'square' | 'portrait';  // variantOptions에서 동적 생성

export interface AvatarImageProps extends React.HTMLAttributes<HTMLElement> {
  src?: string;          // isSafeUrl 검증 (https?:// 또는 / 시작)
  displayName?: string;  // Name 텍스트
  jobTitle?: string;     // Source 텍스트
  type?: AvatarImageType;
  source?: boolean;      // componentProperties BOOLEAN 기반
}
```

**설계 근거:**
- `<figure>` + `<figcaption>` — 이미지+텍스트 시맨틱 구조
- `<img>` 태그 사용 — `src` 없을 때 `<div aria-hidden="true" />` 플레이스홀더
- `isSafeUrl()` — XSS 방지: `https?://` 또는 `/` 시작 URL만 허용
- `source` boolean prop — jobTitle 표시 여부 제어

### 3-2. 생성 CSS Module 구조 (실제 구현)

```css
.image {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;    /* 폴백: data-type 없거나 미인식 시 */
  object-fit: cover;
  background: var(--bg-secondary);
}

/* variant별 — variantOptions에서 동적 생성 */
.root[data-type='square'] .image {
  aspect-ratio: 1 / 1;       /* variants[0].width=320, Image.height=320 → GCD=320 → 1/1 */
  border-radius: var(--radius-md);
}
.root[data-type='portrait'] .image {
  aspect-ratio: 8 / 11;      /* variants[1].width=320, Image.height=440 → GCD=40 → 8/11 */
  border-radius: var(--radius-md);
}
/* circle 변형 감지 시: border-radius: 50% 자동 적용 */
```

### 3-3. 추출 로직 (extract.ts)

| 추출 대상 | 소스 | 방법 |
|-----------|------|------|
| variant prop 이름 | `variantOptions` 첫 번째 키 | `Object.keys(variantOptions)[0]` |
| 유니언 타입 값 목록 | `variantOptions[propName]` | 소문자 변환 → `slug` |
| 각 variant aspect-ratio | `variants[i].childStyles["Image"].height` + `variants[i].width` | GCD 약분 |
| border-radius | `slug`에 `circle` 포함 여부 | `/circle/i.test(slug)` → `'50%'` |
| boolean props | `componentProperties` BOOLEAN 항목 | `stripPropId` + `toCamelCase` |
| Name 텍스트 스타일 | `variants[0].childStyles["Name"]` | `mapCssValue` / `mapFontSizeValue` |
| Source 텍스트 스타일 | `variants[0].childStyles["Source"]` | + `text-decoration-line: underline` 감지 |

#### toCamelCase 구현 (다단어 지원)
```typescript
// "Source" → "source"
// "Show Source" → "showSource"
// "show-border" → "showBorder"
function toCamelCase(s: string): string {
  const words = s.trim().split(/[\s_-]+/)
  return words
    .map((w, i) => i === 0
      ? w.charAt(0).toLowerCase() + w.slice(1)
      : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
}
```

#### stripPropId 구현
```typescript
// "Source#3287:4621" → "Source"
function stripPropId(key: string): string {
  return key.replace(/#[^#]*$/, '').trim()
}
```

### 3-4. Sandbox 연동 수정

`ComponentGuideClient.tsx`의 `parseSandboxProps` SKIP 세트에서 `'type'` 제거:

```typescript
// BEFORE (버그): 'type'을 SKIP하면 AvatarImage variant prop이 Sandbox에 나타나지 않음
const SKIP = new Set(['disabled', 'children', 'className', 'type'])

// AFTER (수정): Button의 type='button'은 union/boolean이 아니라 자동 필터됨
const SKIP = new Set(['disabled', 'children', 'className'])
```

---

## 4. 파일 구조

```
src/lib/component-generator/
  generators/
    avatar/
      index.ts      ← buildAvatarCSS() + buildAvatarTSX() + generateAvatar()
      extract.ts    ← extractAvatarStyles() — AvatarStyles 동적 추출
    registry.ts     ← avatar: generateAvatar 등록
  detect.ts         ← avatar 패턴 + figure 요소

src/app/(main)/(ide)/components/[name]/
  ComponentGuideClient.tsx  ← SKIP 수정 ('type' 제거)

src/generated/components/AvatarImage/
  AvatarImage.tsx
  AvatarImage.module.css
  index.ts
```

---

## 5. 구현 순서 (완료)

| 순서 | 파일 | 작업 | 상태 |
|------|------|------|------|
| 1 | `generators/avatar/extract.ts` | AvatarStyles 동적 추출 (COMPONENT_SET 기반) | ✅ |
| 2 | `generators/avatar/index.ts` | generateAvatar() — CSS + TSX 생성 | ✅ |
| 3 | `detect.ts` | avatar 패턴 + figure element 추가 | ✅ |
| 4 | `generators/registry.ts` | `avatar: generateAvatar` 등록 | ✅ |
| 5 | `ComponentGuideClient.tsx` | SKIP 세트에서 `'type'` 제거 | ✅ |
| 6 | AvatarImage 파일 재생성 | COMPONENT_SET payload로 재임포트 | ✅ |

---

## 6. 버그 수정 이력

| 버그 | 원인 | 수정 |
|------|------|------|
| **SKIP 버그** | `parseSandboxProps` SKIP 세트에 `'type'` 포함 → Sandbox에서 variant 선택 불가 | SKIP에서 `'type'` 제거 |
| **DB nodeId 불일치** | 재생성 시 `figma_node_id`가 INSTANCE 값으로 남아 있음 | `UPDATE components SET figma_node_id = '933:30268'` |
| **CSS 폴백 미흡** | `.image` 기본 클래스에 `aspect-ratio` 없음 → `data-type` 미적용 시 높이 0 | `.image`에 `aspect-ratio: 1 / 1` 추가 |
| **toCamelCase 불완전** | 첫 글자만 소문자화 → 다단어 ("Show Source" → "show Source") 오변환 | `split(/[\s_-]+/)` 후 word-by-word camelCase |

---

## 7. 성공 기준

- [x] `AvatarImage.node.json` → `runPipeline()` → `AvatarImage.tsx` + `AvatarImage.module.css` 생성
- [x] `type='square'` → `aspect-ratio: 1/1` + `border-radius: var(--radius-md)`
- [x] `type='portrait'` → `aspect-ratio: 8/11` + `border-radius: var(--radius-md)`
- [x] circle 변형 감지 시 `border-radius: 50%` 자동 적용
- [x] `source` boolean prop — componentProperties BOOLEAN 기반 동적 생성
- [x] `isSafeUrl()` — `src` 없을 때 placeholder `<div>` 렌더
- [x] Name — `var(--text-primary)`, Source — `var(--text-tertiary)` + underline
- [x] `<figure>` + `<figcaption>` 시맨틱 구조
- [x] Sandbox에서 `type` variant 선택 컨트롤 표시
- [x] `npm run build` 성공, `npm run lint` 통과

---

## 8. 의존성

- `src/lib/component-generator/` 파이프라인 (완료)
- `css-var-mapper.ts` — `mapCssValue`, `mapFontSizeValue`, `mapLineHeightValue`, `mapFontWeightValue`
- 프로젝트 CSS 토큰: `--spacing-md`, `--text-primary`, `--text-tertiary`, `--font-size-text-*`, `--line-height-text-*`, `--radius-md`, `--bg-secondary`
