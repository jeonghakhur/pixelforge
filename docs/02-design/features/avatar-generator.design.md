# Design: Avatar Generator

_AvatarImage Figma INSTANCE → TSX + CSS Module 생성기_

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | AvatarImage는 INSTANCE 노드로 `variants[]`가 없어 버튼 생성기의 state/appearance 추출 로직을 사용할 수 없다. 이미지 배경·텍스트 토큰·shape 변형 처리가 별도 필요. |
| Solution | `generators/avatar/` 전용 모듈 신설. `detect.ts` + `registry.ts`에 2줄씩 추가해 기존 `importComponentFromJson` → `runPipeline` 경로를 그대로 활용. |
| Function UX Effect | `AvatarImage.node.json` 임포트 시 `<AvatarImage src name role shape size />` TSX + data-attribute CSS Module 자동 생성. DB 저장·파일 생성은 버튼과 동일 경로. |
| Core Value | variants 없는 INSTANCE 처리 패턴 확립 → Card·Media 계열 생성기 기반. `tsx-builder.ts` 미사용, 분기 금지 원칙 준수. |

---

## Overview

| 항목 | 내용 |
|------|------|
| Feature | avatar-generator |
| Plan | `docs/01-plan/features/avatar-generator.plan.md` |
| Goal | `AvatarImage.node.json` → `AvatarImage.tsx` + `AvatarImage.module.css` 자동 생성 |
| 진입점 | 버튼과 동일 — `importComponentFromJson` → `runPipeline` → `generateAvatar` |
| Updated | 2026-04-16 |

---

## 1. 입력 데이터 분석

### 1-1. AvatarImage.node.json 구조 요약

```
data.meta.nodeType = "INSTANCE"   ← COMPONENT_SET 아님 → variants[] = []
data.detectedType  = "avatar"     ← 플러그인 감지, 보정 불필요
data.radixProps    = { variant: "Square" }

data.childStyles:
  "Image"                               → 이미지 컨테이너
  "Text and supporting text"            → 캡션 래퍼
  "Text and supporting text > Name"     → 이름 텍스트
  "Text and supporting text > Source"   → 역할/출처 텍스트
```

### 1-2. childStyles에서 추출할 값

| childStyles 키 | 추출 필드 | 값 | 매핑 목표 |
|---------------|----------|-----|----------|
| `Image` | `height` | `"320px"` | size 분류 (sm/md/lg) |
| `Image` | `background` | `var(--avatar-..., url(...) ... cover ...)` | placeholder 배경 패턴 확인 |
| `Text and supporting text > Name` | `color` | `var(--text-primary)` | `.name` color |
| `Text and supporting text > Name` | `font-size` | `"18px"` | `mapFontSizeValue` → `var(--font-size-text-lg)` |
| `Text and supporting text > Name` | `font-weight` | `"500"` | `mapFontWeightValue` → `var(--font-weight-medium)` |
| `Text and supporting text > Name` | `line-height` | `"28px"` | `mapLineHeightValue` → `var(--line-height-text-lg)` |
| `Text and supporting text > Source` | `color` | `var(--text-tertiary)` | `.source` color |
| `Text and supporting text > Source` | `font-size` | `"16px"` | `var(--font-size-text-md)` |
| `Text and supporting text > Source` | `text-decoration-line` | `"underline"` | `text-decoration: underline` |

### 1-3. shape 분류

```
radixProps.variant = "Square"  →  shape = 'square'  →  border-radius: var(--radius-md)
                     "Circle"  →  shape = 'circle'  →  border-radius: 50%
```

### 1-4. size 분류 (Image.height 기준)

```typescript
function classifyAvatarSize(height: string): 'sm' | 'md' | 'lg' {
  const px = parseInt(height)
  if (px <= 180) return 'sm'   // ≤180px
  if (px <= 280) return 'md'   // 181–280px
  return 'lg'                   // 281px+ (Figma 원본 320px)
}
```

---

## 2. 아키텍처 설계

