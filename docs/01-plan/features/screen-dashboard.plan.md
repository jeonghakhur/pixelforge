# screen-dashboard Plan

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 퍼블리싱된 화면이 어떤 담당자가 언제 작업했는지, Figma 원본 대비 구현이 정확한지, QA 결과가 어디에 있는지 한 곳에서 파악할 수 없음 |
| **Solution** | 파일 상단 `// @page` 주석 파싱 → 화면 메타 자동 등록 + Figma 프레임 캡처 비교 + Playwright 검수 결과 통합 대시보드 |
| **Function UX Effect** | 기획·디자인·개발·QA 전 직군이 한 화면에서 작업 현황과 구현 품질을 실시간으로 확인 |
| **Core Value** | 주석 한 줄로 화면이 자동 등록되는 Zero-friction 품질 관리 — 별도 문서 없이 코드가 곧 대시보드 |

---

## 1. 문제 정의

### 1.1 현재 상황

프로젝트에는 이미 `// @page` 컨벤션이 정착되어 있다:

```tsx
// src/app/(ide)/settings/page.tsx
// @page Settings — 설정 (일반/팀원/Figma 탭)

// src/app/(ide)/diff/page.tsx
// @page Diff — 변경 감지
```

8개 페이지 모두 이 패턴을 따르지만, 이 정보는 단순 주석으로만 존재하며:
- 어디서도 수집·관리되지 않음
- 담당자(기획/디자인/개발), 작업일, 상태를 표현할 수 없음
- Figma 프레임과의 연결이 없음
- QA 결과를 연동할 방법이 없음

### 1.2 목표 화면

```
┌────────────────────────────────────────────────────────────┐
│  화면 대시보드                                      [동기화]  │
├───────────┬───────────────┬──────────┬─────────┬──────────┤
│  화면명    │  담당자       │  상태    │  Figma  │  QA      │
├───────────┼───────────────┼──────────┼─────────┼──────────┤
│  Settings │  김디자인 외2 │  dev-done│  비교   │  85%     │
│  Home     │  이개발       │  qa-done │  비교   │  100%    │
│  Diff     │  박기획 외1   │  wip     │  미등록 │  -       │
└───────────┴───────────────┴──────────┴─────────┴──────────┘
```

---

## 2. 주석 메타데이터 규격 설계

### 2.1 확장 주석 포맷

기존 단일 라인을 **JSDoc 블록**으로 확장한다. 기존 단일 라인 방식도 하위 호환 지원:

```tsx
/**
 * @page Settings — 설정
 * @author 김디자인, 이개발, 박기획
 * @since 2025-01-15
 * @updated 2025-03-20
 * @status dev-done
 * @figma https://www.figma.com/design/xxx?node-id=1-2
 * @category settings
 */
```

단일 라인(기존 호환):
```tsx
// @page Settings — 설정 (일반/팀원/Figma 탭)
```

### 2.2 필드 정의

| 필드 | 필수 | 설명 | 예시 |
|------|------|------|------|
| `@page` | ✅ | `이름 — 설명` 형식 | `Settings — 설정` |
| `@author` | - | 쉼표 구분 담당자 (기획/디자인/개발 포함) | `김디자인, 이개발` |
| `@since` | - | 작업 시작일 (YYYY-MM-DD) | `2025-01-15` |
| `@updated` | - | 최종 수정일 (YYYY-MM-DD) | `2025-03-20` |
| `@status` | - | 진행 상태 | `wip`, `dev-done`, `qa-ready`, `qa-done` |
| `@figma` | - | Figma 프레임 URL | `https://figma.com/design/...` |
| `@category` | - | 분류 | `auth`, `settings`, `tokens`, `components` |

### 2.3 상태 정의

```
wip        → 작업 중 (기본값, 미정의 시)
dev-done   → 개발 완료, QA 대기
qa-ready   → QA 환경 배포 완료
qa-done    → QA 완료, 릴리즈 가능
```

---

## 3. 시스템 아키텍처

### 3.1 전체 흐름

```
[파일 시스템]
page.tsx (// @page 주석)
        │
        ▼
[파서] src/lib/screens/comment-parser.ts
        │ ScreenMeta[]
        ▼
[동기화 Action] syncScreensAction()
        │ upsert
        ▼
[DB] screens 테이블 (SQLite)
        │
        ├─ [대시보드 UI] /screens 페이지
        │       ├─ 메타 목록 + 상태 뱃지
        │       ├─ Figma 캡처 비교 패널
        │       └─ Playwright 결과 표시
        │
        ├─ [Figma 연동] /api/screens/[id]/figma-capture
        │       └─ Figma REST API → 스크린샷 저장
        │
        └─ [Playwright] playwright/screens/*.spec.ts
                └─ 결과 → screens.playwrightStatus 업데이트
```

