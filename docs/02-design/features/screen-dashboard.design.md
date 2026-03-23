# screen-dashboard Design

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | `// @page` 주석이 코드에 존재하지만 수집·관리되지 않아 화면 현황 파악 불가 |
| **Solution** | 주석 파서 → 파일 스캐너 → DB upsert → 대시보드 UI + Figma 비교 + Playwright 연동 |
| **Function UX Effect** | 동기화 버튼 한 번으로 전체 화면 목록 갱신, Row 클릭으로 Figma 원본 vs 구현 비교 |
| **Core Value** | `// @page` 주석 → DB → 대시보드의 Zero-friction 파이프라인 |

---

## 1. 모듈 구조

```
src/lib/screens/
├── comment-parser.ts          # 주석 파싱 (단일 라인 + JSDoc 블록)
├── file-scanner.ts            # App Router 파일 스캔 + route 추출
└── playwright-generator.ts    # spec 파일 자동 생성

src/lib/actions/screens.ts     # Server Actions (CRUD + 동기화)
src/lib/db/schema.ts           # screens 테이블 추가

src/app/(ide)/screens/
├── page.tsx                   # 대시보드 메인 (Server Component)
├── page.module.scss
├── ScreensClient.tsx          # 필터/정렬 상태 관리 (Client Component)
├── ScreenTable.tsx            # 화면 목록 테이블
├── ScreenDrawer.tsx           # 상세 Drawer (슬라이드 패널)
└── FigmaCompare.tsx           # Figma 원본 vs 구현 비교

src/components/layout/ActivityBar.tsx   # Section 타입 + 아이콘 추가
src/components/layout/Sidebar.tsx       # screens 섹션 추가
```

---

## 2. 타입 정의

### 2.1 핵심 타입

```ts
// src/lib/screens/comment-parser.ts

export type ScreenStatus = 'wip' | 'dev-done' | 'qa-ready' | 'qa-done';

export interface ScreenMeta {
  route: string;          // '/settings', '/', '/login'
  filePath: string;       // 'src/app/(ide)/settings/page.tsx'
  name: string;           // 'Settings'
  description: string | null;
  authors: string[];      // ['김디자인', '이개발']
  category: string | null;
  status: ScreenStatus;
  sinceDate: string | null;   // 'YYYY-MM-DD'
  updatedDate: string | null;
  figmaUrl: string | null;
}
```

### 2.2 DB Row 타입 (Drizzle infer)

```ts
// 사용처에서 import
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { screens } from '@/lib/db/schema';

export type ScreenRow = InferSelectModel<typeof screens>;
export type ScreenInsert = InferInsertModel<typeof screens>;
```

### 2.3 Server Actions 인터페이스

```ts
// src/lib/actions/screens.ts

export interface ScreenListItem {
  id: string;
  route: string;
  name: string;
  description: string | null;
  authors: string[];           // JSON 파싱 결과
  category: string | null;
  status: ScreenStatus;
  sinceDate: string | null;
  updatedDate: string | null;
  figmaUrl: string | null;
  figmaScreenshot: string | null;
  implScreenshot: string | null;
  playwrightStatus: 'pending' | 'pass' | 'fail' | 'skip';
  playwrightScore: number | null;
  updatedAt: Date;
}

export interface SyncResult {
  added: number;
  updated: number;
  total: number;
}

export interface FigmaCaptureResult {
  screenshotPath: string;   // 'public/screens/{id}-figma.png'
}
```

---

## 3. DB 스키마 변경

### 3.1 screens 테이블 — `src/lib/db/schema.ts`

기존 파일 끝에 추가:

```ts
export const screens = sqliteTable('screens', {
  id: text('id').primaryKey(),

  // 파일 정보
  route: text('route').notNull().unique(),
  filePath: text('file_path').notNull(),

  // @page 파싱 결과
  name: text('name').notNull(),
  description: text('description'),
  authors: text('authors'),                    // JSON string: '["김디자인","이개발"]'
  category: text('category'),

  // 작업 이력
  status: text('status', {
    enum: ['wip', 'dev-done', 'qa-ready', 'qa-done'],
  }).notNull().default('wip'),
  sinceDate: text('since_date'),
  updatedDate: text('updated_date'),

  // Figma 연동
  figmaUrl: text('figma_url'),
  figmaScreenshot: text('figma_screenshot'),   // 파일 경로 'public/screens/{id}-figma.png'

  // 구현 스크린샷
  implScreenshot: text('impl_screenshot'),     // 'public/screens/{id}-impl.png'

  // Playwright 검수
  playwrightStatus: text('playwright_status', {
    enum: ['pending', 'pass', 'fail', 'skip'],
  }).notNull().default('pending'),
  playwrightScore: integer('playwright_score'),
  playwrightReport: text('playwright_report'), // JSON string

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

---

## 4. 주석 파서 — `comment-parser.ts`

### 4.1 파싱 로직

```
지원 포맷 A — 단일 라인 (기존 호환):
  // @page Settings — 설정
  // @author 김디자인, 이개발

