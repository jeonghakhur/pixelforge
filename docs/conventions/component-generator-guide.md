# Component Generator — 직접 수정 가이드

> Figma 플러그인 JSON → TSX + CSS Module 자동 생성 파이프라인의 전체 구조와
> 각 파일을 어떻게 수정하면 되는지를 설명하는 레퍼런스.
>
> **이 파일은 새 제너레이터를 추가하거나 기존 제너레이터를 수정할 때마다 업데이트한다.**

---

## 0. 핵심 원칙 — 노드 데이터가 생성의 기준

> **생성기는 노드 데이터를 생성의 유일한 기준으로 삼는다.**
> 이 원칙을 지키지 않으면 Figma 설계 변경이 코드에 예측 불가능하게 반영된다.

| 구분 | 원칙 | 예시 |
|------|------|------|
| **노드에 있는 값** | 그대로 읽어서 CSS에 반영 | `Image.height: 320px` → `.image { height: 320px }` |
| **노드에 없는 값** | 생성기가 임의로 추가하지 않음 | `disabled`가 componentProperties에 없으면 생성하지 않음 |
| **파생 계산 금지** | 노드에 명시된 값이 있으면 수식으로 대체하지 않음 | `height: 320px` 있는데 `aspect-ratio: 1/1` 계산 금지 |
| **예외 허용 3가지** | 근거를 코드 주석으로 명시 | `display: block`(HTML보정), `isSafeUrl`(보안), placeholder(빈상태UI) |

**위반 사례 (avatar 생성기 초기 구현에서 발견):**
- `width: 100%` 추가 — 노드에 없는 값, `align-self: stretch`가 노드 값
- `aspect-ratio: 1/1` 추가 — GCD 계산으로 파생, 노드에는 `height: 320px` 명시
- `disabled` SKIP 추가 — componentProperties에 없는 prop을 생성기가 임의로 처리

**새 제너레이터를 작성하기 전에 반드시 노드 JSON을 열어 실제 값을 확인한다.**

---

## 0-1. Prop 이름 충돌 규칙

Figma 레이어 이름을 그대로 prop 이름으로 쓰면 HTML 속성 또는 동일 컴포넌트 내 다른 prop과 충돌하는 경우가 있다.  
**충돌 시 Figma 이름 대신 의미 기반 이름을 사용하고, 그 사유를 `index.ts` 주석에 명시한다.**

### 충돌 유형 1 — HTML 속성 충돌

`HTMLAttributes<HTMLElement>` (또는 `HTMLButtonElement` 등)에 이미 존재하는 이름은 사용하지 않는다.  
spread `{...props}` 시 의도치 않은 HTML 속성으로 넘어가기 때문이다.

| Figma 레이어 | 충돌 원인 | 대체 이름 |
|-------------|-----------|-----------|
| `Name` | `HTMLAttributes.name` (input, form 등의 HTML 속성) | `displayName` |

> **확인 방법**: 쓰려는 이름이 `lib.dom.d.ts`의 `HTMLAttributes` 또는 대상 요소 타입에 정의되어 있으면 충돌.

### 충돌 유형 2 — 동일 컴포넌트 내 prop 이름 충돌

`componentProperties`에서 추출한 boolean prop 이름과 텍스트 레이어 이름이 동일하면 인터페이스에서 타입 충돌이 발생한다.

| Figma 레이어 | 충돌 원인 | 대체 이름 |
|-------------|-----------|-----------|
| `Source` (텍스트) | `componentProperties`의 `"Source#…"` → boolean prop `source`와 동일 | `jobTitle` |

> **확인 방법**: `booleanProps[].propName` 목록과 텍스트 레이어 이름을 비교.  
> 겹치면 텍스트 레이어의 **실제 용도**를 기준으로 이름을 정한다.

### 주의: boolean prop이 제어하는 대상 확인

`componentProperties`는 prop 이름과 타입만 내보내며, 어느 레이어의 visibility를 제어하는지는 포함되지 않는다.  
prop 이름에서 동작을 추론하면 버그로 이어진다. **반드시 Figma에서 해당 prop을 껐을 때 어느 레이어가 숨겨지는지 직접 확인한다.**

