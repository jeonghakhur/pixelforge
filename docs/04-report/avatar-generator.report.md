# Report — avatar-generator (노드 기준 원칙 감사 및 수정)

**작성**: 2026-04-16
**대상**: `src/lib/component-generator/generators/avatar/`

---

## 1. 감사 배경

아바타 생성기 초기 구현 완료 후 두 가지 문제가 제기됨:

1. **`disabled`가 SKIP에 포함된 근거** — 노드에 없는 prop인데 왜 생성기가 판단을 추가했는가?
2. **이미지 크기가 적용되지 않은 이유** — 노드에 `width: 320px`, `height: 320px/440px`가 명시되어 있는데 반영이 안 됨

이를 계기로 노드 데이터 기준 적합성 전수 감사를 실시함.

---

## 2. 노드 데이터 (감사 기준)

`AvatarImage.node.json`에서 실제로 읽을 수 있는 값:

```
variants[0] type=Square
  styles:
    display: flex
    width: 320px           ← 루트 고정 너비
    flex-direction: column
    align-items: flex-start ← 루트 정렬
    gap: var(--spacing-md)
  childStyles:
    Image:
      height: 320px        ← 이미지 높이 (Square)
      align-self: stretch  ← 이미지 너비 제어
      background: var(--avatar-user-square-olivia-rhye, ...)
    Text and supporting text:
      display: flex / flex-direction: column
      align-items: flex-start / align-self: stretch
    Text and supporting text > Name:
      align-self: stretch
      color: var(--text-primary)
      font-size: var(--font-size-text-lg, 18px)
      font-weight: 500
      line-height: var(--line-height-text-lg, 28px)
    Text and supporting text > Source:
      align-self: stretch
      color: var(--text-tertiary)
      font-size: var(--font-size-text-md, 16px)
      font-weight: 400
      line-height: var(--line-height-text-md, 24px)
      text-decoration-line: underline

variants[1] type=Portrait
  Image.height: 440px      ← 이미지 높이 (Portrait)
  (나머지 루트 스타일 동일)

componentProperties:
  "Source#3287:4621": { type: BOOLEAN, defaultValue: true }
  ← disabled 없음
```

---

## 3. 감사 결과

### 3-1. CSS 누락·오류 항목

| CSS 속성 | 노드 값 | 초기 생성 값 | 판정 |
|----------|---------|-------------|------|
| `.root` `width` | `320px` | 없음 | ❌ 누락 |
| `.root` `align-items` | `flex-start` | 없음 | ❌ 누락 |
| `.image` `align-self` | `stretch` | 없음 | ❌ 누락 |
| `.image` `width` | 없음 (align-self로 처리) | `width: 100%` | ❌ 노드에 없는 값 추가 |
| `.image` `aspect-ratio` (base) | 없음 | `aspect-ratio: 1 / 1` | ❌ 파생 계산값 추가 |
| variant `.image` `height` | `320px` / `440px` | 없음 | ❌ 누락 |
| variant `.image` `aspect-ratio` | 없음 | `1 / 1` / `8 / 11` | ❌ GCD 파생값 추가 |
| `.caption` `align-self` | `stretch` | 없음 | ❌ 누락 |
| `.caption` `align-items` | `flex-start` | 없음 | ❌ 누락 |
| `.name` `align-self` | `stretch` | 없음 | ❌ 누락 |
| `.source` `align-self` | `stretch` | 없음 | ❌ 누락 |

### 3-2. Sandbox SKIP 오류 항목

| 항목 | 노드 여부 | 초기 구현 | 판정 |
|------|----------|----------|------|
| `disabled` | componentProperties에 없음 | SKIP에 포함 | ❌ 노드 근거 없는 추가 |

### 3-3. 문제 없는 항목 (노드 근거 있거나 허용 예외)

| 항목 | 분류 | 근거 |
|------|------|------|
| `display: block` on `.image` | HTML 보정 | `<img>`는 기본 inline — block 보정 필요 |
| `object-fit: cover` | 번역 | Figma `background: ... / cover` → `<img>` 등가 변환 |
| `background: var(--bg-secondary)` | 빈 상태 UI | src 없을 때 placeholder (명시적 설계 결정) |
| `isSafeUrl()` | 보안 | XSS 방지 |
| `displayName` / `jobTitle` prop 이름 | 번역 | Figma 레이어명을 JSX 친화적으로 변환 |
| `source` boolean prop | 노드 기반 | componentProperties BOOLEAN |
| variant prop `type`, union `'square' \| 'portrait'` | 노드 기반 | variantOptions 직접 읽음 |

---

## 4. 수정 내역

