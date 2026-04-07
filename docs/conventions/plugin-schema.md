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
    styles: { colors, textStyles, headings, effects, fonts },
    meta: { figmaFileKey, extractedAt, fileName, sourceMode, totalNodes }
  }
}
```

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

### 2-2. variable.scopes (우선순위: 중간, 공수: 낮음)

Variable의 scope 정보로 토큰 타입 자동 분류 정확도 향상.

```typescript
// 요청
{ ..., scopes: ["FRAME_FILL", "SHAPE_FILL"] }
```

**효과**: `inferFloatType`의 하드코딩 키워드 매칭 대신 scope 기반 정확한 분류

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
