# Design: 토큰 변경 히스토리 (git auto-commit)

> Plan: `docs/01-plan/features/token-history.plan.md`

---

## 1. 아키텍처 레이어

```
┌─────────────────────────────────────────────────────────┐
│  Presentation (React)                                   │
│  src/app/(ide)/diff/page.tsx  ← "커밋 이력" 섹션 추가    │
│  src/app/(ide)/diff/TokenCommitHistory.tsx  ← 신규       │
└─────────────────┬───────────────────────────────────────┘
                  │ Server Actions (use server)
┌─────────────────▼───────────────────────────────────────┐
│  Application (Server Actions)                           │
│  src/lib/actions/token-history.ts  ← 신규               │
│    getTokenCssHistoryAction()                           │
│    getTokenCssDiffAction(hashA, hashB)                  │
│    getTokenCssAtCommitAction(hash)                      │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│  Infrastructure (git + fs)                              │
│  src/lib/git/token-commits.ts  ← 신규                   │
│    commitTokensCss(css, message)                        │
│  src/lib/tokens/css-generator.ts  ← 기존 재사용         │
│    generateAllCssCode(allTokens)                        │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 파일 목록

### 신규 파일

| 파일 | 역할 | 규모 |
|------|------|------|
| `src/lib/git/token-commits.ts` | git 파일 쓰기 + commit 유틸 | ~60줄 |
| `src/lib/actions/token-history.ts` | git log/diff/show server actions | ~80줄 |
| `src/app/(ide)/diff/TokenCommitHistory.tsx` | 커밋 이력 UI 컴포넌트 | ~200줄 |
| `src/app/(ide)/diff/token-commit-history.module.scss` | 스타일 | ~150줄 |

### 수정 파일

| 파일 | 변경 내용 | 규모 |
|------|-----------|------|
| `src/lib/actions/project.ts:589-594` | `createSnapshotAction` → `commitTokensCss` | ~10줄 교체 |
| `src/app/(ide)/diff/page.tsx` | `TokenCommitHistory` 섹션 추가 | ~5줄 추가 |

---

## 3. `src/lib/git/token-commits.ts` 상세 설계

```typescript
import { execSync, ExecSyncOptionsWithBufferEncoding } from 'child_process';
import fs from 'fs';
import path from 'path';

const CWD = process.cwd();
const TOKENS_CSS_PATH = path.join(CWD, 'design-tokens', 'tokens.css');

const GIT_AUTHOR_FLAGS =
  '-c user.name="PixelForge" -c user.email="bot@pixelforge.local"';

function exec(cmd: string): string {
  const opts: ExecSyncOptionsWithBufferEncoding = { cwd: CWD, stdio: ['pipe', 'pipe', 'pipe'] };
  return execSync(cmd, opts).toString().trim();
}

export interface CommitTokensResult {
  committed: boolean;
  hash: string | null;
  error: string | null;
}

/**
 * tokens.css 파일을 저장하고 변경이 있을 때만 git commit.
 * git 저장소가 없거나 실패해도 에러를 throw하지 않음 (추출 자체를 막으면 안 됨).
 */
