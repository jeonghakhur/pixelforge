# Design: manual-token-sync — 메인 페이지 토큰 수동 추출

> Plan: `docs/01-plan/features/manual-token-sync.plan.md`

---

## 1. 아키텍처 레이어

```
┌─────────────────────────────────────────────────────────┐
│  Presentation (React Client Component)                  │
│  src/app/(ide)/TokenDashboard.tsx                       │
│    - handleExtract() — extractAllTokensAction 호출       │
│    - extractState: 'idle' | 'loading' | 'success' | 'error' │
│    - errorMsg: string | null                            │
│    - Top Bar "Extract Tokens" 버튼 + 에러 배너 렌더링     │
└─────────────────┬───────────────────────────────────────┘
                  │ Server Action ('use server')
┌─────────────────▼───────────────────────────────────────┐
│  Application (Server Actions)                           │
│  src/lib/actions/tokens.ts                              │
│    getActiveProjectHasFigmaUrl()  ← 신규 (page.tsx용)   │
│    extractAllTokensAction()       ← 신규 (대시보드용)    │
└─────────────────┬───────────────────────────────────────┘
                  │ 재사용
┌─────────────────▼───────────────────────────────────────┐
│  Domain (기존 함수 — 변경 없음)                           │
│  src/lib/actions/project.ts                             │
│    extractTokensAction(figmaUrl)  ← 그대로 재사용         │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│  Infrastructure                                         │
│  projects 테이블 — figma_url 조회                         │
│  histories 테이블 — extract_tokens 기록 (기존 자동)       │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 파일 목록

### 신규 없음 — 기존 파일 수정만

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `src/lib/actions/tokens.ts` | 수정 | `getActiveProjectHasFigmaUrl`, `extractAllTokensAction` 추가 |
| `src/app/(ide)/page.tsx` | 수정 | `hasFigmaUrl` 데이터 페칭 및 Props 전달 |
| `src/app/(ide)/TokenDashboard.tsx` | 수정 | Props 확장, `handleExtract` 구현, 버튼/에러 UI |

> SCSS는 기존 `.syncBtn`, `.spinning` 클래스를 그대로 재사용 — 신규 스타일 클래스 불필요

---

## 3. Server Action 설계

### 3-1. `getActiveProjectHasFigmaUrl`

**파일**: `src/lib/actions/tokens.ts`

```typescript
export async function getActiveProjectHasFigmaUrl(): Promise<boolean> {
  const projectId = getActiveProjectId();
  if (!projectId) return false;
  const row = db
    .select({ figmaUrl: projects.figmaUrl })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();
  return Boolean(row?.figmaUrl);
}
```

- `page.tsx`에서 서버 사이드 렌더링 시 호출 → `hasFigmaUrl` prop으로 전달
- 클라이언트에서 버튼 비활성화 조건으로 사용

### 3-2. `extractAllTokensAction`

**파일**: `src/lib/actions/tokens.ts`

```typescript
export interface ExtractAllResult {
  error: string | null;
  colors: number;
  typography: number;
  spacing: number;
  radii: number;
}

export async function extractAllTokensAction(): Promise<ExtractAllResult> {
  const projectId = getActiveProjectId();
  if (!projectId) {
    return { error: '활성 프로젝트가 없습니다.', colors: 0, typography: 0, spacing: 0, radii: 0 };
  }

  const row = db
    .select({ figmaUrl: projects.figmaUrl })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (!row?.figmaUrl) {
    return {
      error: 'Figma URL이 설정되지 않았습니다. 설정 페이지에서 입력해주세요.',
      colors: 0, typography: 0, spacing: 0, radii: 0,
    };
  }

  const result = await extractTokensAction(row.figmaUrl);
  return {
    error: result.error,
    colors: result.colors,
    typography: result.typography,
    spacing: result.spacing,
    radii: result.radii,
  };
}
```

- `extractTokensAction`은 내부에서 `histories` 테이블에 자동 기록 → 별도 처리 불필요
- Figma API 토큰 미설정 에러는 `extractTokensAction` 내부에서 반환

---

## 4. `page.tsx` 수정

```typescript
// 변경 전
const [summary, tokenMenu, histories, syncProjects] = await Promise.all([...]);

