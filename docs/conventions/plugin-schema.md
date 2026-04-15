# Plugin → PixelForge 데이터 스키마 가이드

> 플러그인이 PixelForge 서버에 전송하는 JSON 구조 + 개선 요청 사항

---

## 1. 현재 전송 구조

```
POST /api/sync/tokens
{
  figmaFileKey: string,
  figmaFileName: string,
  tokens: {
    variables: { collections: [...], variables: [...] },
    spacing: [...],
    radius: [...],
    styles: { colors, texts, effects, grids },
    typography: {                          ← v2 통합 구조 (기존 textStyles/headings/fonts 대체)
      textStyles: [...],                   ← body/display 구분 + varId 연결
      fontSizes: [...],
      lineHeights: [...],
      fontFamilies: [...],
      fontWeights: [...]
    },
    extraVars: [...],                      ← typography 컬렉션 제외 (중복 방지)
    meta: { figmaFileKey, extractedAt, fileName, sourceMode, totalNodes }
  }
}
```

> **하위 호환**: `styles.textStyles`, `styles.headings`, `styles.fonts` 필드는 구버전 플러그인
> 대응용 fallback으로 앱에서 계속 인식하지만, 신규 추출은 `typography` 필드로만 전송됨.

---

## 2. 추가 요청 필드 (우선순위순)

### 2-1. variable.description (우선순위: 높음, 공수: 매우 낮음)

Figma Variable API에 `description` 필드가 있지만 현재 전달하지 않음.

```typescript
// 현재
{ id, name, resolvedType, valuesByMode, collectionId, usageCount }

// 요청
{ id, name, resolvedType, valuesByMode, collectionId, usageCount, description }
//                                                                 ^^^^^^^^^^^ 추가
```

**효과**: 색상 가이드 페이지에 패밀리 설명 표시 가능

### 2-2. variable.scopes (우선순위: 낮음, 공수: 낮음)

Variable의 scope 정보 — 단, **이름 기반 분류를 대체하지 않음**.

```typescript
// 요청
{ ..., scopes: ["FRAME_FILL", "SHAPE_FILL"] }
```

**주의**: `WIDTH_HEIGHT` scope는 `spacing`·`width`·`height` 모두에 사용되므로
scope만으로는 `width-xxs`를 `spacing`으로 잘못 분류할 수 있다.

현재 `inferFloatType`은 **이름 패턴 우선, scope는 fallback**으로 동작하며,
플러그인이 scopes 필드를 포함하지 않아도 정상 분류됨.
scopes 전송 시에도 이름이 더 구체적이면 이름 패턴이 scope를 덮어씀.

**효과**: scope 전송 시, 이름에 단서가 없는 변수(e.g., 범용 `gap-*`)에 한해 분류 보조

---

## 3. CSS 변수명 변환 규칙 (참고)

플러그인이 alias 참조를 전송할 때 아래 규칙으로 변환하면 서버 보정이 불필요해짐.

### Primitives
```
Figma: Colors/Brand/600
CSS:   --colors-brand-600
규칙:  '/' → '-', 소문자화, 'Colors/' → 'colors-'
```

### Semantic
```
Figma: Colors/Background/bg-primary
CSS:   --bg-primary
규칙:  중복 세그먼트 제거 (background-bg → bg)
```

### Component colors
```
Figma: Component colors/Utility/Brand/utility-brand-600
CSS:   --utility-brand-600
규칙:  마지막 세그먼트만 사용
```

### 참조 파일
- `src/lib/tokens/css-generator.ts` — `toVarName()` 함수가 전체 규칙 포함
- `public/css/tokens.css` — 최종 결과물 참조 표본
- `src/lib/component-generator/css-var-mapper.ts` — 컴포넌트가 토큰을 참조하는 규칙

---

## 4. 향후 확장 (공수 큼, 급하지 않음)

### colorGuide 섹션

Figma Foundations 페이지의 노드 데이터에서 추출:

```json
{
  "colorGuide": {
    "families": [
      {
        "name": "Brand",
        "role": "default-brand",
        "description": "The brand color is your primary color...",
        "sortOrder": 1
      }
    ]
  }
}
```

- `role`: Figma 페이지의 "● Default brand" 태그
- `description`: "Design note" 인스턴스의 텍스트
- `sortOrder`: 노드 y좌표 기반 순서

WCAG 대비 등급은 서버에서 hex 값으로 계산하므로 전달 불필요.

---

## 5. meta.figmaFileKey 중요

컴포넌트 전송 시 `data.meta.figmaFileKey`에 실제 파일키를 포함해야
토큰과 같은 프로젝트에 저장됨.

```typescript
// 컴포넌트 전송 시
POST /api/sync/components
{
  data: {
    meta: {
      figmaFileKey: "91AZ5QzLIwI0ztH4VzCR4B"  // ← 필수
    }
  }
}
```