export function commitTokensCss(
  cssContent: string,
  commitMessage: string,
): CommitTokensResult {
  try {
    // 1. 디렉토리 + 파일 쓰기
    fs.mkdirSync(path.dirname(TOKENS_CSS_PATH), { recursive: true });
    fs.writeFileSync(TOKENS_CSS_PATH, cssContent, 'utf-8');

    // 2. git 저장소 확인
    try {
      exec('git rev-parse --git-dir');
    } catch {
      return { committed: false, hash: null, error: 'git 저장소가 없습니다.' };
    }

    // 3. 변경 여부 확인 (동일 내용이면 커밋 스킵)
    const statusOutput = exec('git status --porcelain design-tokens/tokens.css');
    if (!statusOutput) {
      return { committed: false, hash: null, error: null }; // 변경 없음 — 정상
    }

    // 4. git add + commit (--no-verify: pre-commit 훅 우회)
    exec('git add design-tokens/tokens.css');
    const safeMsg = commitMessage.replace(/"/g, '\\"');
    exec(`git ${GIT_AUTHOR_FLAGS} commit -m "${safeMsg}" --no-verify`);

    // 5. 커밋 해시 반환
    const hash = exec('git rev-parse --short HEAD');
    return { committed: true, hash, error: null };
  } catch (err) {
    return {
      committed: false,
      hash: null,
      error: err instanceof Error ? err.message : 'git commit 실패',
    };
  }
}

/** 커밋 메시지 생성 헬퍼 */
export function buildCommitMessage(counts: {
  colors: number;
  typography: number;
  spacing: number;
  radii: number;
}): string {
  const parts = [
    counts.colors    > 0 && `색상 ${counts.colors}`,
    counts.typography > 0 && `타이포 ${counts.typography}`,
    counts.spacing   > 0 && `간격 ${counts.spacing}`,
    counts.radii     > 0 && `반경 ${counts.radii}`,
  ].filter(Boolean) as string[];

  return `tokens: ${parts.join(' · ')}`;
}
```

---

## 4. `src/lib/actions/token-history.ts` 상세 설계

```typescript
'use server';

import { execSync } from 'child_process';
import path from 'path';

const CWD = process.cwd();
const TOKEN_FILE = 'design-tokens/tokens.css';

function exec(cmd: string): string {
  return execSync(cmd, { cwd: CWD, stdio: ['pipe', 'pipe', 'pipe'] })
    .toString()
    .trim();
}

// ===========================
// 타입 정의
// ===========================

export interface TokenCommit {
  hash: string;    // 7자리 short hash
  fullHash: string;
  date: string;    // ISO 8601
  message: string; // "tokens: 색상 106 · 타이포 42"
  author: string;
}

// ===========================
// git log: 커밋 이력 목록
// ===========================

export async function getTokenCssHistoryAction(): Promise<{
  error: string | null;
  commits: TokenCommit[];
}> {
  try {
    // 파일 존재 여부 체크
    const exists = exec(`git ls-files --error-unmatch ${TOKEN_FILE} 2>/dev/null || echo "missing"`);
    if (exists === 'missing') {
      return { error: null, commits: [] }; // 아직 커밋 없음 — 빈 목록
    }

    const log = exec(
      `git log --follow --format="%h|%H|%ai|%s|%an" -- ${TOKEN_FILE}`
    );
    if (!log) return { error: null, commits: [] };

    const commits: TokenCommit[] = log.split('\n').map((line) => {
      const [hash, fullHash, date, message, author] = line.split('|');
      return { hash, fullHash, date, message, author };
    });

    return { error: null, commits };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'git log 실패',
      commits: [],
    };
  }
}

// ===========================
// git diff: 두 커밋 간 diff
// ===========================

export async function getTokenCssDiffAction(
  hashA: string,   // 이전 (older)
  hashB: string,   // 이후 (newer)
): Promise<{ error: string | null; diff: string }> {
  try {
    // git diff는 변경 없으면 빈 문자열 반환 (exit code 0)
    const diff = exec(`git diff ${hashA} ${hashB} -- ${TOKEN_FILE}`);
    return { error: null, diff };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'diff 실패', diff: '' };
  }
}

// ===========================
// git show: 특정 커밋의 파일 내용
// ===========================

export async function getTokenCssAtCommitAction(hash: string): Promise<{
  error: string | null;
  content: string;
}> {
  try {
    const content = exec(`git show ${hash}:${TOKEN_FILE}`);
    return { error: null, content };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'git show 실패',
      content: '',
    };
  }
}
```

---

## 5. `project.ts` 수정 — 트리거 교체

**변경 전 (`line 589-594`):**
```typescript
// 스냅샷 자동 생성 (전체 타입 추출 시에만)
if (isAllTypes) {
  const figmaVer = db.select({ figmaVersion: projects.figmaVersion })
    .from(projects).where(eq(projects.id, projectId)).get();
  await createSnapshotAction(projectId, extractionSource, figmaVer?.figmaVersion);
}
```

**변경 후:**
```typescript
// tokens.css git auto-commit (변경이 있을 때 항상)
const hasChanges = finalColors.length > 0 || finalTypo.length > 0
  || finalSpacing.length > 0 || finalRadius.length > 0;

