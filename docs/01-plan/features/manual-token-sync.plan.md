## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | manual-token-sync — 메인 페이지 토큰 수동 추출 버튼 |
| 시작일 | 2026-04-02 |
| 목표 완료일 | 2026-04-03 |
| 기간 | 1일 |

| 관점 | 내용 |
|------|------|
| Problem | 메인 대시보드에서 현재 토큰을 즉시 갱신하려면 `/tokens/{type}` 페이지로 이동해 개별 추출해야 한다 — 원클릭 전체 추출 진입점이 없다 |
| Solution | 대시보드 Top Bar에 "Extract Tokens" 버튼을 추가하여 프로젝트에 저장된 Figma URL로 `extractTokensAction`을 즉시 호출한다 |
| Function UX Effect | 메인 페이지를 떠나지 않고 한 번의 클릭으로 전체 토큰을 갱신하고, 결과가 Audit Log에 즉시 반영된다 |
| Core Value | 대시보드가 단순 뷰어가 아니라 실제 추출 진입점이 되어 워크플로우 단계를 줄인다 |

---

# Plan: manual-token-sync — 메인 페이지 토큰 수동 추출

## 1. 배경 및 문제

### 1.1 현재 상황

토큰을 추출하는 방법이 여러 곳에 분산되어 있다:

- `/tokens/{type}` 개별 타입 페이지 → 타입별 추출 버튼 (TokenPageActions)
- `/settings` → Figma URL 저장 및 최초 추출
- 플러그인 자동 sync (POST /api/sync/tokens) → 가장 편리하지만 플러그인 필요

메인 대시보드(`/`)에는 `handleSync`가 `router.refresh()`만 호출하고 있어 **실제 토큰 추출이 일어나지 않는다**.

### 1.2 문제점

| 상황 | 현재 동선 | 이상적인 동선 |
|------|-----------|--------------|
| 토큰 전체 갱신 필요 | 대시보드 → /tokens/color → 추출 → 뒤로 → /tokens/typography → ... | 대시보드 → Extract 버튼 한 번 |
| 마지막 추출 시각 확인 | Top Bar의 `Last sync` 참조 | 동일 |
| 추출 결과 확인 | Audit Log에서 확인 | 동일 (즉시 갱신) |

### 1.3 전제 조건

- `projects` 테이블에 `figma_url`이 저장되어 있어야 한다
- `app_settings` 또는 환경변수에 Figma API 토큰이 설정되어 있어야 한다
- 이 두 조건 중 하나라도 없으면 버튼은 비활성 + 안내 메시지 표시

---

## 2. 목표

### 2.1 핵심 목표

메인 대시보드 Top Bar에 "Extract Tokens" 버튼 추가:

```
클릭
  ↓
getActiveProjectFigmaUrl()  ← projects 테이블에서 저장된 URL 조회
  ↓
extractTokensAction(figmaUrl)  ← 기존 함수 그대로 재사용
  ↓
{ colors, typography, spacing, radii } 결과 표시 (토스트 or 인라인)
  ↓
router.refresh()  ← Audit Log + 통계 카드 즉시 갱신
```

### 2.2 성공 기준

- [ ] 대시보드 Top Bar에 "Extract Tokens" 버튼이 존재한다
- [ ] 버튼 클릭 시 로딩 스피너가 표시된다
- [ ] 추출 완료 후 토큰 통계 카드와 Audit Log가 갱신된다
- [ ] Figma URL 미설정 시 버튼이 비활성화되고 설정 페이지 링크가 표시된다
- [ ] API 토큰 미설정 시 버튼 클릭 시 에러 메시지가 표시된다
- [ ] 추출 실패 시 에러 메시지가 UI에 표시된다

---

## 3. 구현 범위

### Phase 1 — Server Action

**`src/lib/actions/tokens.ts`에 추가**

```ts
// 대시보드용 전체 토큰 추출 액션
export async function extractAllTokensAction(): Promise<{
  error: string | null;
  colors: number;
  typography: number;
  spacing: number;
  radii: number;
}>
```

내부 동작:
1. `getActiveProjectId()` → 현재 활성 프로젝트 조회
2. `projects` 테이블에서 `figma_url` 조회
3. `figma_url` 없으면 `{ error: 'Figma URL이 설정되지 않았습니다. 설정 페이지에서 입력해주세요.' }` 반환
4. `extractTokensAction(figmaUrl)` 호출 (기존 함수 재사용)
5. 결과 반환

### Phase 2 — UI: Top Bar 버튼

**`src/app/(ide)/TokenDashboard.tsx` 수정**

```
기존 handleSync: router.refresh()만 수행
→ 변경: extractAllTokensAction() 호출 → 결과 처리 → router.refresh()
```

버튼 상태:
- `idle`: "Extract Tokens" 텍스트 + solar:download-minimalistic-linear 아이콘
- `loading`: "Extracting..." 텍스트 + 스피너 (disabled)
- `success`: 잠깐 "Done" 표시 후 idle 복귀
- `error`: 에러 메시지 인라인 표시 (토스트 없이 Top Bar 하단)

비활성화 조건:
- Figma URL 미설정: 버튼 disabled + 설정 페이지 링크 툴팁

### Phase 3 — Figma URL 존재 여부 전달

**`src/app/(ide)/page.tsx` 수정**

```ts
// 프로젝트 Figma URL 조회 추가
const hasFigmaUrl = await getActiveProjectHasFigmaUrl();

// TokenDashboard에 전달
<TokenDashboard
  ...
  hasFigmaUrl={hasFigmaUrl}
/>
```

**`src/lib/actions/tokens.ts`에 추가**

```ts
export async function getActiveProjectHasFigmaUrl(): Promise<boolean>
```

---

## 4. 구현 순서

```
Step 1: Server Action 추가
  - getActiveProjectHasFigmaUrl() — projects 테이블 조회
  - extractAllTokensAction() — extractTokensAction 래퍼

Step 2: page.tsx에서 hasFigmaUrl 데이터 페칭 추가

Step 3: TokenDashboard Props 인터페이스 확장
  - hasFigmaUrl: boolean 추가

Step 4: handleSync 로직 교체
  - extractAllTokensAction() 호출
  - 결과 상태 관리 (idle/loading/success/error)
  - 에러 메시지 표시 영역 추가

Step 5: Top Bar 버튼 UI 수정
  - 버튼 텍스트/아이콘/disabled 상태 반영
```

---

## 5. 파일 목록

| 파일 | 변경 | 설명 |
|------|------|------|
| `src/lib/actions/tokens.ts` | 수정 | `extractAllTokensAction`, `getActiveProjectHasFigmaUrl` 추가 |
| `src/app/(ide)/page.tsx` | 수정 | `hasFigmaUrl` 데이터 페칭 및 Props 전달 |
| `src/app/(ide)/TokenDashboard.tsx` | 수정 | handleSync 교체, 버튼 상태 UI, 에러 표시 |

---

## 6. 미포함 범위

- 토큰 타입 선택 UI (전체 추출만) — 타입별 추출은 기존 `/tokens/{type}` 페이지에 유지
- 진행률 표시 (퍼센트/단계) — 추출 완료 후 결과만 표시
- Figma URL 인라인 입력 — 설정 페이지로 유도

---

## 7. 의존성

| 의존 | 설명 |
|------|------|
| `extractTokensAction` | `src/lib/actions/project.ts` — 그대로 재사용, 변경 없음 |
| `getActiveProjectId` | `src/lib/db/active-project` — 기존 유틸 재사용 |
| `useTransition` | React 기존 사용 중 — 확장 |