// 변경 후
const [summary, tokenMenu, histories, syncProjects, hasFigmaUrl] = await Promise.all([
  getTokenSummary(),
  getTokenMenuAction(),
  getRecentHistoriesAction(10),
  getSyncStatus(),
  getActiveProjectHasFigmaUrl(),   // 신규 추가
]);

// JSX
<TokenDashboard
  summary={summary}
  tokenMenu={tokenMenu}
  histories={histories}
  tokenVersion={tokenSync?.version ?? null}
  lastSyncedAt={tokenSync?.syncedAt?.toISOString() ?? summary.lastExtracted}
  hasFigmaUrl={hasFigmaUrl}         // 신규 추가
/>
```

---

## 5. `TokenDashboard.tsx` 수정

### 5-1. Props 인터페이스 확장

```typescript
interface Props {
  summary: TokenSummary;
  tokenMenu: TokenMenuEntry[];
  histories: HistoryEntry[];
  tokenVersion: number | null;
  lastSyncedAt: string | null;
  hasFigmaUrl: boolean;              // 신규
}
```

### 5-2. 상태 추가

```typescript
type ExtractState = 'idle' | 'loading' | 'success' | 'error';

const [extractState, setExtractState] = useState<ExtractState>('idle');
const [errorMsg, setErrorMsg] = useState<string | null>(null);
```

> `useTransition`은 이미 `[syncing, startSync]`로 선언되어 있음 — 그대로 활용

### 5-3. `handleExtract` 구현

```typescript
const handleExtract = () => {
  setErrorMsg(null);
  setExtractState('loading');
  startSync(async () => {
    const result = await extractAllTokensAction();
    if (result.error) {
      setExtractState('error');
      setErrorMsg(result.error);
    } else {
      setExtractState('success');
      router.refresh();
      setTimeout(() => setExtractState('idle'), 2000);
    }
  });
};
```

- `startSync` (useTransition) 내부에서 비동기 Server Action 호출
- 성공 시 2초 후 `idle`로 복귀

### 5-4. 기존 `handleSync` 제거 및 Top Bar 버튼 교체

**제거**: 기존 `handleSync` 함수 전체 (`router.refresh()`만 하던 것)

**변경 전 Top Bar Right**:
```tsx
<div className={styles.topBarRight} />
```

**변경 후**:
```tsx
<div className={styles.topBarRight}>
  <button
    type="button"
    className={styles.syncBtn}
    onClick={handleExtract}
    disabled={!hasFigmaUrl || extractState === 'loading'}
    title={!hasFigmaUrl ? 'Figma URL을 먼저 설정해주세요 (설정 > Figma URL)' : undefined}
  >
    <Icon
      icon={extractState === 'loading'
        ? 'solar:refresh-linear'
        : extractState === 'success'
        ? 'solar:check-circle-linear'
        : 'solar:download-minimalistic-linear'}
      width={14}
      height={14}
      className={extractState === 'loading' ? styles.spinning : undefined}
    />
    {extractState === 'loading' ? 'Extracting...'
      : extractState === 'success' ? 'Done'
      : 'Extract Tokens'}
  </button>
</div>
```

### 5-5. 에러 배너

Top Bar 바로 아래, 타이틀 영역 위에 조건부 렌더링:

```tsx
{extractState === 'error' && errorMsg && (
  <div className={styles.errorBanner}>
    <Icon icon="solar:danger-triangle-linear" width={14} height={14} />
    <span>{errorMsg}</span>
    <button
      type="button"
      className={styles.errorClose}
      onClick={() => { setExtractState('idle'); setErrorMsg(null); }}
      aria-label="닫기"
    >
      <Icon icon="solar:close-linear" width={12} height={12} />
    </button>
  </div>
)}
```

### 5-6. 에러 배너 SCSS — `TokenDashboard.module.scss`에 추가

```scss
.errorBanner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.25);
  border-radius: 6px;
  font-size: 13px;
  color: #f87171;
  margin-bottom: 8px;
}

