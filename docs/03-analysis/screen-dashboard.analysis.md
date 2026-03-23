# Analysis: screen-dashboard Gap 분석

> 분석일: 2026-03-23
> Design 문서: `docs/02-design/features/screen-dashboard.design.md`
> 구현 범위: UI 디자인 구조 완료 / 기능 레이어 미착수 (의도된 2단계 구현)

---

## 1. Match Rate

| # | 항목 | 설계 | 구현 | 결과 |
|---|------|------|------|------|
| 1 | `screens` DB 테이블 + Drizzle schema | ✅ | ❌ | **Gap** |
| 2 | `ScreenMeta` 타입 (comment-parser) | ✅ | ❌ | **Gap** |
| 3 | `ScreenListItem` 타입 (Server Actions) | ✅ | 부분 | Gap (인라인 정의됨) |
| 4 | `comment-parser.ts` 파싱 로직 | ✅ | ❌ | **Gap** |
| 5 | `file-scanner.ts` + `extractRoute()` | ✅ | ❌ | **Gap** |
| 6 | `screens.ts` Server Actions (6종) | ✅ | ❌ | **Gap** |
| 7 | `playwright-generator.ts` + `writeSpecFile()` | ✅ | ❌ | **Gap** |
| 8 | `playwright.config.ts` testDir 설정 | ✅ | ❌ | **Gap** |
| 9 | `page.tsx` 대시보드 레이아웃 | ✅ | ✅ | 일치 |
| 10 | `page.module.scss` 전체 스타일 | ✅ | ✅ | 일치 |
| 11 | `ScreenTable.tsx` 화면 목록 테이블 | ✅ | ✅ | 일치 |
| 12 | `ScreenDrawer.tsx` 상세 Drawer | ✅ | ✅ | 일치 |
| 13 | `FigmaCompare.tsx` Figma vs 구현 비교 | ✅ | ✅ | 일치 |
| 14 | 통계 카드 4종 (전체/QA완료/개발완료/WIP) | ✅ | ✅ | 일치 |
| 15 | 상태 필터 칩 (all/wip/dev-done/qa-ready/qa-done) | ✅ | ✅ | 일치 |
| 16 | 상태 Badge 시각화 | ✅ | ✅ | 일치 |
| 17 | QA 점수 Bar + 숫자 표시 | ✅ | ✅ | 일치 |
| 18 | Figma 썸네일 / 미등록 placeholder | ✅ | ✅ | 일치 |
| 19 | Playwright 섹션 (점수바 + 액션 버튼) | ✅ | ✅ | 일치 |
| 20 | `ActivityBar.tsx` Section 타입 + 아이콘 | ✅ | ✅ | 일치 |
| 21 | `Sidebar.tsx` screens 패널 | ✅ | ✅ | 일치 |
| 22 | `AppShell.tsx` 라우트 + section 매핑 | ✅ | ✅ | 일치 |
| 23 | `TabBar.tsx` + `useUIStore.ts` Section 확장 | ✅ | ✅ | 일치 |

**Match Rate: 15 / 23 = 65%**

---

## 2. Gap 목록 (8개)

### Gap-1: DB 스키마 미구현
- **설계**: `src/lib/db/schema.ts`에 `screens` 테이블 추가 + Drizzle migration
- **현황**: 스키마 변경 없음
- **영향**: Server Actions 구현 불가, 실제 데이터 저장 불가
- **우선순위**: High (모든 기능의 기반)

### Gap-2: comment-parser.ts 미구현
- **설계**: `parsePageComment()` — 단일라인/JSDoc 양쪽 지원, 파일 앞 4KB만 파싱
- **현황**: 파일 없음
- **영향**: `// @page` 주석 자동 인식 불가
- **우선순위**: High

### Gap-3: file-scanner.ts 미구현
- **설계**: `scanPageFiles()` + `extractRoute()` — App Router 경로 변환 포함
- **현황**: 파일 없음
- **영향**: 동기화 버튼 동작 불가
- **우선순위**: High

