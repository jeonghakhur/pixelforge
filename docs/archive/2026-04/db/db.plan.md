## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | db — 플러그인 토큰 수신 후처리 파이프라인 |
| 시작일 | 2026-04-01 |
| 목표 완료일 | 2026-04-04 |
| 기간 | 3일 |

| 관점 | 내용 |
|------|------|
| Problem | 플러그인이 보낸 토큰이 `token_snapshots`에 raw JSON으로만 쌓이고, 기존 토큰 파이프라인(타입 분류·CSS 생성·화면 반영)과 연결되지 않아 아무 동작도 하지 않는다 |
| Solution | sync 수신 시 raw JSON → 정규화 → `tokens` upsert → CSS 재생성 → diff 계산 → **변경된 타입 페이지 자동 스크린샷**까지 자동 실행되는 후처리 파이프라인을 구축한다 |
| Function UX Effect | 플러그인 "Sync" 한 번으로 IDE 토큰 목록·CSS·변경 diff·**Figma vs 구현 비교 화면**이 모두 자동 갱신된다 |
| Core Value | Figma ↔ PixelForge 실시간 연동 — 디자이너가 Variables를 수정하면 개발자 IDE에 즉시 반영되는 단방향 동기화 파이프라인 완성 |

---

# Plan: db — 플러그인 토큰 수신 후처리 파이프라인

## 0. 토큰 생성 방향성 (우선순위)

토큰을 생성하는 방법은 4가지이며, **우선순위가 명확하다:**

```
1순위: 플러그인 자동 동기화  ← 이번 작업의 핵심
  └─ Figma 플러그인 "Sync" 버튼 → POST /api/sync/tokens
  └─ 실시간, 자동, 가장 정확 (디자이너 의도 그대로)

2순위: JSON 파일 첨부
  └─ 플러그인이 내보낸 JSON 파일을 IDE에 업로드
  └─ 기존: importFromJsonAction() — 이미 구현됨

3순위: JSON 복사·붙여넣기
  └─ JSON 텍스트를 IDE 텍스트 영역에 직접 입력
  └─ 기존: IDE 메인 페이지 JSON import 섹션 — 이미 구현됨

4순위: Figma URL 직접 호출
  └─ Figma REST API 직접 호출 (Figma API 토큰 필요)
  └─ 기존: extractTokensByTypeAction() — 이미 구현됨
  └─ Professional 요금제 미지원, API 할당량 소진 위험
```

**왜 이 순서인가:**
| 방식 | 정확도 | 자동화 | 접근성 | 비용 |
|------|--------|--------|--------|------|
| 플러그인 자동 | 최고 (의도된 Variables만) | 완전 자동 | 플러그인 필요 | 무료 |
| JSON 파일 | 높음 | 반자동 (저장 후 업로드) | 누구나 | 무료 |
| JSON 붙여넣기 | 높음 | 수동 | 누구나 | 무료 |
| Figma URL | 중간 (노이즈 가능) | 반자동 | API 토큰 필요 | API 할당량 |

**이번 `db` feature의 목표:**
1순위(플러그인 자동 sync)를 완전히 작동시키는 후처리 파이프라인 구축.
2~4순위는 이미 구현된 코드와 **동일한 파이프라인을 통과**하도록 통합.

---

## 1. 배경 및 문제

### 1.1 현재 상황

플러그인 → `/api/sync/tokens` POST → `token_snapshots` 저장까지는 동작한다.

```
플러그인 (Figma)
  └─ POST /api/sync/tokens
       └─ token_snapshots 테이블에 raw JSON 저장  ← 여기서 멈춤
```

저장된 raw 데이터 구조 (Figma Variables API 응답):
```json
{
  "variables": {
    "variables": [
      {
        "id": "VariableID:1:1",
        "name": "Color/Brand/Primary",
        "resolvedType": "COLOR",
        "valuesByMode": {
          "1:0": { "r": 0, "g": 0.4, "b": 1, "a": 1 }
        }
      }
    ],
    "variableCollections": [...]
  }
}
```

### 1.2 문제점