if (hasChanges) {
  const { getAllTokensForProject } = await import('@/lib/db/queries');
  const { generateAllCssCode } = await import('@/lib/tokens/css-generator');
  const { commitTokensCss, buildCommitMessage } = await import('@/lib/git/token-commits');

  const allTokens = getAllTokensForProject(projectId);
  const css = generateAllCssCode(allTokens);
  const message = buildCommitMessage({
    colors: finalColors.length,
    typography: finalTypo.length,
    spacing: finalSpacing.length,
    radii: finalRadius.length,
  });
  commitTokensCss(css, message); // 에러 무시 — 추출 성공을 막지 않음
}
```

> **Dynamic import** 사용: `project.ts`는 이미 큰 파일이므로 tree-shaking + 순환 의존 방지

---

## 6. DB 직접 조회 함수: `src/lib/db/queries.ts`

`project.ts`에서 `getAllTokens`를 직접 호출하기 위한 유틸:

```typescript
// src/lib/db/queries.ts (신규 또는 기존 파일에 추가)
import { db } from '@/lib/db';
import { tokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { TokenRow } from '@/lib/actions/tokens';

export function getAllTokensForProject(projectId: string): TokenRow[] {
  return db.select({
    id: tokens.id,
    name: tokens.name,
    type: tokens.type,
    value: tokens.value,
    raw: tokens.raw,
    source: tokens.source,
    mode: tokens.mode,
    collectionName: tokens.collectionName,
    alias: tokens.alias,
  })
    .from(tokens)
    .where(eq(tokens.projectId, projectId))
    .all() as TokenRow[];
}
```

> `project.ts`에 이미 동일한 select 패턴이 `createSnapshotAction` 내부에 존재 — 추출

---

## 7. `TokenCommitHistory` 컴포넌트 설계

### 7-1. Props

```typescript
// src/app/(ide)/diff/TokenCommitHistory.tsx
interface TokenCommitHistoryProps {
  // 없음 — 내부에서 server action 직접 호출
}
```

### 7-2. 상태

| state | type | 역할 |
|-------|------|------|
| `commits` | `TokenCommit[]` | git log 결과 |
| `loading` | `boolean` | 초기 로드 |
| `expandedHash` | `string \| null` | 펼쳐진 커밋 (diff 표시) |
| `diffHtml` | `string \| null` | diff2html 렌더링 결과 |
| `diffLoading` | `boolean` | diff 로드 중 |
| `cssModalHash` | `string \| null` | CSS 보기 모달 트리거 |
| `cssContent` | `string` | git show 결과 |

### 7-3. 렌더 구조

```
TokenCommitHistory
├── 섹션 헤더 ("커밋 이력")
│   └── 파일 경로 배지 (design-tokens/tokens.css)
├── [빈 상태] commits.length === 0
│   └── "아직 추출된 토큰이 없습니다."
└── [커밋 목록] commits.map(commit)
    ├── CommitRow
    │   ├── short hash (monospace)
    │   ├── 상대 날짜 ("2일 전")
    │   ├── 커밋 메시지 ("tokens: 색상 106 · 타이포 42")
    │   ├── [diff 보기] 버튼 → expandedHash 토글
    │   └── [CSS 보기] 버튼 → cssModalHash 세팅
    └── [expanded] expandedHash === commit.hash
        └── DiffViewer (dangerouslySetInnerHTML)
            └── diff2html HTML (unified diff 렌더링)
```

### 7-4. diff2html 사용

```typescript
import { html as diff2html } from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';

// diff 문자열 → HTML
const diffHtml = diff2html(diffString, {
  inputFormat: 'diff',
  showFiles: false,       // 파일 헤더 숨김 (이미 알고 있음)
  matching: 'lines',
  outputFormat: 'line-by-line',
  renderNothingWhenEmpty: false,
});
```

> `diff2html`는 이미 설치됨 (`package.json: "diff2html": "^3.4.56"`).
> 이번엔 실제 `git diff` 결과이므로 `+`/`-` 라인이 올바르게 렌더링됨.

### 7-5. CSS 보기 통합

```typescript
// cssModalHash 세팅 시:
const result = await getTokenCssAtCommitAction(hash);
setCssContent(result.content);
// → CssPreviewModal을 직접 재사용하기 어려우므로
//   동일한 createPortal 다크 모달 패턴으로 인라인 구현
//   OR CssPreviewModal에 content prop 오버라이드 추가
```

---

## 8. 스타일 설계 (`token-commit-history.module.scss`)

GitHub 커밋 히스토리 UI와 유사한 패턴:

```scss
// 기존 diff 페이지 SCSS 변수 재사용
@use '../../../../styles/variables' as *;

.section { /* 섹션 컨테이너 */ }

.commitList {
  border: 1px solid var(--glass-border);
  border-radius: $border-radius-lg;
  overflow: hidden;
}

.commitRow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--glass-border);
  &:last-child { border-bottom: none; }
  &:hover { background: var(--bg-elevated); }
}

.hash {
  font-family: $font-family-mono;
  font-size: 12px;
  color: var(--accent);
  min-width: 64px;
  flex-shrink: 0;
}