### 2-1. 파일 구조

```
src/lib/component-generator/
├── detect.ts                        ← avatar 패턴 + figure 요소 추가 (2줄)
├── generators/
│   ├── registry.ts                  ← avatar: generateAvatar 추가 (2줄)
│   └── avatar/                      ← 신설
│       ├── index.ts                 ← generateAvatar() 메인
│       └── extract.ts               ← childStyles 추출 함수들
```

생성 출력:
```
src/generated/components/_Avatar image/   ← Figma name 그대로 (file-writer 처리)
  AvatarImage.tsx
  AvatarImage.module.css
  index.ts
```

> `file-writer.ts`의 `resolveComponentPath`가 Figma name(`_Avatar image`)에서
> 마지막 세그먼트를 취해 디렉토리명을 결정한다.
> basename은 `extractComponentName`이 PascalCase로 변환 → `AvatarImage`.

### 2-2. detect.ts 변경 (2줄)

```typescript
// resolveType() 내부 — button 패턴 바로 다음에 추가
if (/avatar/i.test(name))   return 'avatar'

// resolveElement() switch — card 케이스 다음에 추가
case 'avatar':  return 'figure'
```

### 2-3. registry.ts 변경 (2줄)

```typescript
import { generateAvatar } from './avatar'

const GENERATORS: Record<string, GeneratorFn> = {
  button: generateButton,
  avatar: generateAvatar,   // ← 추가
}
```

---

## 3. extract.ts 설계

```typescript
/**
 * generators/avatar/extract.ts
 * AvatarImage childStyles에서 필요한 값 추출
 */

import { mapCssValue, mapFontSizeValue, mapLineHeightValue, mapFontWeightValue } from '../../css-var-mapper'

export interface AvatarStyles {
  /** CSS .image height (px) — size 분류에 사용 */
  imageHeight: string
  /** shape — radixProps.variant에서 */
  shape: 'square' | 'circle'
  /** 기본 size slug */
  defaultSize: 'sm' | 'md' | 'lg'
  name: {
    color: string
    fontSize: string
    fontWeight: string
    lineHeight: string
  }
  source: {
    color: string
    fontSize: string
    fontWeight: string
    lineHeight: string
    hasUnderline: boolean
  }
}

export function extractAvatarStyles(
  childStyles: Record<string, Record<string, string>>,
  radixProps: Record<string, string>,
): AvatarStyles {
  const img = childStyles['Image'] ?? {}
  const nameStyles = childStyles['Text and supporting text > Name'] ?? {}
  const sourceStyles = childStyles['Text and supporting text > Source'] ?? {}

  const imageHeight = img.height ?? '320px'
  const shape = (radixProps.variant ?? 'Square').toLowerCase() === 'circle' ? 'circle' : 'square'
  const defaultSize = classifySize(imageHeight)

  return {
    imageHeight,
    shape,
    defaultSize,
    name: {
      color:      mapCssValue(nameStyles.color ?? 'var(--text-primary)'),
      fontSize:   mapFontSizeValue(nameStyles['font-size'] ?? '18px'),
      fontWeight: mapFontWeightValue(nameStyles['font-weight'] ?? '500'),
      lineHeight: mapLineHeightValue(nameStyles['line-height'] ?? '28px'),
    },
    source: {
      color:        mapCssValue(sourceStyles.color ?? 'var(--text-tertiary)'),
      fontSize:     mapFontSizeValue(sourceStyles['font-size'] ?? '16px'),
      fontWeight:   mapFontWeightValue(sourceStyles['font-weight'] ?? '400'),
      lineHeight:   mapLineHeightValue(sourceStyles['line-height'] ?? '24px'),
      hasUnderline: sourceStyles['text-decoration-line'] === 'underline',
    },
  }
}

function classifySize(height: string): 'sm' | 'md' | 'lg' {
  const px = parseInt(height)
  if (px <= 180) return 'sm'
  if (px <= 280) return 'md'
  return 'lg'
}
```

---