| 단계 | 현재 상태 | 필요한 것 |
|------|----------|----------|
| 파싱 | raw JSON 그대로 저장 | 타입별 정규화 |
| `tokens` 테이블 | 플러그인 데이터 미반영 | upsert 연동 |
| CSS 생성 | 수동 추출 후에만 가능 | 수신 시 자동 재생성 |
| 변경 감지 | 해시 비교만 (동일/변경) | 추가/삭제/변경 diff |
| UI 알림 | 없음 | 변경 배지/토스트 |

### 1.3 플러그인이 보내는 데이터 포맷

Figma Variables API 기반:
```
variables.variables[]
  - id: "VariableID:1:1"
  - name: "Color/Brand/Primary"  (슬래시 구분 계층)
  - resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN"
  - valuesByMode: { [modeId]: value }
  - scopes: ["ALL_FILLS", "FRAME_FILL", ...]

variables.variableCollections[]
  - id: "VariableCollectionId:1:1"
  - name: "Primitives"
  - modes: [{ modeId, name }]
  - defaultModeId: "1:0"
```

---

## 2. 목표

### 2.1 핵심 목표

플러그인 sync 수신 시 **자동으로** 다음이 일어나야 한다:

```
POST /api/sync/tokens
  ↓
1. raw JSON 파싱 → 정규화
  ↓
2. tokens 테이블 upsert (type/name/value/mode/collectionName)
  ↓
3. tokenCounts 갱신 (타입별 개수: { color: N, float: N, ... })
  ↓
4. CSS 재생성 → design-tokens/tokens.css 저장
  ↓
5. diff 계산 (이전 스냅샷과 비교)
  ↓
6. diffSummary 저장 → 응답에 포함
```

### 2.2 정규화 규칙

| Figma `resolvedType` | PixelForge `type` | 변환 |
|---------------------|-------------------|------|
| `COLOR` | `color` | rgba → hex (`#RRGGBB` or `rgba(...)`) |
| `FLOAT` | `spacing` / `radius` / `float` | scope으로 분류 |
| `STRING` | `typography` / `string` | name 패턴으로 분류 |
| `BOOLEAN` | `boolean` | "true"/"false" string |

**type 분류 상세 (FLOAT scope 기반):**
- scope에 `CORNER_RADIUS` → `radius`
- scope에 `GAP` / `WIDTH_HEIGHT` → `spacing`
- scope에 `FONT_SIZE` / `FONT_WEIGHT` / `LINE_HEIGHT` → `typography`
- 기타 FLOAT → `float`

### 2.3 모드 처리

Variables API는 `valuesByMode`로 여러 모드를 제공한다.

- **기본 전략:** `defaultModeId`의 값을 기본 토큰으로 저장
- **다중 모드:** Light/Dark 모드가 있으면 mode 컬럼에 기록
- **Alias 처리:** value가 `{ type: "VARIABLE_ALIAS" }` → alias 컬럼에 원본 id 저장

---

## 3. 구현 범위

### Phase 1 — 파서 + upsert (핵심)

**`src/lib/sync/parse-variables.ts`**
```
parseVariablesPayload(tokenData, collections)
  → NormalizedToken[]
  → { type, name, value, mode, collectionName, alias }
```

**`src/lib/sync/upsert-tokens.ts`**
```
upsertTokensFromSnapshot(projectId, normalizedTokens)
  → DELETE 기존 tokens (source='variables')
  → INSERT 새 tokens
  → RETURN { added, removed, changed }
```

**`src/app/api/sync/tokens/route.ts` 수정**
```
기존: tokenSnapshots insert만
추가: parseVariablesPayload → upsertTokensFromSnapshot → tokenCounts 갱신
```

### Phase 2 — diff + diffSummary

**`src/lib/sync/compute-diff.ts`**
```
computeTokenDiff(prevSnapshot, newTokens)
  → { added: string[], removed: string[], changed: { name, from, to }[] }
```

- `diffSummary` 컬럼에 JSON으로 저장
- API 응답에 `diff` 포함

### Phase 3 — CSS 재생성

**`src/lib/sync/tokens/route.ts` 수정**
```
upsert 완료 후:
  → getAllTokens(projectId)
  → generateAllCssCode(tokens)  (기존 함수 재사용)
  → design-tokens/tokens.css 파일 저장
```