### 3.2 데이터 흐름 상세

```
1. 수동/자동 동기화 트리거
   └─ scanPageFiles() → glob("src/**/(page|page.tsx)")
         └─ parsePageComment(file) → ScreenMeta

2. DB upsert
   └─ route 기준 upsert (중복 방지)

3. Figma 캡처 등록 (수동)
   └─ 사용자가 Figma URL 입력
         └─ FigmaClient.getImage() → base64
               └─ 파일 저장 → DB figmaScreenshot 업데이트

4. 실제 구현 스크린샷 (Playwright)
   └─ playwright: page.screenshot()
         └─ 결과 파일 → DB implScreenshot 업데이트

5. Playwright 검수 실행
   └─ 자동 생성된 spec 파일 실행
         └─ 결과 JSON → DB playwrightStatus 업데이트
```

---

## 4. 데이터베이스 스키마

### 4.1 신규 테이블: `screens`

```ts
export const screens = sqliteTable('screens', {
  id: text('id').primaryKey(),

  // 파일 정보
  route: text('route').notNull().unique(),        // '/settings', '/'
  filePath: text('file_path').notNull(),           // 'src/app/(ide)/settings/page.tsx'

  // @page 파싱 결과
  name: text('name').notNull(),                    // 'Settings'
  description: text('description'),               // '설정 (일반/팀원/Figma 탭)'
  authors: text('authors'),                       // JSON: ['김디자인', '이개발']
  category: text('category'),                     // 'settings'

  // 작업 이력
  status: text('status', {
    enum: ['wip', 'dev-done', 'qa-ready', 'qa-done']
  }).default('wip'),
  sinceDate: text('since_date'),                  // '2025-01-15'
  updatedDate: text('updated_date'),              // '2025-03-20'

  // Figma 연동
  figmaUrl: text('figma_url'),
  figmaScreenshot: text('figma_screenshot'),      // 파일 경로 또는 base64

  // 구현 스크린샷 (Playwright)
  implScreenshot: text('impl_screenshot'),        // 파일 경로

  // Playwright 검수 결과
  playwrightStatus: text('playwright_status', {
    enum: ['pending', 'pass', 'fail', 'skip']
  }).default('pending'),
  playwrightScore: integer('playwright_score'),   // 0-100
  playwrightReport: text('playwright_report'),    // JSON 결과

  // 타임스탬프
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

---

## 5. 핵심 모듈 설계

### 5.1 주석 파서 — `src/lib/screens/comment-parser.ts`

**입력**: `page.tsx` 파일 경로
**출력**: `ScreenMeta` 객체

```ts
export interface ScreenMeta {
  route: string;
  filePath: string;
  name: string;
  description: string | null;
  authors: string[];
  category: string | null;
  status: 'wip' | 'dev-done' | 'qa-ready' | 'qa-done';
  sinceDate: string | null;
  updatedDate: string | null;
  figmaUrl: string | null;
}

// 파싱 예시
// "// @page Settings — 설정"  → { name: 'Settings', description: '설정' }
// "// @author 김디자인, 이개발" → { authors: ['김디자인', '이개발'] }
```

지원 포맷:
- `// @field value` (단일 라인)
- `/** @field value */` (JSDoc 블록)

### 5.2 파일 스캐너 — `src/lib/screens/file-scanner.ts`

```ts
// Next.js App Router 구조에서 route 자동 추출
// src/app/(ide)/settings/page.tsx → /settings
// src/app/(ide)/page.tsx         → /
// src/app/(auth)/login/page.tsx  → /login

export async function scanPageFiles(): Promise<ScreenMeta[]>
```

### 5.3 Playwright 스펙 생성기 — `src/lib/screens/playwright-generator.ts`

각 화면에 대한 기본 spec 파일 자동 생성:

```ts
// 생성 결과 예시: tests/screens/settings.spec.ts
test('Settings 화면 렌더링', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL('/settings');
  await page.screenshot({ path: 'test-results/screens/settings.png' });
  // 추가 커스텀 테스트 블록
});
```

---

## 6. UI 설계

### 6.1 신규 라우트: `/screens`

기존 `/pages` (파일 관리)와 분리된 새 섹션.

```
Activity Bar 메뉴 추가:
  - 현재: Home / Tokens / Components / Pages / Diff / Settings
  - 추가:  Home / Tokens / Components / Pages / [Screens] / Diff / Settings
```