## 4. generators/avatar/index.ts 설계

### 4-1. generateAvatar() 전체 흐름

```
extractAvatarStyles(childStyles, radixProps)
  ↓
buildAvatarCSS(styles)     → .module.css 문자열
buildAvatarTSX(name, styles) → .tsx 문자열
  ↓
return GeneratorOutput { name, category: 'feedback', tsx, css, warnings }
```

### 4-2. 생성 TSX (template literal)

```tsx
import styles from './AvatarImage.module.css'
import { forwardRef } from 'react'

export interface AvatarImageProps extends React.HTMLAttributes<HTMLElement> {
  src?: string
  name?: string
  role?: string
  shape?: 'square' | 'circle'
  size?: 'sm' | 'md' | 'lg'
}

export const AvatarImage = forwardRef<HTMLElement, AvatarImageProps>(
  (
    {
      src,
      name,
      role,
      shape = '{defaultShape}',
      size = '{defaultSize}',
      className = '',
      ...props
    },
    ref,
  ) => (
    <figure
      ref={ref}
      data-shape={shape}
      data-size={size}
      className={`${styles.root}${className ? ` ${className}` : ''}`}
      {...props}
    >
      <div
        className={styles.image}
        style={src ? { backgroundImage: `url(${src})` } : undefined}
        role="img"
        aria-label={name}
      />
      {(name || role) && (
        <figcaption className={styles.caption}>
          {name && <span className={styles.name}>{name}</span>}
          {role && <span className={styles.source}>{role}</span>}
        </figcaption>
      )}
    </figure>
  ),
)

AvatarImage.displayName = 'AvatarImage'

export default AvatarImage
```

> `{defaultShape}`, `{defaultSize}`는 생성 시 `extract.ts`에서 추출한 값으로 치환.

### 4-3. 생성 CSS Module

```css
/**
 * AvatarImage.module.css
 * source: Figma INSTANCE (variants 없음, childStyles 기반)
 */

/* ── Base ── */
.root {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* ── Image ── */
.image {
  width: 100%;
  background: var(--surface-secondary) center / cover no-repeat;
  aspect-ratio: 1 / 1;
}

/* ── Shape ── */
.root[data-shape='circle'] .image {
  border-radius: 50%;
}
.root[data-shape='square'] .image {
  border-radius: var(--radius-md);
}

/* ── Size ── */
.root[data-size='sm'] .image { height: 160px; }
.root[data-size='md'] .image { height: 240px; }
.root[data-size='lg'] .image { height: 320px; }

/* ── Caption ── */
.caption {
  display: flex;
  flex-direction: column;
}

/* ── Name ── */
.name {
  color: {name.color};
  font-size: {name.fontSize};
  font-weight: {name.fontWeight};
  line-height: {name.lineHeight};
}

/* ── Source ── */
.source {
  color: {source.color};
  font-size: {source.fontSize};
  font-weight: {source.fontWeight};
  line-height: {source.lineHeight};
  text-decoration: underline;   /* hasUnderline=true일 때만 포함 */
}
```

> `{name.color}` 등은 생성 시 `extractAvatarStyles`의 결과값으로 치환.
> `mapCssValue` / `mapFontSizeValue` 등이 이미 `var(--*)` 형식으로 반환하므로
> 직접 삽입 가능. underline은 `hasUnderline` 플래그로 조건부 포함.

---

## 5. 전체 데이터 흐름