### Phase 4 — 자동 스크린샷 캡처

토큰 upsert 후 변경이 감지된 타입에 대해 자동으로 스크린샷을 찍는다.

**기존 로직 재사용:**
- `captureTokenPageScreenshotAction(type)` — 이미 구현됨 (Playwright)
- `captureFigmaFrameAction(type, figmaKey, nodeId)` — 이미 구현됨 (Figma API)
- 결과는 `token_sources.ui_screenshot` / `figma_screenshot` 컬럼에 저장

**자동화 전략:**
```
upsert 완료 → diff.changedTypes 추출 (변경된 type 목록)
  ↓
변경된 type이 있으면 백그라운드로 실행 (응답 블로킹 안 함)
  ↓
Promise.allSettled([
  captureTokenPageScreenshotAction(type),   // IDE 화면 캡처
  captureFigmaFrameAction(type, figmaKey, nodeId),  // Figma 프레임 캡처
])
  ↓
token_sources 테이블 uiScreenshot / figmaScreenshot 갱신
```

**주의사항:**
- `baseUrl` 환경변수 확인 필요 (`NEXT_PUBLIC_BASE_URL=http://localhost:3001`)
- Figma 프레임 캡처는 `token_sources.figma_url`에서 `nodeId` 추출 필요
- 스크린샷은 백그라운드 실행 — API 응답에는 `screenshotQueued: true`만 포함

### Phase 5 — UI 변경 알림

`token_snapshots` 테이블의 최신 `diffSummary`를 IDE 페이지에서 폴링하여
변경이 감지되면 토스트 알림 표시.

---

## 4. 구현 순서

```
Day 1:
  1. parse-variables.ts — COLOR/FLOAT/STRING 파서
  2. upsert-tokens.ts — tokens 테이블 upsert
  3. tokens route 수정 — 파서 연결
  4. curl 테스트로 tokens 테이블 저장 확인

Day 2:
  5. compute-diff.ts — added/removed/changed + changedTypes 계산
  6. diffSummary 저장 + API 응답 포함
  7. tokenCounts 타입별 개수로 개선

Day 3:
  8. CSS 재생성 자동화
  9. 자동 스크린샷 백그라운드 실행 (captureTokenPageScreenshotAction 재사용)
  10. NEXT_PUBLIC_BASE_URL 환경변수 확인 및 포트 수정
  11. IDE 변경 알림 배지 (선택)
```

---

## 5. 파일 목록

| 파일 | 변경 | 설명 |
|------|------|------|
| `src/lib/sync/parse-variables.ts` | 신규 | Figma Variables → NormalizedToken[] |
| `src/lib/sync/upsert-tokens.ts` | 신규 | tokens 테이블 upsert |
| `src/lib/sync/compute-diff.ts` | 신규 | 스냅샷 간 diff + changedTypes 계산 |
| `src/app/api/sync/tokens/route.ts` | 수정 | 파이프라인 연결 + 스크린샷 트리거 |
| `src/lib/actions/tokens.ts` | 재사용 | captureTokenPageScreenshotAction, captureFigmaFrameAction |
| `.env.local` | 수정 | NEXT_PUBLIC_BASE_URL=http://localhost:3001 확인 |

---

## 6. 성공 기준

- [ ] `curl POST /api/sync/tokens` 후 `tokens` 테이블에 타입별로 정규화된 데이터 존재
- [ ] COLOR 토큰 → `type='color'`, `value='#hex'`로 저장
- [ ] FLOAT 토큰 → scope 기반 `type='spacing'|'radius'|'typography'`로 저장
- [ ] `token_snapshots.token_counts` = `{ "color": N, "spacing": N, ... }` 형태
- [ ] `token_snapshots.diff_summary` = `{ added: [], removed: [], changed: [] }` 형태
- [ ] `design-tokens/tokens.css` 자동 갱신
- [ ] 변경된 타입에 대해 `public/token-screenshots/{type}.png` 자동 업데이트
- [ ] `/tokens/color` 비교 화면에서 Figma 프레임 vs IDE 캡처 최신 상태로 표시