지원 포맷 B — JSDoc 블록:
  /**
   * @page Settings — 설정
   * @author 김디자인, 이개발
   * @since 2025-01-15
   * @status dev-done
   * @figma https://figma.com/...
   * @category settings
   */
```

### 4.2 정규식 패턴

```ts
// 파일 앞 4KB만 읽어 파싱 (성능)
const SINGLE_LINE_RE = /\/\/\s*@(\w+)\s+(.+)/g;
const JSDOC_TAG_RE   = /\*\s*@(\w+)\s+(.+)/g;

// @page 값 파싱: "Settings — 설정" → name='Settings', description='설정'
const PAGE_RE = /^(.+?)\s*[—\-–]\s*(.+)$/;
```

### 4.3 함수 시그니처

```ts
/**
 * page.tsx 파일에서 @page 주석 메타데이터를 파싱한다.
 * 파일 앞 4KB만 읽어 성능을 보장한다.
 * @page 태그가 없으면 null을 반환한다.
 */
export function parsePageComment(
  filePath: string,
  fileContent: string
): ScreenMeta | null

/**
 * @page 값 "Settings — 설정" 을 분리한다.
 */
function parseName(raw: string): { name: string; description: string | null }

/**
 * 쉼표 구분 담당자 문자열을 배열로 변환한다.
 * "김디자인, 이개발" → ["김디자인", "이개발"]
 */
function parseAuthors(raw: string): string[]
```

---

## 5. 파일 스캐너 — `file-scanner.ts`

### 5.1 route 추출 규칙

Next.js App Router 경로 변환:

```
src/app/(ide)/settings/page.tsx  →  /settings
src/app/(ide)/page.tsx           →  /
src/app/(auth)/login/page.tsx    →  /login
src/app/viewer/page.tsx          →  /viewer
src/app/(ide)/tokens/[type]/page.tsx  →  /tokens/[type]
src/app/(ide)/components/[name]/page.tsx  →  /components/[name]
```

변환 규칙:
1. `src/app/` 접두사 제거
2. `(group)/` 패턴 제거 (Route Groups)
3. `/page.tsx` 접미사 제거
4. 빈 문자열 → `/`

### 5.2 함수 시그니처

```ts
import { readFile } from 'fs/promises';
import { glob } from 'glob';

/**
 * src/app 하위 모든 page.tsx 파일을 스캔하여 ScreenMeta 목록을 반환한다.
 * @page 주석이 없는 파일은 결과에 포함하지 않는다.
 */
export async function scanPageFiles(): Promise<ScreenMeta[]>

/**
 * 파일 경로에서 Next.js 라우트 문자열을 추출한다.
 * src/app/(ide)/settings/page.tsx → /settings
 */
export function extractRoute(filePath: string): string
```

### 5.3 glob 패턴

```ts
const files = await glob('src/app/**/page.tsx', {
  cwd: process.cwd(),
  absolute: false,
});
// page.module.scss, page.test.ts 등은 자동 제외됨
```

---

## 6. Server Actions — `screens.ts`

### 6.1 함수 목록

```ts
'use server';

/**
 * 파일 시스템 스캔 후 DB upsert.
 * route 기준으로 기존 레코드는 업데이트, 신규는 insert.
 */
export async function syncScreensAction(): Promise<SyncResult>

/**
 * 전체 화면 목록 조회 (status 필터 + category 필터 지원).
 */
export async function getScreenListAction(filters?: {
  status?: ScreenStatus | 'all';
  category?: string | 'all';
}): Promise<ScreenListItem[]>

/**
 * 단건 화면 상세 조회.
 */
export async function getScreenDetailAction(id: string): Promise<ScreenListItem | null>

/**
 * Figma URL로 스크린샷을 캡처하여 파일 저장 후 DB 업데이트.
 * 기존 FigmaClient.getImage() 재사용.
 */
export async function captureFigmaScreenshotAction(
  id: string,
  figmaUrl: string
): Promise<FigmaCaptureResult>

