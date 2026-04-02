## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | manual-token-sync — 메인 페이지 토큰 수동 가져오기 |
| 시작일 | 2026-04-02 |
| 목표 완료일 | 2026-04-03 |
| 기간 | 1일 |

| 관점 | 내용 |
|------|------|
| Problem | 메인 대시보드에서 토큰을 갱신하려면 `/tokens/{type}` 페이지로 이동해 JSON 임포트를 직접 해야 한다 — Figma API는 Enterprise 권한 없이 Variables를 읽을 수 없어 사용 불가 |
| Solution | 대시보드 Top Bar에 "Import Tokens" 버튼을 추가하고, 클릭 시 기존 `TokenImportTabs` 컴포넌트를 모달로 띄워 JSON 파일 업로드/붙여넣기로 임포트한다 |
| Function UX Effect | 메인 페이지를 떠나지 않고 버튼 한 번으로 JSON 임포트 모달을 열어 토큰을 갱신하고, Audit Log가 즉시 반영된다 |
| Core Value | 이미 구현된 `TokenImportTabs`를 대시보드에서 재사용해 추가 개발 없이 원클릭 토큰 갱신 진입점을 만든다 |

---

# Plan: manual-token-sync — 메인 페이지 토큰 수동 가져오기

## 1. 배경 및 문제

### 1.1 토큰 추출 방식 재정의

Figma REST API (`GET /v1/files/:file_key/variables/local`)는 **Enterprise 플랜 이상**에서만 Variables를 반환한다.
Free/Professional 플랜에서는 403 또는 빈 응답을 반환한다.

따라서 실제 사용 가능한 방법은 다음 두 가지다:

```
1순위: 플러그인 자동 sync
  └─ Figma 플러그인 "Sync" → POST /api/sync/tokens
  └─ 완전 자동, 정확 — 플러그인 설치 필요

2순위: JSON 수동 가져오기  ← 이번 작업의 목표
  └─ 플러그인 "Export JSON" → .json 파일
  └─ 파일 업로드 또는 JSON 붙여넣기
  └─ 기존 importFromJsonAction() 재사용
```

### 1.2 현재 상황

- `importFromJsonAction` + `TokenImportTabs` 컴포넌트 이미 구현됨
- 하지만 `/tokens/{type}` 하위 페이지에만 위치해 접근성이 낮음
- 메인 대시보드(`/`)에서는 토큰 갱신 진입점이 없음

### 1.3 목표

메인 대시보드 Top Bar에 "Import Tokens" 버튼을 추가하여,
**클릭 한 번으로 JSON 임포트 모달을 열고 토큰을 갱신**할 수 있게 한다.

---

## 2. 구현 범위

### 변경 1 — Top Bar 버튼

`TokenDashboard.tsx`의 `topBarRight` 영역에 "Import Tokens" 버튼 추가:

- 아이콘: `solar:import-linear`
- 클릭 시 JSON 임포트 모달 오픈

### 변경 2 — JSON 임포트 모달

`TokenImportTabs` 컴포넌트를 모달 래퍼로 감싸 대시보드 위에 오버레이로 표시:

- `onImportSuccess` 콜백: 모달 닫기 + `router.refresh()` 호출
- 모달 배경 클릭/ESC → 닫기
- 기존 `TokenImportTabs`는 수정 없이 재사용

### 변경 없음

- `importFromJsonAction` — 재사용, 수정 없음
- `TokenImportTabs` — 재사용, 수정 없음
- `page.tsx` — 수정 없음 (Props 변경 불필요)
- `tokens.ts` — 수정 없음

---

## 3. 파일 목록

| 파일 | 변경 | 설명 |
|------|------|------|
| `src/app/(ide)/TokenDashboard.tsx` | 수정 | "Import Tokens" 버튼 추가, 모달 상태 관리, 모달 JSX |
| `src/app/(ide)/TokenDashboard.module.scss` | 수정 | 모달 오버레이/컨테이너 스타일 추가 |

> 신규 파일 없음 — 기존 `TokenImportTabs` 재사용

---

## 4. 성공 기준

- [ ] Top Bar 우측에 "Import Tokens" 버튼이 표시된다
- [ ] 버튼 클릭 시 JSON 임포트 모달이 열린다
- [ ] 모달 내에서 파일 업로드 또는 JSON 붙여넣기로 임포트가 가능하다
- [ ] 임포트 성공 시 모달이 닫히고 Audit Log와 통계 카드가 갱신된다
- [ ] 모달 배경 클릭 또는 ESC로 닫힌다
- [ ] `npm run build` 통과

---

## 5. 현재 구현 상태 및 롤백 필요 범위

이전 구현(Figma API 방식)에서 변경된 파일들을 이 플랜으로 대체한다:

| 파일 | 이전 변경 | 새 방향 |
|------|----------|--------|
| `src/lib/actions/tokens.ts` | `getActiveProjectHasFigmaUrl`, `extractAllTokensAction` 추가 | 해당 함수 제거 |
| `src/app/(ide)/page.tsx` | `hasFigmaUrl` 페칭 추가 | 원래대로 복원 |
| `src/app/(ide)/TokenDashboard.tsx` | `extractAllTokensAction` 호출 버튼 | JSON 임포트 모달 버튼으로 교체 |
