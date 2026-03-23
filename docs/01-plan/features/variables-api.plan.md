## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | variables-api |
| 시작일 | 2026-03-23 |
| 목표 완료일 | 2026-03-25 |
| 기간 | 2일 |

| 관점 | 내용 |
|------|------|
| Problem | 현재 노드 트리 순회 방식은 컴포넌트 내부 렌더링 색상까지 모두 추출해 노이즈가 심하고, 디자이너가 의도한 토큰과 그렇지 않은 값이 섞인다 |
| Solution | Figma Variables API(`/files/{key}/variables/local`)를 활용해 디자이너가 명시적으로 정의한 Variables만 추출하는 레이어를 추가한다 |
| Function UX Effect | 추출 결과가 깔끔해지고 이름·그룹·모드(라이트/다크) 정보가 살아남아 실제 사용 가능한 디자인 토큰이 된다 |
| Core Value | Figma 디자인 시스템의 Variables = 코드의 디자인 토큰 1:1 매핑이 가능해져 PixelForge의 핵심 가치가 실현된다 |

---

# Plan: variables-api

## 1. 배경 및 문제

### 1.1 현재 상황

PixelForge는 Figma REST API의 `/files/{key}` 엔드포인트로 전체 문서를 가져와 노드 트리를 순회한다.

```
추출 방식:
- 색상: SOLID fill이 있는 모든 노드 → hex 추출
- 타이포: type=TEXT 노드 → fontFamily/fontSize
- 간격: type=FRAME 노드 → padding/itemSpacing
- 반경: cornerRadius > 0인 모든 노드
```

### 1.2 문제점

| 문제 | 설명 |
|------|------|
| 노이즈 과다 | 버튼 배경색, 아이콘 fill, 컴포넌트 내부 색 등 의도하지 않은 값이 포함됨 |
| 이름 부정확 | 토큰 이름이 노드 이름 → "Button/Primary" 같은 컴포넌트 이름이 색상 토큰 이름이 됨 |
| 중복 많음 | 같은 hex값이 여러 노드에서 추출 → hex 기준 중복 제거 시 이름 정보 손실 |
| 모드 없음 | 라이트/다크 모드 분기 불가 |
| Semantic 없음 | `brand/primary/500` 같은 계층 구조 정보 없이 flat한 값만 추출 |

### 1.3 Figma Variables란

Figma Variables는 디자이너가 명시적으로 정의하는 디자인 토큰 시스템이다.

```
Variable Collection: "Primitives"
  └ Variable: "Color/Blue/500"
      Mode: Light → #0066FF
      Mode: Dark  → #3399FF

Variable Collection: "Semantic"
  └ Variable: "Color/Brand/Primary"
      Mode: Light → alias → "Color/Blue/500"
      Mode: Dark  → alias → "Color/Blue/400"
```

---

## 2. 목표

### 2.1 Primary Goal

Figma Variables API를 통해 디자이너가 정의한 Variables를 추출하여 기존 노드 순회 방식을 보완한다.

### 2.2 Success Criteria

- [ ] `/files/{key}/variables/local` API 호출 성공
- [ ] Variable Collection별 그룹화된 토큰 목록 반환
- [ ] 라이트/다크 모드 값 분리 저장
- [ ] alias 관계 추적 (Semantic → Primitive 연결)
- [ ] 기존 노드 순회 방식과 공존 (Variables 없는 파일도 정상 동작)

### 2.3 Out of Scope

- Figma MCP 직접 연동 (REST API만 사용)
- Variables 편집/생성 기능
- 커뮤니티 파일 Variables 접근 (읽기 권한 제한)

---

## 3. 사용자 시나리오

### 시나리오 A: Variables가 잘 정의된 파일 (파운데이션)

1. 사용자가 파운데이션 Figma URL 입력
2. PixelForge가 Variables API 호출
3. Collections: ["Primitives", "Semantic", "Component"] 감지
4. 각 Collection의 Variables를 모드별로 추출
5. 결과: 깔끔한 이름 + 모드 정보가 있는 토큰 145개