/**
 * Playwright 결과 JSON을 받아 DB 업데이트.
 * playwright-generator가 생성한 spec 실행 후 호출.
 */
export async function updatePlaywrightResultAction(
  id: string,
  result: { status: 'pass' | 'fail'; score: number; report: object }
): Promise<void>

/**
 * 화면 상태(status)를 수동으로 변경.
 */
export async function updateScreenStatusAction(
  id: string,
  status: ScreenStatus
): Promise<void>
```

### 6.2 syncScreensAction 내부 흐름

```
1. scanPageFiles()  →  ScreenMeta[]
2. 기존 DB screens 전체 조회  →  Map<route, id>
3. ScreenMeta[] 순회:
   - route 존재 → UPDATE (name, description, authors, status, figmaUrl, updatedAt)
   - 신규         → INSERT (id = nanoid())
4. SyncResult { added, updated, total } 반환
```

### 6.3 captureFigmaScreenshotAction 내부 흐름

```
1. figmaUrl에서 fileKey + nodeId 추출 (extractNodeId 재사용)
2. FigmaClient.getImage(fileKey, [nodeId], 'png') 호출
3. 반환된 URL에서 이미지 fetch → ArrayBuffer
4. fs.writeFile('public/screens/{id}-figma.png')
5. DB update: figmaScreenshot = '/screens/{id}-figma.png'
```

---

## 7. Playwright 생성기 — `playwright-generator.ts`

### 7.1 생성 위치

```
tests/screens/{routeSlug}.spec.ts
예: /settings → tests/screens/settings.spec.ts
예: /tokens/[type] → tests/screens/tokens-type.spec.ts  ([] 제거, / → -)
```

### 7.2 생성 템플릿

```ts
export function generateSpecContent(screen: ScreenMeta): string {
  const slug = routeToSlug(screen.route); // '/settings' → 'settings'
  return `import { test, expect } from '@playwright/test';

// @generated screen-dashboard — 수동 수정 시 @custom 블록 안에 작성
// 이 파일은 syncScreensAction() 실행 시 재생성됩니다

test.describe('${screen.name}', () => {
  test('페이지 접근 및 렌더링', async ({ page }) => {
    await page.goto('${screen.route}');
    await expect(page).toHaveURL('${screen.route}');
    await page.screenshot({
      path: 'test-results/screens/${slug}.png',
      fullPage: true,
    });
  });

  test('기본 레이아웃 요소 존재', async ({ page }) => {
    await page.goto('${screen.route}');
    await expect(page.locator('main')).toBeVisible();
  });

  // @custom — 아래에 커스텀 테스트 추가
});
`;
}
```

### 7.3 덮어쓰기 방지

```ts
/**
 * spec 파일을 생성한다. 이미 존재하면 @custom 블록 이후 내용을 보존한다.
 */
export async function writeSpecFile(screen: ScreenMeta): Promise<void> {
  const specPath = getSpecPath(screen.route);
  const exists = await fileExists(specPath);

  if (exists) {
    const existing = await readFile(specPath, 'utf-8');
    const customIdx = existing.indexOf('// @custom');
    if (customIdx !== -1) {
      // @custom 블록 이후 내용 보존
      const customBlock = existing.slice(customIdx);
      const generated = generateSpecContent(screen);
      const baseIdx = generated.indexOf('// @custom');
      const newContent = generated.slice(0, baseIdx) + customBlock;
      await writeFile(specPath, newContent, 'utf-8');
      return;
    }
  }

  await writeFile(specPath, generateSpecContent(screen), 'utf-8');
}
```

---

## 8. UI 컴포넌트 설계

### 8.1 page.tsx — Server Component

```tsx
// src/app/(ide)/screens/page.tsx
// @page Screens — 화면 대시보드

import { getScreenListAction } from '@/lib/actions/screens';
import ScreensClient from './ScreensClient';

export default async function ScreensPage() {
  const screens = await getScreenListAction();
  return <ScreensClient initialScreens={screens} />;
}
```

### 8.2 ScreensClient.tsx — 상태 관리

```tsx
'use client';

interface ScreensClientProps {
  initialScreens: ScreenListItem[];
}

// 내부 상태
// - statusFilter: ScreenStatus | 'all'  (기본 'all')
// - categoryFilter: string | 'all'       (기본 'all')
// - selectedScreen: ScreenListItem | null (Drawer 열림 제어)
// - screens: ScreenListItem[]             (동기화 후 갱신)