.errorClose {
  margin-left: auto;
  background: none;
  border: none;
  color: #f87171;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  opacity: 0.7;
  &:hover { opacity: 1; }
}
```

---

## 6. 버튼 상태 명세

| 상태 | 텍스트 | 아이콘 | disabled | 조건 |
|------|--------|--------|----------|------|
| `idle` (URL 없음) | Extract Tokens | solar:download-minimalistic-linear | `true` | `!hasFigmaUrl` |
| `idle` (URL 있음) | Extract Tokens | solar:download-minimalistic-linear | `false` | 기본 |
| `loading` | Extracting... | solar:refresh-linear (spinning) | `true` | 추출 중 |
| `success` | Done | solar:check-circle-linear | `false` | 완료 2초간 |
| `error` | Extract Tokens | solar:download-minimalistic-linear | `false` | 에러 후 idle 복귀 |

---

## 7. 데이터 흐름 (전체)

```
[사용자: "Extract Tokens" 클릭]
  ↓
handleExtract()
  → setExtractState('loading')
  → startSync(async () => { ... })
       ↓
       extractAllTokensAction()   [Server Action]
         → getActiveProjectId()
         → DB: projects.figmaUrl 조회
         → extractTokensAction(figmaUrl)  [기존]
              → Figma Variables API 호출
              → tokens 테이블 upsert
              → histories 테이블 기록 (extract_tokens)
              → CSS 재생성
              → { error, colors, typography, spacing, radii } 반환
       ↓
       error 있음 → setExtractState('error'), setErrorMsg(...)
       error 없음 → setExtractState('success'), router.refresh()
                    2초 후 → setExtractState('idle')
                                ↓
                    [페이지 갱신]
                      - 통계 카드: 토큰 수 최신화
                      - Audit Log: 새 extract_tokens 항목 표시
                      - Top Bar: Last sync 시각 갱신
```

---

## 8. 구현 순서

| # | 파일 | 작업 |
|---|------|------|
| 1 | `src/lib/actions/tokens.ts` | `getActiveProjectHasFigmaUrl` + `extractAllTokensAction` + `ExtractAllResult` 타입 추가 |
| 2 | `src/app/(ide)/page.tsx` | `getActiveProjectHasFigmaUrl()` 페칭, `hasFigmaUrl` prop 전달 |
| 3 | `src/app/(ide)/TokenDashboard.tsx` | Props 확장, `handleSync` 제거 → `handleExtract` 추가, 버튼 UI 교체, 에러 배너 추가 |
| 4 | `src/app/(ide)/TokenDashboard.module.scss` | `.errorBanner`, `.errorClose` 추가 |

---

## 9. 성공 기준

- [ ] Top Bar 우측에 "Extract Tokens" 버튼이 렌더링된다
- [ ] `hasFigmaUrl = false`일 때 버튼이 `disabled` 상태이고 `title` 툴팁이 표시된다
- [ ] 클릭 시 버튼이 "Extracting..." + 스피너로 전환되고 disabled된다
- [ ] 추출 성공 시 "Done" 텍스트로 2초간 표시 후 idle로 복귀한다
- [ ] 추출 성공 후 `router.refresh()`로 Audit Log와 통계 카드가 갱신된다
- [ ] 추출 실패 시 에러 배너가 Top Bar 하단에 표시된다
- [ ] 에러 배너 닫기 버튼이 동작한다
- [ ] `npm run build` 통과, `npm run lint` 통과
- [ ] TypeScript `any` 없음, CSS 변수(`var(--*)`) 사용
