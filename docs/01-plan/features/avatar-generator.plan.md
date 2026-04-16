## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | AvatarImage는 COMPONENT_SET이 아닌 단일 INSTANCE 노드로, 기존 버튼 생성기의 variants 기반 파이프라인으로는 처리할 수 없다. 이미지 배경·텍스트 색상·shape(Square/Circle) 변형 로직이 별도로 필요하다. |
| **Solution** | Button 생성기와 동일한 registry 패턴으로 `generators/avatar/` 전용 제너레이터를 신설. INSTANCE payload에서 이미지 스타일·텍스트 토큰·shape variant를 추출해 TSX + CSS Module을 생성한다. |
| **Function/UX Effect** | `AvatarImage.node.json` 임포트 → `<AvatarImage src name role shape size />` TSX + data-attribute 기반 CSS Module 자동 생성. shape=square/circle, size=sm/md/lg 조합 지원. |
| **Core Value** | variants 없는 INSTANCE 컴포넌트 처리 패턴을 확립. 이후 Card, Media 등 이미지 컨테이너 계열 컴포넌트 생성기의 기반이 된다. |

---

# Plan — avatar-generator

> AvatarImage Figma INSTANCE → TSX + CSS Module 생성기

**작성**: 2026-04-16
**상태**: Plan

---

## 1. 배경 및 현황

### 1-1. AvatarImage.node.json 구조

```
_Avatar image (INSTANCE, 320×380)
├── Image (RECTANGLE)          — background-image CSS 변수
└── Text and supporting text (FRAME)
    ├── Name (TEXT)            — var(--text-primary), font-size-text-lg, fw 500
    └── Source (TEXT)          — var(--text-tertiary), font-size-text-md, fw 400, underline
```

| 필드 | 값 | 의미 |
|------|-----|------|
| `detectedType` | `"avatar"` | 플러그인 감지값 — 보정 불필요 |
| `radixProps.variant` | `"Square"` | shape 변형 힌트 (Square / Circle) |
| `meta.nodeType` | `"INSTANCE"` | COMPONENT_SET 아님 → `variants[]` 없음 |
| Image 배경 | `var(--avatar-user-square-olivia-rhye, url(...))` | CSS 변수 or 직접 URL |

### 1-2. 버튼 생성기와 차이

| 항목 | Button | AvatarImage |
|------|--------|-------------|
| Figma 노드 | COMPONENT_SET | INSTANCE |
| `variants[]` | 多 (상태별 스타일) | 없음 |
| 핵심 CSS 요소 | bg·border·text-color (상태별) | image·name·caption |
| 상태 처리 | hover/disabled/loading | 없음 |
| shape 변형 | 없음 | square(0) / circle(50%) |

---

## 2. 목표 및 스코프

### 2-1. 목표

1. `generators/avatar/` 전용 제너레이터 신설
2. `detect.ts` — `/avatar/i` 패턴 추가
3. `registry.ts` — `avatar: generateAvatar` 등록
4. INSTANCE payload에서 이미지·텍스트 스타일 추출
5. shape(square/circle), size(sm/md/lg) data-attribute 기반 TSX + CSS 생성

### 2-2. In Scope

- `generators/avatar/index.ts` — 메인 제너레이터
- `generators/avatar/extract.ts` — 이미지·텍스트 스타일 추출
- `detect.ts` 업데이트 (avatar 패턴 + figure 요소)
- `registry.ts` 등록
- 생성 출력: `AvatarImage.tsx` + `AvatarImage.module.css`

### 2-3. Out of Scope

- Figma COMPONENT_SET Avatar (아직 없음 — shape variants는 코드로 처리)
- 플러그인 수정
- Avatar Group (여러 아바타 겹치기) — Phase 2

---

## 3. 기술 설계

### 3-1. 생성 TSX 컴포넌트 API

```tsx
interface AvatarImageProps extends React.HTMLAttributes<HTMLElement> {
  src?: string                         // 이미지 URL (없으면 placeholder 배경)
  name?: string                        // 표시 이름 (Name 텍스트)
  role?: string                        // 직책/출처 (Source 텍스트)
  shape?: 'square' | 'circle'          // radixProps.variant 기반
  size?: 'sm' | 'md' | 'lg'           // 이미지 크기 (sm:160, md:240, lg:320)
}

export const AvatarImage = forwardRef<HTMLElement, AvatarImageProps>(
  ({ src, name, role, shape = 'square', size = 'md', className = '', ...props }, ref) => (
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
  )
)
```

**설계 근거:**
- `<figure>` + `<figcaption>` — 이미지+텍스트 시맨틱 구조
- 이미지는 `<div>` + `background-image` — Figma 출력과 일치, object-fit 제어 용이
- `role="img"` + `aria-label` — 접근성 보장
- `src` 없을 때 CSS placeholder background 적용

