## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | 토큰 추출 이력이 DB 스냅샷으로만 저장되어 복잡하고, 실제 변경 내용을 코드처럼 diff로 보거나 git으로 추적할 수 없다 |
| Solution | 추출 완료마다 `design-tokens/tokens.css` 자동 저장 + git auto-commit — git이 모든 버전 이력을 관리 |
| Function UX Effect | 추출 → `tokens.css` 갱신 → git commit 자동 → `/diff` 페이지에서 git log 타임라인 + diff2html 뷰 |
| Core Value | git이 이미 완벽한 버전 관리 시스템 — 별도 DB 스냅샷 없이 `git log`, `git diff`, `git show` 로 토큰 변경 이력을 개발자에게 친숙한 방식으로 추적 |

---

# Plan: 토큰 변경 히스토리 — git auto-commit 방식

## 1. 배경 및 접근 방향

### 기존 방식의 복잡도

- `tokenSnapshots` 테이블 + `snapshot-engine.ts` + 5개 server action
- 롤백 로직, diff 계산 로직, 보존 정책 모두 직접 구현 필요
- CSS는 이미 human-readable + diff-friendly 포맷인데 활용 안 함

### 새 방식: git을 버전 관리자로 사용

```
추출 완료
  ↓
generateAllCssCode(allTokens)  ← 이미 구현됨
  ↓
design-tokens/tokens.css 파일 저장  ← 신규
  ↓
git add design-tokens/tokens.css
git commit -m "tokens: 색상 106 · 타이포 42 (+3/~2/-1)"
  ↓
git log = 히스토리  /  git diff = 변경 내용
```

**장점:**
- 별도 DB 테이블 추가 없음
- `tokens.css`는 프로젝트 repo에 체크인 — 팀원 모두 확인 가능
- git diff = CSS variable 레벨 변경 — 어떤 컬러가 어떤 값으로 바뀌었는지 명확
- `git show <hash>:design-tokens/tokens.css` 로 임의 버전 복원

---

## 2. 파일 구조

```
pixelforge/
└── design-tokens/
    └── tokens.css    ← auto-generated, git tracked
```

**경로 결정 근거:**
- `public/` 는 정적 서빙 대상 — 불필요
- `src/` 는 소스코드 영역 — 토큰 CSS는 아웃풋
- `design-tokens/` 는 관용적 위치 (Style Dictionary, Theo 등 업계 표준)

---

## 3. git 자동 커밋 구현

### 3-1. 유틸리티: `src/lib/git/token-commits.ts`

```typescript
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const TOKENS_CSS_PATH = path.join(process.cwd(), 'design-tokens', 'tokens.css');

export interface CommitTokensResult {
  committed: boolean;   // 실제 커밋 발생 여부 (변경 없으면 false)
  hash: string | null;  // 커밋 해시 (7자리)
  error: string | null;
}

export function commitTokensCss(
  cssContent: string,
  message: string,        // "tokens: 색상 106 · 타이포 42 (+3/~2/-1)"
): CommitTokensResult {
  try {
    // 디렉토리 보장
    fs.mkdirSync(path.dirname(TOKENS_CSS_PATH), { recursive: true });
    fs.writeFileSync(TOKENS_CSS_PATH, cssContent, 'utf-8');

    // git status 확인 (변경 없으면 commit 스킵)
    const status = execSync('git status --porcelain design-tokens/tokens.css', {
      cwd: process.cwd(),
    }).toString().trim();

    if (!status) {
      return { committed: false, hash: null, error: null }; // 파일 동일 — 변경 없음
    }

    execSync('git add design-tokens/tokens.css', { cwd: process.cwd() });
    execSync(`git commit -m "${message}" --no-verify`, { cwd: process.cwd() });

    const hash = execSync('git rev-parse --short HEAD', { cwd: process.cwd() })
      .toString().trim();

    return { committed: true, hash, error: null };
  } catch (err) {
    return {
      committed: false,
      hash: null,
      error: err instanceof Error ? err.message : 'git commit 실패',
    };
  }
}
```

> **`--no-verify`**: pre-commit 훅(lint, type-check)이 자동 커밋을 차단하지 않도록.
> `tokens.css`는 생성 파일이므로 코드 검사 대상 외.

### 3-2. 커밋 메시지 형식

```
tokens: 색상 106 · 타이포 42 · 간격 18 · 반경 8  (+3/~2/-0)
```

- **타입별 총 수**: 추출된 전체 토큰 수
- **변경 요약**: 이전 `tokens.css`와 비교한 줄 수 변화 (`git diff --stat` 결과 활용)
- prefix `tokens:` → `git log --grep='^tokens:'` 로 토큰 커밋만 필터링 가능

### 3-3. 트리거 위치: `project.ts`

추출 완료 후 (기존 snapshot 조건 블록 교체):

```typescript
// project.ts 추출 완료 직후
import { commitTokensCss } from '@/lib/git/token-commits';
import { generateAllCssCode } from '@/lib/tokens/css-generator';
import { getAllTokens } from '@/lib/db/tokens';  // 직접 DB 조회

const allTokens = getAllTokens(projectId);
const css = generateAllCssCode(allTokens);

const summary = [
  finalColors.length    > 0 && `색상 ${finalColors.length}`,
  finalTypo.length      > 0 && `타이포 ${finalTypo.length}`,
  finalSpacing.length   > 0 && `간격 ${finalSpacing.length}`,
  finalRadius.length    > 0 && `반경 ${finalRadius.length}`,
].filter(Boolean).join(' · ');

commitTokensCss(css, `tokens: ${summary}`);
// 에러는 무시 — git 실패가 추출 자체를 막으면 안 됨
```