### 6.2 대시보드 레이아웃

```
┌─ 헤더 ──────────────────────────────────────────────────────────┐
│  화면 대시보드    [상태 필터 ▼]  [카테고리 ▼]  [동기화] [+ 수동등록] │
├─ 통계 카드 (4종) ──────────────────────────────────────────────┤
│  전체 12  /  qa-done 5  /  dev-done 4  /  wip 3               │
├─ 화면 목록 테이블 ──────────────────────────────────────────────┤
│  화면명  │  라우트  │  담당자  │  상태  │  Figma  │  QA 점수  │ 액션│
│  ...                                                           │
└───────────────────────────────────────────────────────────────┘
```

### 6.3 화면 상세 패널 (Row 클릭 시 Drawer)

```
┌─ Settings 상세 ──────────────────────────────────────┐
│  /settings · dev-done · 2025-01-15 시작              │
│  담당자: 김디자인, 이개발, 박기획                      │
│                                                      │
│  ┌── Figma 원본 ──┐  ┌── 실제 구현 ──┐              │
│  │   캡처 이미지   │  │  스크린샷    │              │
│  │  (등록/교체)    │  │  (Playwright) │              │
│  └────────────────┘  └──────────────┘              │
│                                                      │
│  Playwright 결과  ●●●●●○ 85점 (2025-03-20)         │
│  [spec 보기]  [재실행]  [결과 리포트]                │
│                                                      │
│  변경 이력                                           │
│  2025-03-20  updated_date 수정                      │
│  2025-01-15  최초 등록                              │
└──────────────────────────────────────────────────────┘
```

---

## 7. 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/db/schema.ts` | `screens` 테이블 추가 |
| `src/lib/screens/comment-parser.ts` | **신규** — `// @page` 주석 파서 |
| `src/lib/screens/file-scanner.ts` | **신규** — page.tsx 파일 스캐너 |
| `src/lib/screens/playwright-generator.ts` | **신규** — spec 파일 자동 생성 |
| `src/lib/actions/screens.ts` | **신규** — Server Actions (CRUD + 동기화) |
| `src/app/(ide)/screens/page.tsx` | **신규** — 대시보드 메인 |
| `src/app/(ide)/screens/page.module.scss` | **신규** |
| `src/app/(ide)/screens/ScreenTable.tsx` | **신규** — 화면 목록 테이블 |
| `src/app/(ide)/screens/ScreenDrawer.tsx` | **신규** — 상세 Drawer |
| `src/app/(ide)/screens/FigmaCompare.tsx` | **신규** — Figma vs 구현 비교 |
| `src/components/layout/ActivityBar.tsx` | `screens` 메뉴 아이콘 추가 |
| `src/components/layout/Sidebar.tsx` | `screens` 섹션 추가 |
| `playwright.config.ts` | 화면 스펙 경로 설정 |

---

## 8. 비기능 요건

- `scanPageFiles()` 실행 시간: 1초 이내 (로컬 파일 시스템 접근)
- Playwright spec 자동 생성: 기존 커스텀 테스트 블록 보존 (덮어쓰기 금지)
- Figma 캡처: 기존 `FigmaClient` 재사용 (`/images` endpoint)
- DB 스키마 마이그레이션: Drizzle migration 파일 생성
- 스크린샷 저장 경로: `public/screens/` (Next.js static 파일)

---

## 9. 성공 기준

| 기준 | 목표 |
|------|------|
| `// @page` 주석 파싱 정확도 | 기존 8개 파일 100% 자동 인식 |
| 동기화 시간 | 파일 50개 기준 1초 이내 |
| Figma 캡처 등록 | URL 붙여넣기 → 3초 내 프리뷰 표시 |
| Playwright spec 생성 | 화면당 기본 3개 테스트 자동 생성 |
| 검수 결과 표시 | pass/fail + 점수 + 스크린샷 연동 |

---

## 10. 구현 순서

1. **DB 스키마** — `screens` 테이블 + migration (30분)
2. **주석 파서** — `comment-parser.ts` + 단위 테스트 (1시간)
3. **파일 스캐너** — `file-scanner.ts` + route 추출 (30분)
4. **Server Actions** — `screens.ts` CRUD + 동기화 액션 (1시간)
5. **대시보드 UI** — `/screens` 페이지 + 테이블 (2시간)
6. **상세 Drawer** — Figma 비교 + 캡처 등록 (2시간)
7. **Playwright 연동** — spec 생성기 + 결과 파싱 (2시간)
8. **ActivityBar/Sidebar** — 메뉴 추가 (30분)