### 3-2. CSS Module 구조

```css
/* Base */
.root {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* Image */
.image {
  background: var(--surface-secondary) center / cover no-repeat;
  width: 100%;
  aspect-ratio: 1 / 1;
}

/* Shape */
.root[data-shape='circle'] .image {
  border-radius: 50%;
}
.root[data-shape='square'] .image {
  border-radius: var(--radius-md);
}

/* Size */
.root[data-size='sm'] .image { height: 160px; }
.root[data-size='md'] .image { height: 240px; }
.root[data-size='lg'] .image { height: 320px; }

/* Caption */
.caption {
  display: flex;
  flex-direction: column;
}

.name {
  color: var(--text-primary);
  font-size: var(--font-size-text-lg, 18px);
  font-weight: 500;
  line-height: var(--line-height-text-lg, 28px);
}

.source {
  color: var(--text-tertiary);
  font-size: var(--font-size-text-md, 16px);
  font-weight: 400;
  line-height: var(--line-height-text-md, 24px);
  text-decoration: underline;
}
```

### 3-3. 추출 로직 (extract.ts)

INSTANCE payload에서 추출할 항목:

| 추출 대상 | childStyles 키 | 추출 방법 |
|-----------|---------------|----------|
| 이미지 높이 | `Image` | `height` 값 → size 분류 |
| 이미지 배경 | `Image` | `background` → `var()` 또는 placeholder |
| Name 텍스트 색상 | `Text and supporting text > Name` | `color` |
| Name 폰트 크기 | 위 동일 | `font-size` → 토큰 slug |
| Source 텍스트 색상 | `Text and supporting text > Source` | `color` |
| Source 데코레이션 | 위 동일 | `text-decoration-line: underline` |
| shape | `radixProps.variant` | `"Square"` → `'square'` |

### 3-4. size 분류 로직

```typescript
// Image.height px → size slug
function classifyAvatarSize(height: string): 'sm' | 'md' | 'lg' {
  const px = parseInt(height)
  if (px <= 180) return 'sm'
  if (px <= 280) return 'md'
  return 'lg'
}
```

### 3-5. detect.ts 변경

```typescript
// 추가
if (/avatar/i.test(name))  return 'avatar'

// resolveElement 추가
case 'avatar': return 'figure'
```

---

## 4. 파일 구조

```
src/lib/component-generator/
  generators/
    avatar/
      index.ts      ← 메인 generateAvatar() 함수
      extract.ts    ← 이미지·텍스트 스타일 추출
    registry.ts     ← avatar 등록 (1줄 추가)
  detect.ts         ← avatar 패턴 + figure 요소 (2줄 추가)
```

생성 출력 경로:
```
src/generated/components/AvatarImage/
  AvatarImage.tsx
  AvatarImage.module.css
  index.ts
```

---

## 5. 구현 순서

| 순서 | 파일 | 작업 |
|------|------|------|
| 1 | `generators/avatar/extract.ts` | childStyles에서 이미지·텍스트·shape 추출 함수 |
| 2 | `generators/avatar/index.ts` | generateAvatar() — CSS + TSX 생성 |
| 3 | `detect.ts` | avatar 패턴 + figure element 추가 |
| 4 | `generators/registry.ts` | `avatar: generateAvatar` 등록 |
| 5 | 파이프라인 통합 확인 | `AvatarImage.node.json` → `runPipeline()` 실행 |

---

## 6. 성공 기준

- [ ] `AvatarImage.node.json` → `runPipeline()` → `AvatarImage.tsx` + `AvatarImage.module.css` 생성
- [ ] `shape='circle'` → `border-radius: 50%`, `shape='square'` → `var(--radius-md)`
- [ ] `size='sm'/'md'/'lg'` → 각각 160/240/320px 이미지 높이
- [ ] 이미지 배경: `src` prop → inline `background-image` style
- [ ] Name — `var(--text-primary)`, Source — `var(--text-tertiary)` + underline
- [ ] `<figure>` + `<figcaption>` 시맨틱 구조
- [ ] `GENERIC_FALLBACK` 경고 없음 (전용 제너레이터 사용)
- [ ] `npm run build` 성공, `npm run lint` 통과

---

## 7. 의존성

- 기존 `src/lib/component-generator/` 파이프라인 (완료)
- `css-var-mapper.ts` — `mapValue()` 재사용
- `generators/shared/tsx-builder.ts` — 미사용 (직접 생성, Text 패턴 유사)
- 프로젝트 CSS 토큰: `--spacing-md`, `--text-primary`, `--text-tertiary`, `--font-size-text-*`, `--radius-md`