---

## 4. 히스토리 조회

### 4-1. Server Action: `getTokenCssHistoryAction()`

```typescript
// src/lib/actions/token-history.ts
export interface TokenCommit {
  hash: string;       // 7자리 short hash
  date: string;       // ISO
  message: string;    // "tokens: 색상 106 ..."
  author: string;
}

export async function getTokenCssHistoryAction(): Promise<TokenCommit[]> {
  const out = execSync(
    'git log --follow --format="%h|%ai|%s|%an" -- design-tokens/tokens.css',
    { cwd: process.cwd() }
  ).toString().trim();

  if (!out) return [];
  return out.split('\n').map((line) => {
    const [hash, date, message, author] = line.split('|');
    return { hash, date, message, author };
  });
}
```

### 4-2. Server Action: `getTokenCssDiffAction(hashA, hashB)`

```typescript
export async function getTokenCssDiffAction(
  hashA: string,
  hashB: string,
): Promise<string> {
  return execSync(
    `git diff ${hashA} ${hashB} -- design-tokens/tokens.css`,
    { cwd: process.cwd() }
  ).toString();
}
```

→ 반환된 unified diff string을 `/diff` 페이지에서 **기존 `diff2html`** 렌더링

### 4-3. Server Action: `getTokenCssAtCommitAction(hash)`

```typescript
export async function getTokenCssAtCommitAction(hash: string): Promise<string> {
  return execSync(
    `git show ${hash}:design-tokens/tokens.css`,
    { cwd: process.cwd() }
  ).toString();
}
```

---

## 5. UI — `/diff` 페이지 개선

기존 `/diff` 페이지(스냅샷 뷰)를 **git log 뷰**로 교체 or 탭 추가:

```
┌─────────────────────────────────────────────────────────┐
│  토큰 변경 이력                                          │
├─────────────────────────────────────────────────────────┤
│  ○ a3f2c1b  03/24 14:20  tokens: 색상 106 · 타이포 42  │
│  │  [diff 보기]  →  diff2html 렌더링                    │
├─────────────────────────────────────────────────────────┤
│  ○ 7d1e4f2  03/23 10:15  tokens: 색상 103 · 타이포 42  │
│  │  [diff 보기]  [이 버전 CSS 보기]                     │
├─────────────────────────────────────────────────────────┤
│  ○ 2b8a9c5  03/20 09:00  tokens: 색상 91               │
└─────────────────────────────────────────────────────────┘
```

- **diff 보기**: 이전 커밋 대비 변경 → `git diff <hash~1> <hash> -- design-tokens/tokens.css`
- **이 버전 CSS 보기**: `git show <hash>:design-tokens/tokens.css` → `CssPreviewModal` 재활용
- diff 렌더링: **기존 `diff2html`** — 이번엔 실제 diff라서 `+`/`-` 라인이 올바르게 표시됨

---

## 6. `.gitignore` 처리

`design-tokens/tokens.css`는 git tracked 대상이므로 `.gitignore`에 **추가하면 안 됨**.
기존 `.gitignore`에 포함됐는지 확인 후 제외 처리.

---

## 7. 기존 tokenSnapshots 처리

| 항목 | 처리 |
|------|------|
| `tokenSnapshots` 테이블 | 유지 (기존 데이터 보존) — 단, 신규 생성은 중단 |
| `snapshot-engine.ts` | 유지 (wrapAsDiff 등 다른 용도 활용 가능) |
| `createSnapshotAction` 호출 (`project.ts`) | 제거 → `commitTokensCss` 호출로 교체 |
| `/diff` 페이지 스냅샷 탭 | 기존 탭 유지 + 신규 "git 이력" 탭 추가 |

> **마이그레이션 없음** — 신규 추출부터 git 방식으로 저장. 과거 스냅샷은 그대로.

---

## 8. 구현 순서

1. `src/lib/git/token-commits.ts` — `commitTokensCss()` 유틸리티
2. `src/lib/actions/token-history.ts` — `getTokenCssHistoryAction`, `getTokenCssDiffAction`, `getTokenCssAtCommitAction`
3. `src/lib/actions/project.ts` — `createSnapshotAction` → `commitTokensCss` 교체
4. `.gitignore` 확인 — `design-tokens/` 제외 여부 확인
5. `/diff` 페이지 — "git 이력" 탭 추가 (기존 스냅샷 탭 옆에)

---

## 9. 엣지 케이스

| 상황 | 처리 |
|------|------|
| git 저장소 없음 | `execSync` try/catch → 에러 로그만, 추출 자체는 성공 |
| git user 미설정 | `git -c user.name="PixelForge" -c user.email="bot@pixelforge" commit` |
| `design-tokens/` .gitignore 포함 | 초기 셋업 시 제거 처리 |
| 동일 내용 재추출 | `git status --porcelain` 확인 → 변경 없으면 커밋 스킵 |
| CI/CD 환경 | `process.env.NODE_ENV !== 'production'` 가드 (선택) |

---

## 10. 비범위

- `design-tokens/tokens.css` 이외 포맷 (SCSS variables, JS tokens, Tailwind config) — 후속
- git branch 연동 (PR 기반 변경 추적) — 후속
- 이메일/슬랙 알림 — 후속
- 기존 `tokenSnapshots` 데이터 git으로 마이그레이션 — 불필요