// 렌더 구조
// <header> 통계 카드 4종 + 필터 + 동기화 버튼
// <ScreenTable screens={filtered} onRowClick={setSelectedScreen} />
// <ScreenDrawer screen={selectedScreen} onClose={...} onUpdate={...} />
```

통계 카드 계산:
```
전체: screens.length
qa-done: screens.filter(s => s.status === 'qa-done').length
dev-done: screens.filter(s => s.status === 'dev-done').length
wip: screens.filter(s => s.status === 'wip').length
```

### 8.3 ScreenTable.tsx

```tsx
interface ScreenTableProps {
  screens: ScreenListItem[];
  onRowClick: (screen: ScreenListItem) => void;
}

// 컬럼 정의
const COLUMNS = [
  { key: 'name',             label: '화면명',  width: '18%' },
  { key: 'route',            label: '라우트',  width: '14%' },
  { key: 'authors',          label: '담당자',  width: '16%' },
  { key: 'status',           label: '상태',    width: '10%' },
  { key: 'updatedDate',      label: '최종수정', width: '10%' },
  { key: 'figmaScreenshot',  label: 'Figma',  width: '8%'  },
  { key: 'playwrightScore',  label: 'QA',     width: '8%'  },
  { key: 'actions',          label: '',       width: '8%'  },
];

// 상태 → Badge variant 매핑
const STATUS_CONFIG: Record<ScreenStatus, { label: string; variant: string }> = {
  'wip':      { label: 'WIP',      variant: 'secondary' },
  'dev-done': { label: 'Dev Done', variant: 'info'      },
  'qa-ready': { label: 'QA Ready', variant: 'warning'   },
  'qa-done':  { label: 'QA Done',  variant: 'success'   },
};

// QA 점수 표시: 0-49=danger, 50-79=warning, 80-100=success
function scoreVariant(score: number | null): string
```

### 8.4 ScreenDrawer.tsx

Drawer는 오른쪽에서 슬라이드 인. `position: fixed; right: 0; top: 0; height: 100%`

```tsx
interface ScreenDrawerProps {
  screen: ScreenListItem | null;  // null이면 닫힘
  onClose: () => void;
  onUpdate: (updated: ScreenListItem) => void;
}

// 섹션 구조
// 1. 헤더: screen.name + status 드롭다운 + 닫기 버튼
// 2. 메타 정보: route, since, updated, authors, category
// 3. FigmaCompare 컴포넌트
// 4. Playwright 섹션: 점수 + 실행 버튼 + 결과 리포트 링크
```

### 8.5 FigmaCompare.tsx

```tsx
interface FigmaCompareProps {
  screenId: string;
  figmaUrl: string | null;
  figmaScreenshot: string | null;  // '/screens/{id}-figma.png'
  implScreenshot: string | null;   // '/screens/{id}-impl.png'
  onFigmaCaptured: (path: string) => void;
}

// 레이아웃: 2컬럼 비교
// 왼쪽: Figma 원본
//   - figmaScreenshot 있으면 <img> 표시
//   - 없으면 figmaUrl 입력 + [캡처] 버튼
// 오른쪽: 실제 구현
//   - implScreenshot 있으면 <img> 표시
//   - 없으면 Playwright로 캡처 안내

// 캡처 버튼 클릭 흐름
// 1. useState: isCaptuing = true
// 2. captureFigmaScreenshotAction(screenId, figmaUrl) 호출
// 3. 성공 시 onFigmaCaptured(path) → 부모 상태 갱신
```

---

## 9. ActivityBar + Sidebar 변경

### 9.1 ActivityBar.tsx — Section 타입 확장

```ts
// 변경 전
export type Section = 'home' | 'tokens' | 'components' | 'pages' | 'diff' | 'settings' | 'admin';

// 변경 후
export type Section = 'home' | 'tokens' | 'components' | 'pages' | 'screens' | 'diff' | 'settings' | 'admin';
```

`MID_ITEMS` 배열에 추가 (pages 다음):
```ts
{ section: 'screens', icon: 'solar:layers-minimalistic-linear', label: 'Screens' },
```

### 9.2 Sidebar.tsx — screens 섹션

Sidebar 렌더 조건 확장:
```ts
// 변경 전
if (activeSection !== 'tokens' && activeSection !== 'components' && activeSection !== 'pages') {
  return null;
}