| 확인 없이 추론한 경우 (잘못) | 확인 후 (올바름) |
|----------------------------|-----------------|
| `source` → jobTitle 텍스트만 숨김 | `source` → figcaption 전체(Name + Source) 숨김 |

---

## 1. 전체 흐름 한눈에 보기

```
Figma 플러그인 JSON
        │
        ▼
  normalize.ts          → 필드 정제, PascalCase 이름, 빈값 채움
        │
        ▼
  detect.ts             → 컴포넌트 이름으로 타입 결정 ("button", "avatar", ...)
        │
        ▼
  generators/registry.ts → 타입에 맞는 전용 제너레이터 선택
        │                   없으면 generic.ts 폴백 (GENERIC_FALLBACK 경고)
        ▼
  generators/{type}/
    extract.ts          → Figma 데이터에서 스타일·props 추출
    index.ts            → TSX 코드 + CSS Module 코드 문자열 생성
        │
        ▼
  file-writer.ts        → src/generated/components/{Name}/ 에 파일 저장
                          + DB 컴포넌트 레코드 upsert
```

---

## 2. 파일별 역할과 수정 포인트

### 2-1. `detect.ts` — 컴포넌트 타입 감지

**파일 경로**: `src/lib/component-generator/detect.ts`

**역할**: 컴포넌트 이름을 보고 어떤 제너레이터를 쓸지 결정한다.

```typescript
// ↓ 새 컴포넌트 타입을 추가하려면 여기에 한 줄 추가
if (/card|panel/i.test(name))   return 'card'
if (/avatar/i.test(name))       return 'avatar'
// └─ 컴포넌트 이름에 "avatar"가 포함되면 'avatar' 제너레이터 사용
```

**수정 시나리오**:
| 상황 | 수정 내용 |
|------|-----------|
| 새 컴포넌트 타입 추가 | `resolveType()`에 `if (/패턴/.test(name)) return 'new-type'` 추가 |
| HTML 요소 변경 | `resolveElement()`의 switch-case에 `case 'new-type': return 'section'` 추가 |
| 기존 패턴 변경 | 정규식 수정 (예: `badge`에 `chip`도 포함 → `/badge\|chip\|tag/i`) |

**현재 타입 → HTML 요소 매핑**:
| 타입 | HTML 요소 | 비고 |
|------|-----------|------|
| `button` | `<button>` | |
| `avatar` | `<figure>` | |
| `badge` | `<span>` | 전용 제너레이터 없음 (generic 폴백) |
| `input` | `<input>` | 전용 제너레이터 없음 (generic 폴백) |
| `card` | `<article>` | 전용 제너레이터 없음 (generic 폴백) |
| 기타 | `<div>` | generic 폴백 |

---

### 2-2. `generators/registry.ts` — 제너레이터 등록

**파일 경로**: `src/lib/component-generator/generators/registry.ts`

**역할**: 타입 문자열 → 전용 제너레이터 함수 매핑.

```typescript
const GENERATORS: Record<string, GeneratorFn> = {
  button: generateButton,   // ← detect.ts가 'button' 반환 시 이 함수 호출
  avatar: generateAvatar,   // ← detect.ts가 'avatar' 반환 시 이 함수 호출
  // card: generateCard,   ← 새 제너레이터 추가 시 여기에 등록
}
```

**수정 시나리오**:
새 제너레이터 `generators/card/index.ts`를 만들었다면:
1. `import { generateCard } from './card'` 추가
2. `GENERATORS`에 `card: generateCard` 추가
3. `detect.ts`에 패턴 추가 (2-1 참고)

---

### 2-3. `generators/{type}/extract.ts` — Figma 데이터 추출

**파일 경로 예시**:
- `src/lib/component-generator/generators/avatar/extract.ts`
- `src/lib/component-generator/generators/button/extract.ts`

**역할**: `NormalizedPayload`에서 컴포넌트별로 필요한 스타일·props 데이터를 뽑아낸다.

