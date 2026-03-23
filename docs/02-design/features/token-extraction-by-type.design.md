# Design: token-extraction-by-type

> Plan 참조: `docs/01-plan/features/token-extraction-by-type.plan.md`

---

## 1. 아키텍처 개요

### 1.1 현재 vs 변경 후

```
[ 현재 ]
extractTokensAction(figmaUrl, options)
  └─ projects.figma_url (단일 URL)
  └─ Variables API → 전체 타입 저장
  └─ node-scan fallback → 전체 타입 저장

[ 변경 후 ]
extractTokensByTypeAction(type, figmaUrl)
  └─ token_sources (타입별 URL 저장)
  └─ 기존 extractTokensAction 내부 로직 재사용
       └─ type 필터링 후 해당 타입 토큰만 DB 저장
  └─ captureTokenPageScreenshotAction(type)
       └─ Playwright headless → /tokens/{type} 스크린샷
       └─ public/token-screenshots/{type}.png 저장
       └─ token_sources.ui_screenshot 업데이트
```

### 1.2 영향 범위

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/lib/db/schema.ts` | 수정 | `tokenSources` 테이블 추가 |
| `src/lib/db/index.ts` | 수정 | `initTables()` + `migrateColumns()` 업데이트 |
| `src/lib/actions/tokens.ts` | 수정 | `extractTokensByTypeAction`, `captureTokenPageScreenshotAction`, `getTokenSourceAction` 추가 |
| `src/lib/actions/project.ts` | 수정 | `buildTokenInserts()` 내부 헬퍼 분리 (재사용) |
| `src/app/(ide)/tokens/[type]/TokenPageActions.tsx` | 수정 | "추가하기" 버튼 추가, count === 0 예외 제거 |
| `src/app/(ide)/tokens/[type]/TokenExtractModal.tsx` | 신규 | URL 입력 + 추출 진행 모달 |
| `src/app/(ide)/tokens/[type]/page.tsx` | 수정 | token_sources 조회 → 마지막 추출 배너 + 스크린샷 섹션 |
| `src/app/(ide)/tokens/[type]/page.module.scss` | 수정 | 스크린샷 섹션 스타일 추가 |

---

## 2. DB 스키마

### 2.1 `tokenSources` 테이블 (`schema.ts`)

```typescript
export const tokenSources = sqliteTable('token_sources', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  type: text('type').notNull(),                   // 'color' | 'typography' | ...
  figmaUrl: text('figma_url').notNull(),
  figmaKey: text('figma_key').notNull(),
  figmaVersion: text('figma_version'),
  lastExtractedAt: integer('last_extracted_at', { mode: 'timestamp' }),
  tokenCount: integer('token_count').notNull().default(0),
  uiScreenshot: text('ui_screenshot'),            // '/token-screenshots/{type}.png'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

### 2.2 `initTables()` DDL 추가

```sql
CREATE TABLE IF NOT EXISTS token_sources (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  type TEXT NOT NULL,
  figma_url TEXT NOT NULL,
  figma_key TEXT NOT NULL,
  figma_version TEXT,
  last_extracted_at INTEGER,
  token_count INTEGER NOT NULL DEFAULT 0,
  ui_screenshot TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(project_id, type)
);
```

### 2.3 `migrateColumns()` — 기존 DB 대응 없음

신규 테이블이므로 `initTables()`의 `CREATE TABLE IF NOT EXISTS`만으로 충분. 별도 ALTER 불필요.

---

## 3. Server Actions

### 3.1 `extractTokensByTypeAction` (`src/lib/actions/tokens.ts`)

```typescript
export interface ExtractByTypeResult {
  error: string | null;
  count: number;
  type: string;
  screenshotPath: string | null;
}

export async function extractTokensByTypeAction(
  type: string,
  figmaUrl: string,
): Promise<ExtractByTypeResult>
```

**처리 흐름:**

```
1. getFigmaToken() → 없으면 에러
2. extractFileKey(figmaUrl) → 없으면 에러
3. extractNodeId(figmaUrl) → nodeId (null 가능)
4. token_sources UPSERT (project_id, type, figma_url, figma_key)
5. 기존 추출 로직 실행 (project.ts의 내부 로직 재사용):
   a. Variables API 시도 → 해당 type만 필터링
   b. 실패 시 node-scan fallback → 해당 type만 필터링
6. DB: 기존 해당 type 토큰 DELETE → 신규 INSERT
7. token_sources 업데이트: token_count, last_extracted_at, figma_version
8. captureTokenPageScreenshotAction(type) 호출 (non-blocking try/catch)
9. 반환: { error, count, type, screenshotPath }
```

**재사용 전략 — `project.ts` 헬퍼 분리:**

현재 `extractTokensAction`의 DB 저장 로직이 인라인으로 작성됨. 이를 다음 형태로 추출:

```typescript
// project.ts에 추가 (export는 하지 않음, 내부 헬퍼)
export async function runExtraction(
  client: FigmaClient,
  fileKey: string,
  nodeId: string | null,
  typeFilter?: string,   // 특정 타입만 반환
): Promise<{ colors: ColorToken[]; typography: TypographyToken[]; spacing: SpacingToken[]; radii: RadiusToken[]; source: string }>
```

단, `tokens.ts`에서 `project.ts`의 내부 로직을 직접 import하면 순환 의존성 위험. 따라서:
- 추출 핵심 로직을 `src/lib/tokens/runner.ts` 신규 파일로 분리
- `project.ts`와 `tokens.ts` 양쪽에서 import

### 3.2 `captureTokenPageScreenshotAction` (`src/lib/actions/tokens.ts`)

```typescript
export async function captureTokenPageScreenshotAction(
  type: string,
): Promise<{ error: string | null; screenshotPath: string | null }>
```

**처리 흐름:**

```
1. BASE_URL 결정: process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
2. chromium.launch({ headless: true })
3. page.goto(`${BASE_URL}/tokens/${type}`, { waitUntil: 'networkidle' })
4. page.waitForSelector('[data-token-grid]', { timeout: 10000 })
5. outputDir: path.join(process.cwd(), 'public', 'token-screenshots')
   fs.mkdirSync(outputDir, { recursive: true })
6. screenshotPath = path.join(outputDir, `${type}.png`)
7. page.screenshot({ path: screenshotPath, fullPage: false })
8. DB: token_sources SET ui_screenshot = '/token-screenshots/{type}.png'
9. 반환: { error: null, screenshotPath: '/token-screenshots/{type}.png' }
```

**Playwright import:**
```typescript
import { chromium } from 'playwright';
```
이미 `playwright.config.ts`가 존재하므로 `playwright` 패키지 설치됨. 별도 설치 불필요.

**data-token-grid 속성**: `ColorGrid`, `TypographyList` 등 각 뷰 컴포넌트 최상위 div에 `data-token-grid` 속성 추가.

### 3.3 `getTokenSourceAction` (`src/lib/actions/tokens.ts`)

```typescript
export interface TokenSource {
  type: string;
  figmaUrl: string;
  figmaKey: string;
  lastExtractedAt: Date | null;
  tokenCount: number;
  uiScreenshot: string | null;
}

export async function getTokenSourceAction(type: string): Promise<TokenSource | null>
```

---

## 4. UI 컴포넌트

### 4.1 `TokenExtractModal.tsx` (신규)

```
위치: src/app/(ide)/tokens/[type]/TokenExtractModal.tsx
```

**Props:**

```typescript
interface TokenExtractModalProps {
  type: string;
  typeLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}
```

**상태 머신:**

```
idle → submitting → capturing → done
                 ↘ error
```

**렌더 구조:**

```tsx
<Modal isOpen={isOpen} onClose={onClose} title={`${typeLabel} 토큰 추가하기`}>
  <Modal.Body>
    {/* idle / error 상태 */}
    <form onSubmit={handleSubmit}>
      <label htmlFor="figma-url">Figma URL</label>
      <input id="figma-url" type="url" {...register('figmaUrl', { required: true })} />
      <p className={styles.hint}>
        특정 프레임 URL 권장 (?node-id=... 포함)
      </p>
      {errors.figmaUrl && <p className={styles.error}>{errors.figmaUrl.message}</p>}
    </form>

    {/* submitting 상태 */}
    <div className={styles.progress}>
      <Spinner size="sm" />
      <span>토큰 추출 중...</span>
    </div>

    {/* capturing 상태 */}
    <div className={styles.progress}>
      <Spinner size="sm" />
      <span>UI 스크린샷 캡처 중...</span>
    </div>

    {/* done 상태 */}
    <div className={styles.done}>
      <Icon icon="solar:check-circle-linear" />
      <span>{count}개 토큰이 추출되었습니다.</span>
    </div>
  </Modal.Body>
  <Modal.Footer>
    <button onClick={onClose}>닫기</button>
    <button type="submit" form="extract-form" disabled={!idle}>추출 시작하기</button>
  </Modal.Footer>
</Modal>
```

**폼 검증 (zod):**

```typescript
const schema = z.object({
  figmaUrl: z.string()
    .url('올바른 URL을 입력해주세요.')
    .refine((v) => v.includes('figma.com'), 'Figma URL을 입력해주세요.'),
});
```

### 4.2 `TokenPageActions.tsx` 수정

**변경 전:**
```typescript
if (count === 0) return null;
```

**변경 후:**
```typescript
// count === 0이어도 "추가하기" 버튼은 항상 표시
return (
  <>
    <button onClick={() => setExtractModalOpen(true)}>
      <Icon icon="solar:add-circle-linear" />
      {typeConfig.label} 토큰 추가하기
    </button>
    {count > 0 && (
      <>
        {/* 기존 CSS 복사, .css 저장, 전체 삭제 버튼 */}
      </>
    )}
    <TokenExtractModal
      type={type}
      typeLabel={typeConfig?.label ?? type}
      isOpen={extractModalOpen}
      onClose={() => setExtractModalOpen(false)}
      onSuccess={handleExtractSuccess}
    />
  </>
);
```

**`handleExtractSuccess`:**
```typescript
const handleExtractSuccess = (count: number) => {
  setExtractModalOpen(false);
  invalidateTokens();
  router.refresh();
};
```

### 4.3 `page.tsx` 수정 (Server Component)

**추가 데이터 페칭:**
```typescript
const [tokenRows, tokenSource] = await Promise.all([
  getTokensByType(type),
  getTokenSourceAction(type),
]);
```

**추가 렌더 — 마지막 추출 배너:**

```tsx
{tokenSource && (
  <div className={styles.sourceMeta}>
    <Icon icon="solar:clock-circle-linear" width={12} />
    마지막 추출: {formatDate(tokenSource.lastExtractedAt)} · {tokenSource.tokenCount}개
    <span className={styles.sourceUrl}>{tokenSource.figmaUrl}</span>
  </div>
)}
```

**추가 렌더 — 스크린샷 섹션 (토큰 있을 때만):**

```tsx
{tokenSource?.uiScreenshot && (
  <section className={styles.screenshotSection}>
    <h2 className={styles.screenshotTitle}>UI 검증 스크린샷</h2>
    <p className={styles.screenshotMeta}>
      마지막 캡처: {formatDate(tokenSource.lastExtractedAt)}
    </p>
    <div className={styles.screenshotFrame}>
      <img
        src={tokenSource.uiScreenshot}
        alt={`${typeConfig.label} 토큰 UI 스크린샷`}
        className={styles.screenshotImg}
        loading="lazy"
        decoding="async"
      />
    </div>
  </section>
)}
```

### 4.4 뷰 컴포넌트 `data-token-grid` 속성

Playwright 대기 셀렉터 `[data-token-grid]`를 위해:

| 파일 | 추가 위치 |
|------|----------|
| `ColorGrid.tsx` | 최상위 `<div>` |
| `TypographyList.tsx` | 최상위 `<div>` |
| `SpacingList.tsx` | 최상위 `<div>` |
| `RadiusList.tsx` | 최상위 `<div>` |
| `GenericTokenList.tsx` | 최상위 `<div>` |

---

## 5. 추출 로직 리팩토링 — `runner.ts`

```
위치: src/lib/tokens/runner.ts
```

**목적:** `project.ts`의 추출 로직을 `tokens.ts`에서도 재사용 가능하도록 분리.

**인터페이스:**

```typescript
export interface RunExtractionResult {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
  radii: RadiusToken[];
  source: 'variables' | 'styles-api' | 'section-scan' | 'node-scan';
  figmaVersion: string | null;
}

export async function runExtraction(
  figmaToken: string,
  fileKey: string,
  nodeId: string | null,
): Promise<RunExtractionResult>
```

**이 파일이 담당하는 것:**
- Variables API 시도 → `extractFromVariables()`
- 실패 시 node-scan: `loadFileCached()` → `extractFromNode()`
- `source` 결정

**이 파일이 담당하지 않는 것:**
- DB 저장 (caller가 담당)
- `token_sources` 업데이트 (caller가 담당)

---

## 6. 구현 순서

### Step 1: DB 스키마 (30분)
1. `schema.ts` — `tokenSources` 테이블 추가
2. `db/index.ts` — `initTables()` DDL 추가

### Step 2: 추출 로직 분리 (45분)
3. `src/lib/tokens/runner.ts` 신규 작성
4. `project.ts` `extractTokensAction` → `runner.ts` 사용으로 리팩토링 (기능 동일 유지)

### Step 3: Actions (45분)
5. `tokens.ts` — `getTokenSourceAction` 추가
6. `tokens.ts` — `extractTokensByTypeAction` 추가
7. `tokens.ts` — `captureTokenPageScreenshotAction` 추가

### Step 4: UI (60분)
8. `ColorGrid.tsx` 등 5개 뷰 컴포넌트 — `data-token-grid` 추가
9. `TokenExtractModal.tsx` 신규 작성
10. `TokenPageActions.tsx` — "추가하기" 버튼 + 모달 연결
11. `page.tsx` — `getTokenSourceAction` 호출 + 배너·스크린샷 렌더
12. `page.module.scss` — 스크린샷 섹션 스타일

---

## 7. 의존성

추가 패키지 없음. `playwright`는 이미 설치됨 (`playwright.config.ts` 존재 확인).

---

## 8. 엣지 케이스 처리

| 케이스 | 처리 |
|--------|------|
| 스크린샷 캡처 실패 (서버 미실행 등) | `try/catch` 후 `screenshotPath: null` 반환. 추출 결과는 정상 반환 |
| 추출 후 페이지 로딩 지연 | `waitForSelector('[data-token-grid]', { timeout: 10000 })` |
| 토큰 0개인 상태 스크린샷 | `EmptyState` UI가 캡처됨 — 정상 (추출 결과가 없음을 시각적으로 확인 가능) |
| 동일 타입 재추출 | DELETE → INSERT 패턴으로 기존 토큰 교체 |
| 프로젝트 미등록 상태 | `extractTokensByTypeAction` 시작 전 프로젝트 존재 여부 확인, 없으면 에러 |