// 변경 후
if (!['tokens', 'components', 'pages', 'screens'].includes(activeSection)) {
  return null;
}
```

screens 패널 추가 (pages 패널 다음):
```tsx
{activeSection === 'screens' && (
  <>
    <div className={styles.panelHeader}>
      <span className={styles.panelTitle}>화면 대시보드</span>
    </div>
    <nav className={styles.nav}>
      <Link
        href="/screens"
        className={`${styles.navItem} ${pathname === '/screens' ? styles.active : ''}`}
      >
        <Icon icon="solar:layers-minimalistic-linear" width={15} height={15} className={styles.icon} />
        <span className={styles.navLabel}>전체 화면 목록</span>
      </Link>
    </nav>
  </>
)}
```

---

## 10. 레이아웃 AppShell 연동

`src/app/(ide)/layout.tsx` 또는 `AppShell.tsx`에서 `screens` section → `/screens` 라우트 처리 확인:

기존 섹션-라우트 매핑 패턴을 따라:
```ts
const SECTION_ROUTES: Partial<Record<Section, string>> = {
  home:       '/',
  tokens:     '/tokens/color',
  components: '/components/button',
  pages:      '/pages',
  screens:    '/screens',      // 신규
  diff:       '/diff',
  settings:   '/settings',
};
```

---

## 11. playwright.config.ts 수정

```ts
// 기존 설정에서 testMatch 또는 testDir 확장
export default defineConfig({
  testDir: './tests',
  // tests/screens/*.spec.ts 가 자동 포함됨 (기본 glob)
  ...
});
```

생성 spec 파일 저장 경로가 `tests/screens/`이므로 기존 `playwright.config.ts`에 별도 설정 불필요. 단, `test-results/screens/` 디렉토리는 `.gitignore`에 추가:
```
test-results/screens/
public/screens/
```

---

## 12. 구현 순서 (의존성 그래프)

```
Step 1: DB 스키마 — screens 테이블 + migration
        ↓
Step 2: comment-parser.ts — ScreenMeta 타입 + parsePageComment()
        ↓
Step 3: file-scanner.ts — extractRoute() + scanPageFiles()
        ↓
Step 4: screens.ts Server Actions — syncScreensAction() + getScreenListAction()
        ↓
Step 5: 대시보드 UI — page.tsx + ScreensClient.tsx + ScreenTable.tsx
        ↓ (병렬 가능)
Step 6a: ScreenDrawer.tsx + FigmaCompare.tsx
Step 6b: playwright-generator.ts + writeSpecFile()
        ↓
Step 7: captureFigmaScreenshotAction() + updatePlaywrightResultAction()
        ↓
Step 8: ActivityBar + Sidebar screens 섹션 추가
```

---

## 13. 엣지 케이스 처리

| 케이스 | 처리 방법 |
|--------|----------|
| `@page` 없는 page.tsx | `parsePageComment()` → `null` → 스캔 결과 제외 |
| `@page Name` (설명 없음) | `description: null`, `name: 'Name'` |
| `@author` 없음 | `authors: []` |
| `@status` 미정의 값 | `'wip'` 폴백 |
| Figma URL 캡처 실패 | `captureFigmaScreenshotAction()` → `throw Error` → Client에서 toast 표시 |
| spec 파일 이미 존재 | `@custom` 블록 이후 내용 보존, 나머지만 재생성 |
| route 충돌 (동일 route 2파일) | `unique()` 제약으로 두 번째 upsert가 첫 번째를 덮어씀 |
| `public/screens/` 디렉토리 없음 | `fs.mkdir({ recursive: true })` 선처리 |

---

## 14. SCSS 모듈 클래스 목록

### page.module.scss (screens)
```scss
.screensPage       // 전체 래퍼
.pageHeader        // 헤더 행 (제목 + 필터 + 버튼)
.pageTitle
.statsRow          // 통계 카드 4종
.statCard
.statCount
.statLabel
.filterRow         // 필터 드롭다운 + 동기화 버튼
.syncBtn
```

### ScreenTable — table 공통 SCSS 재사용
```
기존 _table.scss 클래스 활용: .table, .table-hover
신규: .statusBadge, .qaScore, .figmaThumb (16px 미니 썸네일)
```

### ScreenDrawer
```scss
.drawer            // position: fixed; right: 0; top: 0; width: 480px; height: 100vh
.drawerOverlay     // 반투명 배경 (클릭 시 닫기)
.drawerHeader
.drawerBody
.compareGrid       // 2컬럼 Figma vs 구현
.comparePanel
.compareLabel
.compareImg
.comparePlaceholder
.playwrightSection
.scoreBar          // 점수 시각화 바
```