**수정 시나리오 (Avatar 기준)**:

| 수정하고 싶은 것 | 위치 |
|------------------|------|
| variant prop 이름 고정 변경 | `extractAvatarStyles()`의 `variantPropName` 로직 |
| 이미지 높이 읽는 방식 변경 | `dimensions` 배열의 `imageHeight` — `variants[i].childStyles['Image']['height']` |
| circle 감지 패턴 변경 | `/circle/i.test(slug)` → 원하는 패턴으로 |
| boolean prop 기본값 변경 | `booleanProps` 배열의 `defaultValue` |
| Name/Source 폰트 fallback 변경 | `extractAvatarStyles()` 하단의 `defaults` 객체 |

**입력 데이터 구조** (`NormalizedPayload`의 주요 필드):
```typescript
{
  name: string                          // "AvatarImage"
  variantOptions: { type: ['Square', 'Portrait'] }  // COMPONENT_SET variant 목록
  variants: [                           // 각 variant 상세 정보
    {
      properties: { type: 'Square' },
      width: 320,
      childStyles: { Image: { height: '320' }, Name: { color: 'var(--text-primary)', ... } }
    }
  ]
  componentProperties: {               // Boolean/Text/InstanceSwap props
    'Source#3287:4621': { type: 'BOOLEAN', defaultValue: true }
  }
  childStyles: { ... }                 // 루트 수준 자식 스타일
}
```

---

### 2-4. `generators/{type}/index.ts` — TSX + CSS 코드 생성

**파일 경로 예시**:
- `src/lib/component-generator/generators/avatar/index.ts`
- `src/lib/component-generator/generators/button/index.ts`

**역할**: `extract.ts`가 준비한 데이터로 실제 코드 문자열을 만든다.

**두 함수로 구성**:

```typescript
// 1. CSS Module 코드 생성
function buildAvatarCSS(name: string, s: AvatarStyles): string {
  // 템플릿 문자열로 .module.css 내용 반환
}

// 2. TSX 컴포넌트 코드 생성
function buildAvatarTSX(componentName: string, s: AvatarStyles): string {
  // 템플릿 문자열로 .tsx 내용 반환
}
```

**수정 시나리오 (Avatar 기준)**:

| 수정하고 싶은 것 | 위치 |
|------------------|------|
| 생성되는 CSS 기본 구조 변경 | `buildAvatarCSS()`의 템플릿 문자열 |
| `.image` 기본 스타일 변경 | `buildAvatarCSS()` 내 `.image { ... }` 블록 |
| variant별 CSS 규칙 추가 | `variantRules` 생성 로직 |
| TSX props 인터페이스 변경 | `buildAvatarTSX()` 내 `interface ${componentName}Props` 부분 |
| isSafeUrl 로직 변경 | `buildAvatarTSX()` 내 `isSafeUrl` 상수 문자열 |
| figcaption 조건 변경 | `captionCondition` 변수 |

---

### 2-5. `css-var-mapper.ts` — Figma 값 → 토큰 변수 변환

**파일 경로**: `src/lib/component-generator/css-var-mapper.ts`

**역할**: Figma가 넘겨준 픽셀 값·색상 변수를 프로젝트 CSS 토큰으로 변환한다.

| 함수 | 입력 예 | 출력 예 |
|------|---------|---------|
| `mapCssValue()` | `var(--colors-brand-600)` | `var(--bg-brand-solid)` |
| `mapRadiusValue()` | `"8px"` | `var(--radius-md, 8px)` |
| `mapSpacingValue()` | `"16px"` | `var(--spacing-md, 16px)` |
| `mapFontSizeValue()` | `"16px"` | `var(--font-size-text-md, 1rem)` |
| `mapLineHeightValue()` | `"24px"` | `var(--line-height-text-md, 1.5rem)` |
| `mapFontWeightValue()` | `"600"` | `var(--font-weight-semibold, 600)` |