### 4-1. `extract.ts`

| 변경 항목 | 수정 전 | 수정 후 |
|-----------|---------|---------|
| `gcd()` / `computeAspectRatio()` | 있음 | 삭제 — 파생 계산 제거 |
| `VariantDimension.aspectRatio` | `string` | `imageHeight: string` (노드 직접값) |
| `AvatarStyles.rootWidth` | 없음 | `variants[0].styles['width']` |
| `AvatarStyles.rootAlignItems` | 없음 | `variants[0].styles['align-items']` |
| `AvatarStyles.rootGap` | 없음 | `variants[0].styles['gap']` |
| `AvatarStyles.imageAlignSelf` | 없음 | `Image.childStyles['align-self']` |
| `AvatarStyles.captionAlignSelf` | 없음 | caption 컨테이너 `align-self` |
| `AvatarStyles.captionAlignItems` | 없음 | caption 컨테이너 `align-items` |
| `TextStyle.alignSelf` | 없음 | Name / Source `align-self` |

### 4-2. `index.ts` — CSS 생성

| CSS 블록 | 수정 전 | 수정 후 |
|----------|---------|---------|
| `.root` | `flex; column; gap` | `flex; width(노드); column; align-items(노드); gap(노드)` |
| `.image` | `block; width:100%; aspect-ratio; object-fit; background` | `block; align-self(노드); object-fit; background` |
| variant `.image` | `aspect-ratio; border-radius` | `height(노드); border-radius` |
| `.caption` | `flex; column` | `flex; column; align-self(노드); align-items(노드)` |
| `.name` / `.source` | color, font-* | + `align-self(노드)` |

### 4-3. 생성 파일 갱신

`src/generated/components/AvatarImage/AvatarImage.module.css` 재생성

---

## 5. 수정 후 CSS 최종 출력

```css
.root {
  display: flex;
  width: 320px;            /* 노드: variants[0].styles.width */
  flex-direction: column;
  align-items: flex-start; /* 노드: variants[0].styles.align-items */
  gap: var(--spacing-md);
}

.image {
  display: block;           /* HTML 보정 */
  align-self: stretch;      /* 노드: Image.align-self */
  object-fit: cover;        /* 번역: Figma background/cover */
  background: var(--bg-secondary);
}

.root[data-type='square'] .image {
  height: 320px;            /* 노드: Image.height */
  border-radius: var(--radius-md);
}

.root[data-type='portrait'] .image {
  height: 440px;            /* 노드: Image.height */
  border-radius: var(--radius-md);
}

.caption {
  display: flex;
  flex-direction: column;
  align-self: stretch;      /* 노드: caption.align-self */
  align-items: flex-start;  /* 노드: caption.align-items */
}

.name {
  align-self: stretch;      /* 노드: Name.align-self */
  color: var(--text-primary);
  font-size: var(--font-size-text-lg, 1.125rem);
  font-weight: var(--font-weight-medium, 500);
  line-height: var(--line-height-text-lg, 1.75rem);
}

.source {
  align-self: stretch;      /* 노드: Source.align-self */
  color: var(--text-tertiary);
  font-size: var(--font-size-text-md, 1rem);
  font-weight: var(--font-weight-regular, 400);
  line-height: var(--line-height-text-md, 1.5rem);
  text-decoration: underline;
}
```

---

## 6. 확립된 원칙

이번 감사로 다음 원칙을 모든 전용 제너레이터에 적용한다:

| 원칙 | 내용 |
|------|------|
| **노드 직접값 우선** | 노드에 명시된 값은 파생 계산 없이 직접 사용 |
| **파생 계산 금지** | aspect-ratio 등 노드에 없는 값을 수식으로 만들지 않음 |
| **임의 추가 금지** | disabled 등 노드 데이터에 없는 prop·속성을 생성기가 추가하지 않음 |
| **예외 명시** | HTML 보정·보안·빈 상태 UI는 허용하되 코드 주석으로 근거를 명시 |

---

## 7. 잔여 과제

| 과제 | 설명 | 우선순위 |
|------|------|---------|
| Sandbox `disabled` 하드코딩 제거 | `ComponentGuideClient.tsx:538` — 노드에 없는 `disabled` 토글이 모든 컴포넌트에 표시됨 | 중 |
| button 생성기 동일 감사 | 같은 원칙으로 button 생성기 점검 필요 | 중 |
| 가이드 문서 원칙 추가 | `component-generator-guide.md`에 노드 기준 원칙 섹션 추가 | 하 |

---

## 8. 빌드 검증

```
✓ Compiled successfully in 4.2s
✓ Generating static pages (29/29)
```