.message {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.diffPanel {
  background: #0d1117;  // GitHub dark
  border-top: 1px solid var(--glass-border);
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}
```

---

## 9. `/diff/page.tsx` 통합

기존 페이지 헤더 바로 아래, Drift Detection 위에 `TokenCommitHistory` 섹션 추가:

```tsx
// page.tsx 변경 최소화 — 섹션 하나만 추가
return (
  <div className={styles.page}>
    <div className={styles.header}>...</div>

    {/* ── [신규] 커밋 이력 ── */}
    <TokenCommitHistory />

    {/* ── 기존 Drift Detection ── */}
    <section className={styles.driftSection}>...

    {/* ── 기존 스냅샷 비교 ── */}
    ...
  </div>
);
```

---

## 10. `.gitignore` 처리

`design-tokens/` 디렉토리가 git에 포함되어야 하므로:

1. `.gitignore`에 `design-tokens/` 항목이 없음 — 현재 파악된 내용으로 추가 불필요
2. `design-tokens/` 첫 커밋 시 `git add` 가 자동으로 추적 시작

---

## 11. 에러 처리 전략

| 상황 | 처리 |
|------|------|
| git 저장소 없음 | `CommitTokensResult.error` 설정, 추출은 성공 반환 |
| git user 미설정 | `-c user.name -c user.email` 플래그로 강제 지정 |
| pre-commit 훅 실패 | `--no-verify` 로 우회 |
| `design-tokens/` .gitignore | 현재 없음 — 체크 불필요 |
| `git show` 실패 (hash 없음) | 에러 메시지 UI 표시 |
| diff 결과 빈 문자열 | "변경 없음" 메시지 표시 |
| Server Action 실행 환경 비 git | `commits: []` 반환, 섹션 숨김 |

---

## 12. 데이터 흐름 전체

```
사용자: "추출 시작하기" 클릭
  │
  ▼
extractTokensByTypeAction(type, figmaUrl)
  │  project.ts 내부
  ▼
① DB에 토큰 저장
  │
② histories 테이블에 로그
  │
③ [신규] commitTokensCss(css, message)
      ├─ design-tokens/tokens.css 저장
      ├─ git status --porcelain → 변경 있으면
      ├─ git add design-tokens/tokens.css
      └─ git commit -m "tokens: 색상 106"
  │
  ▼
TokenExtractModal: 1.5초 후 자동 닫기 + router.refresh()

──────────────────────────────────────────
사용자: /diff 페이지 방문
  │
  ▼
TokenCommitHistory 컴포넌트 마운트
  │
  ▼
getTokenCssHistoryAction()
  └─ git log --follow --format ... -- design-tokens/tokens.css
  │
  ▼
커밋 목록 렌더링

사용자: "diff 보기" 클릭 (커밋 N)
  │
  ▼
getTokenCssDiffAction(commitN.hash + "~1", commitN.hash)
  └─ git diff <hash~1> <hash> -- design-tokens/tokens.css
  │
  ▼
diff2html 렌더링 (unified diff → HTML)

사용자: "CSS 보기" 클릭 (커밋 N)
  │
  ▼
getTokenCssAtCommitAction(commitN.hash)
  └─ git show <hash>:design-tokens/tokens.css
  │
  ▼
CssPreviewModal (content 모드)
```

---

## 13. 구현 순서

| # | 파일 | 작업 | 의존 |
|---|------|------|------|
| 1 | `src/lib/db/queries.ts` | `getAllTokensForProject()` 추가 | - |
| 2 | `src/lib/git/token-commits.ts` | `commitTokensCss`, `buildCommitMessage` | 1 |
| 3 | `src/lib/actions/project.ts` | snapshot → commitTokensCss 교체 | 2 |
| 4 | `src/lib/actions/token-history.ts` | server actions 3종 | - |
| 5 | `token-commit-history.module.scss` | 스타일 | - |
| 6 | `TokenCommitHistory.tsx` | UI 컴포넌트 | 4, 5 |
| 7 | `diff/page.tsx` | 섹션 추가 | 6 |

---

## 14. 비범위 (이번 구현 외)

- CSS → DB 역파싱 롤백 (git checkout + 재임포트) — 추후
- 타임스탬프 기반 상대 시간 (`date-fns` 미설치 — `Intl.RelativeTimeFormat` 사용)
- 커밋 별 태그/메모 추가
- 기존 `tokenSnapshots` 데이터 마이그레이션