**수정 시나리오**:
- 색상 매핑 규칙 변경 → `mapCssValue()` 내부 분기 수정
- 새 spacing 토큰 추가 → `tokens.css` 업데이트로 자동 반영 (동적 파싱)
- 특정 px 값을 특정 변수에 고정 매핑 → `buildRadiusMap()` / `buildSpacingMap()` 내 예외 처리 추가

---

### 2-6. `normalize.ts` — 플러그인 payload 정제

**파일 경로**: `src/lib/component-generator/normalize.ts`

**역할**: 플러그인이 보내는 raw JSON을 일관된 `NormalizedPayload` 형태로 변환.
- `undefined` 필드를 빈 객체/배열로 초기화
- 컴포넌트 이름을 PascalCase로 강제
- 레거시 필드 이름 호환 처리

**수정 시나리오**:
- 플러그인이 새 필드를 추가했을 때 → `normalize()` 함수에 필드 추가
- 이름 변환 규칙 변경 → `toPascalCase()` 헬퍼 수정

---

### 2-7. `types.ts` — 타입 정의

**파일 경로**: `src/lib/component-generator/types.ts`

**역할**: 파이프라인 전체에서 사용하는 TypeScript 인터페이스 정의.

**주요 타입**:
| 타입 | 설명 |
|------|------|
| `PluginPayload` | 플러그인이 보내는 raw 데이터 형태 |
| `NormalizedPayload` | normalize 후 타입 (optional 없음) |
| `VariantEntry` | COMPONENT_SET의 각 variant 정보 |
| `ComponentPropertyDef` | componentProperties의 각 항목 |
| `GeneratorOutput` | 생성기가 반환하는 TSX + CSS |
| `GeneratorWarning` | 경고 코드 + 메시지 |

**수정 시나리오**:
- 플러그인 payload에 새 필드 추가 → `PluginPayload`와 `NormalizedPayload` 모두 수정
- 새 경고 코드 추가 → `WarningCode` 유니언에 추가

---

### 2-8. `ComponentGuideClient.tsx` — Sandbox UI 연동

**파일 경로**: `src/app/(main)/(ide)/components/[name]/ComponentGuideClient.tsx`

**역할**: 생성된 컴포넌트를 브라우저에서 대화형으로 미리보기.
생성된 TSX 코드를 파싱해서 props 컨트롤을 자동으로 만든다.

**주요 파싱 함수**:

| 함수 | 역할 |
|------|------|
| `parseSandboxProps()` | TSX에서 prop 목록 추출, SKIP 필터 적용 |
| `parseAllUnionTypes()` | `export type XxxType = 'a' \| 'b';` → 드롭다운 |
| `parseDestructuredProps()` | `({ prop = default }` → 기본값 추출 |

#### Sandbox Property 테이블 렌더 규칙

생성된 TSX를 파싱해 Property 테이블을 채운다. 렌더 순서와 각 행의 출처를 이해해야 불필요한 수정을 줄일 수 있다.

| 행 | 출처 | 렌더 조건 |
|----|------|-----------|
| union props (드롭다운) | `export type` + interface | 항상 (SKIP 제외) |
| node props (ReactNode 입력) | interface `ReactNode` 타입 | 항상 (SKIP 제외) |
| string props (텍스트 입력) | interface `string` 타입 | 항상 (SKIP 제외) |
| boolean props (체크박스) | destructuring 기본값 `true`/`false` | 항상 (SKIP 제외) |
| **`disabled` 행** | **하드코딩 — 파싱과 무관** | `state` union에 `"disabled"` 값이 없으면 **항상 표시** |

> **`disabled`는 모든 컴포넌트에 표시되는 것이 의도된 동작이다.**  
> AvatarImage처럼 `disabled` 개념이 없는 컴포넌트에도 표시된다.  
> 컴포넌트 속성 목록의 일관성을 위해 제거하지 않는다.  
> `disabled`를 숨기고 싶으면 `state` union에 `"disabled"` 값을 포함시키는 것이 유일한 방법이다.

#### Sandbox SKIP 세트

```typescript
// parseSandboxProps() 내부
const SKIP = new Set(['disabled', 'children', 'className'])
```