### 시나리오 B: Variables 없는 파일 (Untitled UI 같은 커뮤니티 파일)

1. Variables API 호출 → 빈 배열 또는 권한 에러
2. 자동으로 기존 노드 순회 방식으로 폴백
3. 사용자에게 "Variables 없음 - 노드 스캔 방식으로 추출" 안내

---

## 4. 기술 설계

### 4.1 Figma Variables REST API

```
GET /v1/files/{file_key}/variables/local

Response:
{
  "meta": {
    "variableCollections": {
      "{collectionId}": {
        "id": "...",
        "name": "Primitives",
        "modes": [
          { "modeId": "1:0", "name": "Light" },
          { "modeId": "1:1", "name": "Dark" }
        ],
        "defaultModeId": "1:0",
        "variableIds": ["...", "..."]
      }
    },
    "variables": {
      "{variableId}": {
        "id": "...",
        "name": "Color/Blue/500",
        "resolvedType": "COLOR",
        "valuesByMode": {
          "1:0": { "r": 0, "g": 0.4, "b": 1, "a": 1 },
          "1:1": { "r": 0.2, "g": 0.6, "b": 1, "a": 1 }
        }
      }
    }
  }
}
```

**Variable resolvedType 종류:**
- `COLOR` → 색상 토큰
- `FLOAT` → spacing, radius, fontSize 등 숫자 토큰
- `STRING` → 폰트 패밀리, 텍스트 토큰
- `BOOLEAN` → 가시성 토큰 (현재 scope 외)

### 4.2 추가할 파일 및 변경

```
src/lib/figma/
  api.ts                  ← getVariables() 메서드 추가

src/lib/tokens/
  extractor.ts            ← 기존 (유지)
  variables-extractor.ts  ← 신규: Variables → TokenRow 변환

src/lib/actions/
  project.ts              ← extractTokensAction에 Variables 우선 추출 로직 추가
```

### 4.3 추출 우선순위 전략

```
1. Variables API 시도
   └ 성공 + Variables 존재 → Variables 기반 추출 사용
   └ 실패 or 빈 결과      → 기존 노드 순회 방식 폴백

2. 결과에 source 필드 추가
   { source: 'variables' | 'node-scan' }
```

### 4.4 토큰 DB 스키마 변경

`tokens` 테이블에 다음 컬럼 추가:

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `source` | TEXT | `'variables'` \| `'node-scan'` |
| `mode` | TEXT | `'Light'` \| `'Dark'` \| `null` |
| `collectionName` | TEXT | Variable Collection 이름 |
| `alias` | TEXT | alias인 경우 참조 variable ID |

---

## 5. 구현 순서

1. `FigmaClient.getVariables()` 추가 (`api.ts`)
2. `variables-extractor.ts` 작성 (Variables → ColorToken/etc 변환)
3. DB 스키마 마이그레이션 (`source`, `mode`, `collectionName` 컬럼)
4. `extractTokensAction` Variables 우선 + 폴백 로직
5. UI: 토큰 카드에 mode 배지 표시 (Light/Dark)
6. UI: source 표시 (Variables 아이콘 vs 노드스캔 아이콘)

---

## 6. 리스크

| 리스크 | 대응 |
|--------|------|
| 커뮤니티 파일 Variables 접근 불가 (403) | 노드 순회 폴백으로 무조건 처리 |
| Variables API 호출 추가로 API call +1 | 429 재시도 로직 이미 구현됨 |
| FLOAT 타입 Variables의 의미 모호 (spacing? radius? fontSize?) | Variable 이름 패턴으로 추론 (`spacing/`, `radius/`, `font-size/`) |
| 기존 추출 데이터와 혼재 | source 컬럼으로 구분, UI에서 필터 제공 |