### Gap-4: screens.ts Server Actions 미구현 (6종)
- **설계**: `syncScreensAction`, `getScreenListAction`, `getScreenDetailAction`, `captureFigmaScreenshotAction`, `updatePlaywrightResultAction`, `updateScreenStatusAction`
- **현황**: 파일 없음 — `page.tsx`는 DUMMY_SCREENS 하드코딩으로 동작
- **영향**: 실제 데이터 흐름 없음
- **우선순위**: High

### Gap-5: playwright-generator.ts 미구현
- **설계**: `generateSpecContent()` + `writeSpecFile()` (커스텀 블록 보존 로직 포함)
- **현황**: 파일 없음
- **영향**: spec 자동 생성 불가, Playwright 연동 불가
- **우선순위**: Medium

### Gap-6: playwright.config.ts 미설정
- **설계**: `tests/screens/` 디렉토리 자동 포함 확인
- **현황**: 기존 설정 유지 (파일은 존재하나 screens 관련 검증 안됨)
- **영향**: spec 생성 후 실행 경로 문제 가능성
- **우선순위**: Low

### Gap-7: ScreenListItem 타입 분산
- **설계**: `src/lib/actions/screens.ts`에서 공식 export
- **현황**: `ScreenTable.tsx` 내부 인라인 정의 — 향후 Server Actions와 타입 불일치 위험
- **영향**: 타입 통합 시 리팩토링 필요
- **우선순위**: Medium (기능 구현 전 해결 권장)

### Gap-8: FigmaCompare 캡처 버튼 미연결
- **설계**: `captureFigmaScreenshotAction()` 호출
- **현황**: 버튼 UI만 존재, `onClick` 없음
- **영향**: Figma 스크린샷 캡처 불가 (기능 구현 전 정상)
- **우선순위**: Low (기능 단계에서 처리)

---

## 3. 구현 단계 평가

현재 구현은 **"디자인 구조 먼저, 기능은 나중에"** 원칙에 따른 의도된 1단계 완료 상태.

| 레이어 | 설계 항목 | 구현 | Match |
|--------|----------|------|-------|
| UI 컴포넌트 | 5개 (page, Table, Drawer, Compare, SCSS) | 5개 | 100% |
| 레이아웃 연결 | 4개 (ActivityBar, Sidebar, AppShell, TabBar/Store) | 4개 | 100% |
| 데이터 레이어 | 6개 (schema, parser, scanner, actions, pw-gen, config) | 0개 | 0% |
| 타입 정의 | 완전한 분리 | 인라인 정의 | 65% |

---

## 4. 다음 구현 순서 (Gap 해소)

```
Step 1: DB 스키마                   → src/lib/db/schema.ts (Gap-1)
  ↓
Step 2: comment-parser.ts           → src/lib/screens/comment-parser.ts (Gap-2)
  ↓
Step 3: file-scanner.ts             → src/lib/screens/file-scanner.ts (Gap-3)
  ↓
Step 4: Server Actions 타입 통합     → ScreenListItem을 screens.ts로 이동 (Gap-7)
  ↓
Step 5: screens.ts Server Actions   → 6종 구현 + page.tsx 더미 데이터 교체 (Gap-4)
  ↓
Step 6: playwright-generator.ts     → src/lib/screens/playwright-generator.ts (Gap-5)
  ↓
Step 7: FigmaCompare 캡처 연결      → onClick + captureFigmaScreenshotAction (Gap-8)
  ↓
Step 8: playwright.config.ts 검증   → tests/screens/ 경로 확인 (Gap-6)
```

---

## 5. 재분석 기준

기능 구현 완료 후 재분석 시 목표:

| 기준 | 목표 |
|------|------|
| Match Rate | ≥ 90% |
| `// @page` 파싱 정확도 | 기존 8개 파일 100% |
| 동기화 실행 시간 | 50개 파일 기준 1초 이내 |
| Playwright spec 생성 | 화면당 기본 3개 테스트 |
| DB-UI 연동 | 더미 데이터 제거, 실제 데이터 표시 |