- `disabled`가 SKIP에 있어도 **테이블에는 여전히 표시된다** (하드코딩 행이 별도 존재).
- `SKIP`은 파싱 단계에서 prop을 배제할 뿐, 하드코딩 행(disabled)은 영향받지 않는다.
- ⚠️ `'type'`은 절대 추가하지 말 것 — AvatarImage의 variant prop(`type?: AvatarImageType`)과 충돌.

**수정 시나리오**:
- 특정 prop을 Property 테이블에서 숨기고 싶을 때 → `SKIP` 세트에 prop 이름 추가
- 새 컨트롤 타입 추가 (예: number slider) → `parseSandboxProps()` 반환 타입 및 렌더 로직 수정

---

### 2-9. `PropsEditor.tsx` — Props Editor 패널

**파일 경로**: `src/app/(main)/(ide)/components/[name]/PropsEditor.tsx`

**역할**: 생성된 컴포넌트의 prop 이름·타입·기본값을 UI에서 수정하고, `props_overrides` DB 컬럼에 저장 후 재생성한다.

#### Props Editor SKIP 세트

```typescript
// parseEditorProps() 내부
const SKIP = new Set(['children', 'className', 'disabled'])
```

Sandbox SKIP과 다르게 **`disabled`가 포함**되어 있다.  
Props Editor에서 `disabled` 편집을 허용하면 HTML 시맨틱이 깨질 수 있어 의도적으로 제외한다.

#### Props Editor vs Sandbox — SKIP 비교

| prop | Sandbox 테이블 | Props Editor |
|------|---------------|--------------|
| `disabled` | 항상 표시 (하드코딩) | 숨김 (SKIP) |
| `children` | 숨김 (SKIP), 별도 입력 | 숨김 (SKIP) |
| `className` | 숨김 (SKIP) | 숨김 (SKIP) |
| union props | 드롭다운으로 표시 | **숨김** (`union` 편집 미지원) |
| boolean props | 체크박스로 표시 | 체크박스로 표시 |
| string props | 텍스트 입력으로 표시 | 텍스트 입력으로 표시 |

> union props는 Props Editor에 표시되지 않는다 (`.filter(base => base.kind !== 'union')`).  
> variant 목록 변경은 Figma에서 수정 후 재임포트하는 것이 원칙이다.

---

## 3. 새 제너레이터 추가하는 절차

예시: `CardComponent` 제너레이터 추가

### Step 1 — `detect.ts`에 패턴 추가
```typescript
// detect.ts
if (/card|panel/i.test(name)) return 'card'   // 이미 있음 — 확인만
// resolveElement()에 추가
case 'card': return 'article'                  // 이미 있음 — 확인만
```

### Step 2 — `extract.ts` 작성
```
src/lib/component-generator/generators/card/extract.ts
```
- `extractCardStyles(payload, componentName)` 함수 작성
- `NormalizedPayload`에서 필요한 스타일 데이터 추출
- `css-var-mapper.ts` 함수들 재사용 (`mapCssValue`, `mapFontSizeValue` 등)

### Step 3 — `index.ts` 작성
```
src/lib/component-generator/generators/card/index.ts
```
- `buildCardCSS(name, styles)` 함수 작성
- `buildCardTSX(componentName, styles)` 함수 작성
- `generateCard(payload, ctx)` 함수 export

### Step 4 — `registry.ts`에 등록
```typescript
import { generateCard } from './card'

const GENERATORS = {
  button: generateButton,
  avatar: generateAvatar,
  card: generateCard,   // ← 추가
}
```

### Step 5 — 이 가이드 파일 업데이트
- 섹션 2-2의 타입 → HTML 요소 매핑 테이블 업데이트
- 섹션 4의 컴포넌트 목록 업데이트

---

## 4. 현재 등록된 컴포넌트 목록

