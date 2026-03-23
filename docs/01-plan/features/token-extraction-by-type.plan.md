## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | 하나의 Figma URL로 모든 토큰을 일괄 추출하면 타입별 원본 출처가 달라 정확도가 떨어지고, 추출 결과를 시각적으로 검증할 수 없다 |
| Solution | 토큰 타입별로 독립적인 Figma URL을 등록하고 추출하며, 추출 직후 PixelForge UI 스크린샷을 자동 캡처해 시각 검증을 지원한다 |
| Function UX Effect | 각 토큰 페이지에 "추가하기" 버튼 → URL 입력 모달 → 해당 타입만 추출 → 결과 페이지 스크린샷 자동 저장 |
| Core Value | 디자이너가 타입별 프레임 URL을 직접 지정해 "내가 의도한 토큰"만 정확하게 추출할 수 있다는 신뢰 확보 |

---

# Plan: 타입별 토큰 추출 + UI 시각 검증

## 1. 배경 및 문제

### 현재 구조의 한계

- `projects.figma_url` 단일 URL → 전체 파일 스캔 → 모든 타입 일괄 추출
- 커뮤니티 파일(Variables API 403) → node-scan fallback → 이름 품질 저하
- 추출 결과를 DB에만 저장, 시각적 확인 수단 없음
- 색상/타이포/간격이 서로 다른 Figma 파일/프레임에 있어도 하나의 URL만 등록 가능

### 원하는 상태

- 색상 토큰 → 색상 전용 Figma 프레임 URL 등록 → 색상만 추출
- 추출 직후 PixelForge UI `/tokens/color` 페이지를 스크린샷으로 자동 캡처·저장
- 토큰 페이지에서 스크린샷을 보며 추출 결과가 의도한 디자인과 일치하는지 육안 검증

---

## 2. 기능 명세

### 2-1. `token_sources` 테이블 (신규)

```sql
CREATE TABLE token_sources (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id),
  type          TEXT NOT NULL,                    -- 'color' | 'typography' | ...
  figma_url     TEXT NOT NULL,                    -- 사용자가 입력한 Figma URL
  figma_key     TEXT NOT NULL,                    -- 추출된 file key
  figma_version TEXT,                             -- 마지막 추출 시점 파일 버전
  last_extracted_at INTEGER,                      -- 마지막 추출 타임스탬프
  token_count   INTEGER NOT NULL DEFAULT 0,       -- 마지막 추출 토큰 수
  ui_screenshot TEXT,                             -- 추출 후 UI 스크린샷 경로
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(project_id, type)                        -- 프로젝트당 타입별 1개
);
```

### 2-2. 신규 Server Actions

**`extractTokensByTypeAction(type: string, figmaUrl: string)`**
- 기존 `extractTokensAction` 로직을 타입 필터링 버전으로 래핑
- 추출 전: `token_sources` upsert (project_id, type, figma_url, figma_key)
- 추출 실행: 기존 extractor 호출, 해당 type만 DB 저장
- 추출 후: `token_sources.token_count`, `last_extracted_at`, `figma_version` 업데이트
- 반환: `{ error, count, type }`

**`captureTokenPageScreenshotAction(type: string)`**
- Playwright를 사용해 `http://localhost:3000/tokens/{type}` 스크린샷 캡처
- 저장 경로: `public/token-screenshots/{type}.png` (Next.js public 폴더)
- DB 업데이트: `token_sources.ui_screenshot = '/token-screenshots/{type}.png'`
- 반환: `{ error, screenshotPath }`

**`getTokenSourcesAction()`**
- 현재 프로젝트의 모든 token_sources 조회
- 반환: `TokenSource[]` (UI에서 "마지막 추출" 날짜·개수 표시용)

### 2-3. UI 변경

**토큰 페이지 헤더 (`TokenPageActions.tsx`)**

현재: CSS 복사, .css 저장, 전체 삭제 버튼만 있음

변경:
```
[컬러 토큰 추가하기] [CSS 복사] [.css 저장] [전체 삭제]
```
- 토큰이 0개일 때도 "추가하기" 버튼 표시 (현재는 count === 0이면 null 반환)
- 마지막 추출 정보 배너: "마지막 추출: 2026-03-23 14:30 · 7개 · 색상 프레임 URL"