```
AvatarImage.node.json (UI 업로드)
  ↓
importComponentFromJson()          components.ts:192
  ↓
runPipeline(d)                     pipeline.ts
  ├─ normalize(d)                  → NormalizedPayload
  │    name: "AvatarImage"
  │    detectedType: "avatar"
  │    childStyles: { Image, ... }
  │    radixProps: { variant: "Square" }
  │    variants: []                ← INSTANCE이므로 빈 배열
  ├─ resolveType(payload)          detect.ts  → "avatar"
  ├─ resolveElement("avatar")      detect.ts  → "figure"
  └─ generateAvatar(payload, ctx)  avatar/index.ts
       ↓
       extractAvatarStyles(childStyles, radixProps)
       buildAvatarCSS(styles) + buildAvatarTSX(name, styles)
       ↓
       GeneratorOutput { tsx, css, warnings }
  ↓
DB INSERT/UPDATE (components 테이블)  components.ts:271
  ↓
writeComponentFiles("_Avatar image", tsx, css)   file-writer.ts
  → src/generated/components/_Avatar image/AvatarImage.tsx
  → src/generated/components/_Avatar image/AvatarImage.module.css
  → src/generated/components/_Avatar image/index.ts
```

---

## 6. 경고 코드

| 코드 | 발생 조건 | 처리 |
|------|-----------|------|
| `GENERIC_FALLBACK` | avatar 미감지 시 (발생 안 해야 함) | detect.ts 패턴 확인 |
| `UNMAPPED_COLOR` | `mapCssValue`가 hex 값 반환 | 경고만 — hex 그대로 사용 |

기존 `WarningCode` 추가 없음 — 현재 코드로 충분.

---

## 7. 구현 순서 (Do Phase)

| 순서 | 파일 | 작업 | 예상 소요 |
|------|------|------|----------|
| 1 | `generators/avatar/extract.ts` | `AvatarStyles` 타입 + `extractAvatarStyles()` | 15분 |
| 2 | `generators/avatar/index.ts` | `buildAvatarCSS()` + `buildAvatarTSX()` + `generateAvatar()` | 25분 |
| 3 | `detect.ts` | avatar 패턴 + figure element 추가 (2줄) | 2분 |
| 4 | `generators/registry.ts` | `avatar: generateAvatar` 추가 (2줄) | 2분 |
| 5 | 통합 검증 | 개발 서버에서 `AvatarImage.node.json` 임포트 → 생성 확인 | 10분 |
| 6 | `npm run build` + `npm run lint` | 타입·린트 검증 | 5분 |

---

## 8. 성공 기준

- [ ] `AvatarImage.node.json` 임포트 → `GENERIC_FALLBACK` 경고 없음 (전용 제너레이터 사용)
- [ ] 생성 TSX: `forwardRef` + `data-shape` + `data-size` + `figure` 요소
- [ ] `shape='circle'` → CSS `border-radius: 50%`, `shape='square'` → `var(--radius-md)`
- [ ] `size='sm'/'md'/'lg'` → 각각 `160px / 240px / 320px` 이미지 높이
- [ ] Name 색상 → `var(--text-primary)`, Source 색상 → `var(--text-tertiary)`
- [ ] Source `text-decoration: underline` 포함
- [ ] font-size / line-height → `mapFontSizeValue` / `mapLineHeightValue` 통해 토큰 변수로 출력
- [ ] DB 저장 + 파일 생성 (기존 버튼 경로와 동일)
- [ ] `tsx-builder.ts` 미수정
- [ ] `registry.ts` `GeneratorFn` 시그니처 변경 없음
- [ ] `npm run build` 성공, `npm run lint` 통과

---

## 9. 의존성

| 의존 | 상태 |
|------|------|
| `runPipeline` 단일 진입점 | ✅ 완료 (pipeline.ts) |
| `mapCssValue`, `mapFontSizeValue`, `mapLineHeightValue`, `mapFontWeightValue` | ✅ css-var-mapper.ts 존재 |
| `mapRadiusValue` (border-radius 토큰 매핑) | ✅ css-var-mapper.ts 존재 |
| `--spacing-md` CSS 변수 | ✅ tokens.css 정의됨 |
| `--radius-md` CSS 변수 | ✅ tokens.css 정의됨 |
| `--surface-secondary` CSS 변수 | ✅ tokens.css 정의됨 |
| `--text-primary`, `--text-tertiary` | ✅ tokens.css 정의됨 |
| `file-writer.ts` → `src/generated/components/` | ✅ 기존 동작 |
