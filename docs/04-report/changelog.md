# PixelForge Changelog

## [2026-04-02] - token-history Feature Complete (Snapshot-Based Token History)

### Added
- `SnapshotHistory.tsx` (254줄) — 토큰 변경 이력 UI 컴포넌트
  - sync 타임라인 (버전, 날짜, 소스, 토큰 수 요약)
  - 추가/삭제/변경된 토큰 목록 표시 (+/-/~ 칩)
  - 상세 패널 (클릭 시 토큰 이름, 타입, oldRaw → newRaw)
  - 빈 상태 UI + 로딩 상태
- `snapshot-history.module.scss` (249줄) — 스타일 (모든 CSS 변수 기반)
  - WCAG AA 명도대비 준수 (--success, --danger, --warning)
  - 반응형 flexbox 레이아웃
- `getSnapshotDetailAction()` — 스냅샷 상세 데이터 조회
  - 신규 형식(토큰 목록) vs 구형식(숫자) 자동 감지
  - 구형식 스냅샷은 tokensData 비교로 on-demand 계산
- `getActiveSnapshotListAction()` — 활성 프로젝트 스냅샷 목록 (prop drilling 제거)
- `SnapshotInfo.diffCounts` 필드 — 변경 수 요약

### Changed
- `pipeline.ts` — `diffSummary` 구조 확장
  - 기존: `{added: N, removed: N, changed: N}` (숫자만)
  - 변경: `{added: [{name, type}, ...], removed: [...], changed: [{name, type, oldRaw, newRaw}, ...]}` (토큰 목록)
  - 역호환성: 구형식 자동 감지 및 처리
- `TokenDashboard.tsx` — `SnapshotHistory` 컴포넌트 통합 (diff/page → TokenDashboard)
- `actions/tokens.ts` — `SnapshotInfo`, `SnapshotDetail`, `SnapshotDiffEntry` 인터페이스 추가

### Removed
- `TokenCommitHistory.tsx` (50줄) — git 기반 히스토리 컴포넌트 (대체됨)
- `token-commit-history.module.scss` (80줄) — git 컴포넌트 스타일
- `src/lib/git/token-commits.ts` (120줄) — git auto-commit 로직
- `src/lib/actions/token-history.ts` (200줄) — git 기반 server actions
- 약 450줄의 레거시 git 로직 제거

### Fixed
- SCSS 컨벤션 위반: 하드코딩된 hex 색상(`#4ade80`, `#f87171`, `#fb923c`) → CSS 변수 변경
  - `--success`, `--danger`, `--warning` + `-subtle` 변형 활용

### Deployment Notes
- **Breaking Changes**: None (diffSummary 형식 확장만 — 이전 스냅샷도 호환)
- **Database Migration**: None (tokenSnapshots 테이블 스키마 변경 없음, diffSummary 컬럼 TEXT)
- **Build Status**: ✅ Clean (`npm run build`, `npm run lint`)
- **Design Match**: 91% (Check phase 통과, 모든 컨벤션 준수)

### Technical Summary
- **Files Added**: 2 (SnapshotHistory.tsx, snapshot-history.module.scss)
- **Files Modified**: 3 (pipeline.ts, actions/tokens.ts, TokenDashboard.tsx)
- **Files Removed**: 5 (git 기반 레거시 컴포넌트)
- **Type Safety**: 100% TypeScript strict (zero `any` types)
- **Performance**: 스냅샷 목록은 캐시됨, 상세는 온디맨드 로드
- **Race Condition**: DetailPanel에서 `cancelled` 플래그로 보호
- **Accessibility**: 버튼 aria-labels, 의미있는 HTML

### Feature Highlights
- **역호환성**: 구형식 스냅샷(숫자만)도 tokensData 비교로 상세 정보 제공 — 즉시 이력 조회 가능
- **무마이그레이션**: 스키마 변경 없음, 기존 데이터 그대로 활용
- **컴포넌트 추출**: DetailPanel 분리로 관심사 분리 및 재사용성 향상
- **CSS 변수 규칙**: CLAUDE.md 컨벤션 100% 준수

### References
- **Completion Report**: [docs/04-report/token-history.report.md](./token-history.report.md)
- **Design Document**: [docs/02-design/features/token-history.design.md](../02-design/features/token-history.design.md)
- **Analysis**: [docs/03-analysis/token-history.analysis.md](../03-analysis/token-history.analysis.md)

---

## [2026-04-02] - db Feature Complete (Plugin Token Pipeline)