**`TokenExtractModal` (신규 컴포넌트)**

```
┌─────────────────────────────────────┐
│  색상 토큰 추가하기                  │
├─────────────────────────────────────┤
│  Figma URL                          │
│  [________________________________] │
│  특정 프레임 URL을 입력하세요        │
│  (?node-id=... 포함 권장)           │
│                                     │
│  [취소]              [추출 시작하기] │
└─────────────────────────────────────┘
```

추출 진행 중 상태:
```
[추출 중...] → [스크린샷 캡처 중...] → [완료]
```

**토큰 페이지 스크린샷 섹션**

추출 완료 후 페이지 하단에:
```
┌─────────────────────────────────────┐
│ UI 검증 스크린샷                    │
│ 마지막 캡처: 2026-03-23 14:31       │
│                                     │
│ [스크린샷 이미지]                   │
│                                     │
│ [다시 캡처하기]                     │
└─────────────────────────────────────┘
```

---

## 3. 구현 순서

### Phase 1: DB 스키마 (0.5h)
- [ ] `schema.ts`에 `tokenSources` 테이블 추가
- [ ] `db/index.ts` `initTables()` + `migrateColumns()` 업데이트

### Phase 2: 추출 Action (1h)
- [ ] `src/lib/actions/tokens.ts`에 `extractTokensByTypeAction` 추가
- [ ] 기존 `extractTokensAction` 내부 로직을 함수로 분리해 재사용
- [ ] `getTokenSourcesAction` 추가

### Phase 3: 스크린샷 Action (1h)
- [ ] `playwright` 또는 `puppeteer` 추가 (이미 `playwright.config.ts` 존재 → playwright 사용)
- [ ] `captureTokenPageScreenshotAction` 구현
- [ ] `public/token-screenshots/` 디렉토리 설정

### Phase 4: UI (1.5h)
- [ ] `TokenPageActions.tsx`: count === 0일 때도 "추가하기" 버튼 노출
- [ ] `TokenExtractModal` 컴포넌트 신규 작성
- [ ] `TokenPage` 서버 컴포넌트: `getTokenSourcesAction()` 호출 → 마지막 추출 정보 + 스크린샷 섹션 렌더

---

## 4. 기술 결정

### Playwright 스크린샷
- 이미 `playwright.config.ts`가 프로젝트에 존재 → playwright 재사용
- Server Action 내부에서 `chromium.launch()` headless로 실행
- dev/prod 모두 동작해야 하므로 `BASE_URL` 환경변수 사용 (`NEXTAUTH_URL` 또는 `http://localhost:3000`)
- 스크린샷 실패는 non-blocking (추출은 성공, 캡처만 실패해도 에러 아님)

### 기존 `extractTokensAction` 재사용 전략
- 현재 extractor는 이미 `type` 별로 결과를 분리해서 반환 (`ExtractedTokens` 구조체)
- `extractTokensByTypeAction`에서 해당 type key만 DB에 저장하면 됨
- extractor 자체는 수정 불필요

### token_sources vs projects 컬럼 방식
- **선택: `token_sources` 별도 테이블** — 이유: 미래에 여러 URL 이력 관리, 타입별 버전 체크 독립적으로 가능, projects 테이블 비대화 방지

---

## 5. 엣지 케이스

| 상황 | 처리 방식 |
|------|----------|
| 이미 해당 타입 토큰 존재 | 추출 전 해당 type 토큰만 삭제 후 재삽입 |
| Variables API 403 (커뮤니티 파일) | 기존 node-scan fallback 동일 적용 |
| 스크린샷 서버 미실행 | captureTokenPageScreenshotAction에서 에러 캐치 후 null 반환 |
| 동일 Figma 파일에서 여러 타입 추출 | token_sources 각각 별도 레코드, file cache 공유 |
| node-id 없는 URL | 경고 배너 표시 후 추출 진행 (전체 파일 스캔) |

---

## 6. 범위 외 (다음 이터레이션)

- 여러 URL 이력 관리 (현재는 프로젝트당 타입별 1개)
- 자동 주기적 재추출 (cron)
- 스크린샷 diff 비교 (이전 vs 현재)
- 기존 `projects.figma_url` 마이그레이션 UI (기존 데이터 token_sources로 이전)