| 컴포넌트 이름 | 타입 키 | 전용 제너레이터 | 생성 파일 경로 |
|--------------|---------|----------------|----------------|
| Button, ButtonDestructive | `button` | `generators/button/` | `src/generated/components/Button/` |
| AvatarImage | `avatar` | `generators/avatar/` | `src/generated/components/AvatarImage/` |
| Badge, Chip, Tag 계열 | `badge` | ❌ generic 폴백 | `src/generated/components/{Name}/` |
| Input, Field 계열 | `input` | ❌ generic 폴백 | `src/generated/components/{Name}/` |
| Card, Panel 계열 | `card` | ❌ generic 폴백 | `src/generated/components/{Name}/` |
| Modal, Dialog 계열 | `modal` | ❌ generic 폴백 | `src/generated/components/{Name}/` |
| Tab 계열 | `tabs` | ❌ generic 폴백 | `src/generated/components/{Name}/` |

> ❌ generic 폴백 = `GENERIC_FALLBACK` 경고가 붙고 기본 CSS/TSX만 생성됨.
> 제대로 된 출력을 원하면 전용 제너레이터를 만들어야 한다.

---

## 5. 자주 하는 수정 시나리오 치트시트

### "생성된 TSX의 prop 이름을 바꾸고 싶다"
→ 해당 `extract.ts`에서 반환 구조 수정 + `index.ts`의 TSX 템플릿 문자열 수정

### "생성되는 CSS에 hover 스타일을 추가하고 싶다"
→ 해당 `index.ts`의 `buildXxxCSS()` 함수 내 템플릿 문자열에 `:hover` 블록 추가

### "새 Figma 컴포넌트를 가져왔는데 GENERIC_FALLBACK 경고가 뜬다"
→ 4번 테이블에서 해당 타입에 전용 제너레이터가 없는 것. 3번 절차대로 추가.

### "Sandbox에서 특정 prop 컨트롤이 안 보인다"
→ `ComponentGuideClient.tsx`의 `SKIP` 세트 확인. 또는 TSX 코드에 세미콜론(`;`)이 빠진 것 (`parseAllUnionTypes` 정규식이 `;` 필요).

### "Sandbox Property 테이블에 disabled가 보이는데 이 컴포넌트랑 관계없다"
→ **의도된 동작이다.** `disabled`는 모든 컴포넌트에 항상 표시된다 (하드코딩 행, 2-8 참고).  
   숨기려면 `state` union에 `"disabled"` 값을 포함시키는 것이 유일한 방법.

### "Props Editor에서 특정 prop이 안 보인다"
→ `PropsEditor.tsx`의 `SKIP` 세트(`disabled`, `children`, `className`) 또는 union prop(`kind === 'union'`은 Props Editor에서 필터됨) 확인 (2-9 참고).

### "boolean prop이 컴포넌트의 의도와 다른 레이어를 숨긴다"
→ `generators/{type}/extract.ts`의 `captionGateProp` 로직 확인.  
   prop 이름으로 동작을 추론하지 않고, `nodeTree.propRefs.visible` → `booleanProps.rawKey` 역참조로 결정한다.  
   Figma에서 해당 prop을 껐을 때 어느 레이어가 숨겨지는지 직접 확인 후 플러그인 JSON에 `propRefs`가 올바르게 포함됐는지 검증한다.

### "색상 변수가 잘못 매핑된다"
→ `css-var-mapper.ts`의 `mapCssValue()` 분기 확인.
   또는 Settings > Generator의 시맨틱 맵 설정 확인.

### "이미지 높이가 이상하게 나온다"
→ `generators/avatar/extract.ts`의 `dimensions` 배열.
   `variants[i].childStyles['Image']['height']`를 노드에서 직접 읽는다.
   `aspect-ratio` 파생 계산은 하지 않는다 (원칙: 노드에 명시된 값 우선).

---

## 6. 파일 수정 후 체크리스트

- [ ] `npm run build` 성공
- [ ] `npm run lint` 통과
- [ ] 영향받는 컴포넌트를 Sandbox에서 직접 확인
- [ ] DB의 기존 컴포넌트 레코드가 오래된 내용이면 재임포트
- [ ] 이 가이드 파일의 4번 테이블 업데이트 (새 컴포넌트 추가 시)