### Added
- `parse-variables.ts` (294줄) — Figma Variables API payload → NormalizedToken[] 파서
  - COLOR → hex/rgba 변환, FLOAT 타입 분류 (radius/spacing/typography), 폰트 스타일 추출
  - Alias 처리, 중복 제거, 모드별 토큰 저장
- `pipeline.ts` (345줄) — 공통 5단계 후처리 파이프라인
  - tokens 테이블 upsert, diff 계산, tokenSnapshots 저장, CSS 재생성, token_sources 업데이트
  - token_type_configs 동적 메뉴 자동 등록, 스크린샷 백그라운드 트리거
- `snapshot-engine.ts` (140줄) — Diff 엔진 + tokenCounts 계산
  - 타입별 변경 수 집계 (added/removed/changed)
- 플러그인 sync 수신 시 정규화 기준 해시 비교로 중복 sync 감지
- AppShell 자동 폴링 (5초) — 새 버전 감지 시 router.refresh() 실행
- 설정 페이지 버전 이력 토글 + 롤백 UI (expandedProjectId 상태 관리)

### Changed
- `/api/sync/tokens` 엔드포인트 — parseVariablesPayload + runTokenPipeline 연결
  - 중복 sync 감지로 changed: false 반환 시 불필요한 처리 스킵
  - 활성 프로젝트 명시적 설정 (setActiveProject)
- Figma Variables API와 PixelForge 정규화 토큰 간 완전한 연동

### Fixed
- 플러그인이 보낸 토큰이 raw JSON으로만 저장되고 동작하지 않던 문제 해결
- 파이프라인 단계별 에러 내성 (CSS/스크린샷 실패 시 파이프라인 중단 안 함)

### Deployment Notes
- **Breaking Changes**: None (기존 토큰 구조 유지)
- **Database Migration**: Automatic (syncPayloads, tokenSnapshots 테이블)
- **Build Status**: ✅ Clean (`npm run build`, `npm run lint`)
- **Test Result**: ✅ 96% Match Rate (GAP-03, 05, 08, 09 모두 낮은 우선순위)

### Technical Summary
- **Files Added**: 3 (parse-variables.ts, pipeline.ts, snapshot-engine.ts)
- **Files Modified**: 4 (route.ts, AppShell.tsx, settings/page.tsx, schema.ts)
- **New Tables**: 1 (syncPayloads, tokenSnapshots 스키마 확장)
- **Type Safety**: 100% TypeScript strict (zero `any` types)
- **Performance**: Normalized tokens 기준 해시 비교로 중복 sync 스킵
- **Real-time**: 5초 폴링 + 자동 새로고침

### References
- **Completion Report**: [docs/04-report/features/db.report.md](./features/db.report.md)
- **Design Document**: [docs/02-design/features/db.design.md](../02-design/features/db.design.md)
- **Analysis**: [docs/03-analysis/db.analysis.md](../03-analysis/db.analysis.md)

---

## [2026-04-02] - single-project Feature Complete

### Added
- `app_settings` SQLite table for explicit application settings storage
- `appSettings` Drizzle ORM schema definition
- `getActiveProject()` helper function with 2-tier fallback logic
- `setActiveProject(projectId)` async server action for explicit project activation
- `token_sources` upsert step in token pipeline for consistency

### Changed
- 8 implicit project queries in `tokens.ts` replaced with centralized `getActiveProject()` helper
- Plugin sync route now explicitly sets active project after pipeline completes
- Improved hash comparison to normalize tokens before hashing (prevents false-positive duplicates)

### Fixed
- Resolved data inconsistency issue where UI could display wrong project's tokens
- Fixed race condition where concurrent sync requests could create duplicate projects
- Eliminated guesswork `orderBy(updatedAt).limit(1)` pattern from all token actions

### Deployment Notes
- **Breaking Changes**: None (fully backward compatible)
- **Database Migration**: Automatic (DDL creates table if missing)
- **Fallback Available**: Works with existing DBs via graceful degradation
- **Build Status**: ✅ Clean (`npm run build`, `npm run lint`)
- **Test Result**: ✅ 100% Match Rate (all design gaps resolved)

### Technical Summary
- **Files Modified**: 4 (schema.ts, db/index.ts, tokens.ts, sync/tokens/route.ts)
- **New Tables**: 1 (app_settings)
- **Schema Changes**: 0 breaking changes (new table only)
- **Type Safety**: 100% TypeScript strict (zero `any` types)
- **Performance**: Single DB query + 1 optional fallback (no N+1)

### References
- **Completion Report**: [docs/04-report/features/single-project.report.md](./features/single-project.report.md)
- **Design Document**: [docs/02-design/features/single-project.design.md](../02-design/features/single-project.design.md)
