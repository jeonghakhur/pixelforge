# Design: git-history-viewer

> Plan: `docs/01-plan/features/git-history-viewer.plan.md`

---

## 1. 파일 구조

```
src/
├── lib/
│   └── screens/
│       └── git-history.ts              ← getCommitSource / getCommitDiff 추가
├── lib/actions/
│   └── screens.ts                      ← getCommitSourceAction / getCommitDiffAction 추가
└── app/(ide)/screens/
    ├── ScreenDrawer.tsx                 ← 체크박스 선택 상태 + CodeViewModal 연동
    ├── CodeViewModal.tsx                ← 신규 컴포넌트 (Portal 기반 모달)
    └── CodeViewModal.module.scss        ← 신규 SCSS
```

**수정 파일:** `git-history.ts`, `screens.ts`, `ScreenDrawer.tsx`
**신규 파일:** `CodeViewModal.tsx`, `CodeViewModal.module.scss`

---

## 2. 패키지 설치

```bash
npm install diff2html highlight.js
```

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `diff2html` | ^3.4.56 | unified diff → GitHub 스타일 HTML |
| `highlight.js` | ^11.11.1 | 소스 코드 신택스 하이라이팅 |

---

## 3. git-history.ts — 신규 함수

```typescript
/**
 * 특정 커밋 시점의 파일 전체 소스를 반환한다.
 * git show <hash>:<filePath>
 */
export function getCommitSource(filePath: string, hash: string): string {
  const cwd = process.cwd();
  // 풀 해시로 복원 필요 (short hash 7자리 → git이 자동 해석)
  return runGit(['show', `${hash}:${filePath}`], cwd);
}

/**
 * 두 커밋 사이의 unified diff를 반환한다.
 * 항상 오래된 → 최신 순으로 정렬하여 diff 방향을 일관되게 유지.
 * git diff <older> <newer> -- <filePath>
 */
export function getCommitDiff(
  filePath: string,
  hashA: string,
  hashB: string,
): string {
  const cwd = process.cwd();
  // 두 해시의 커밋 날짜를 비교해 오래된 것이 첫 번째가 되도록 정렬
  const dateA = runGit(['log', '-1', '--format=%at', hashA], cwd);
  const dateB = runGit(['log', '-1', '--format=%at', hashB], cwd);
  const [older, newer] =
    parseInt(dateA) <= parseInt(dateB) ? [hashA, hashB] : [hashB, hashA];
  return runGit(['diff', older, newer, '--', filePath], cwd);
}
```

---

## 4. Server Actions — screens.ts

```typescript
/** 특정 커밋 시점의 파일 소스 반환 */
export async function getCommitSourceAction(
  screenId: string,
  hash: string,
): Promise<{ source: string; language: string }> {
  'use server';
  const rows = db
    .select({ filePath: screens.filePath })
    .from(screens)
    .where(eq(screens.id, screenId))
    .all();
  if (!rows[0]) throw new Error('화면을 찾을 수 없습니다');
  const source = getCommitSource(rows[0].filePath, hash);
  // highlight.js 언어 감지용 확장자 추출
  const ext = rows[0].filePath.split('.').pop() ?? 'tsx';
  const langMap: Record<string, string> = {
    tsx: 'typescript', ts: 'typescript',
    jsx: 'javascript', js: 'javascript',
    scss: 'scss', css: 'css',
    json: 'json', md: 'markdown',
  };
  return { source, language: langMap[ext] ?? 'typescript' };
}

/** 두 커밋 사이의 diff 반환 */
export async function getCommitDiffAction(
  screenId: string,
  hashA: string,
  hashB: string,
): Promise<string> {
  'use server';
  const rows = db
    .select({ filePath: screens.filePath })
    .from(screens)
    .where(eq(screens.id, screenId))
    .all();
  if (!rows[0]) throw new Error('화면을 찾을 수 없습니다');
  return getCommitDiff(rows[0].filePath, hashA, hashB);
}
```

---

## 5. ScreenDrawer.tsx — 상태 & UI 변경

### 5.1 추가 상태

```typescript
// 기존 상태에 추가
const [selectedHashes, setSelectedHashes] = useState<string[]>([]);
const [codeViewMode, setCodeViewMode] = useState<'source' | 'diff' | null>(null);
const [codeViewHash, setCodeViewHash] = useState<string | null>(null); // 소스 모드용
```

### 5.2 커밋 체크박스 토글 핸들러

```typescript
const handleHashToggle = (hash: string) => {
  setSelectedHashes((prev) => {
    if (prev.includes(hash)) return prev.filter((h) => h !== hash);
    if (prev.length >= 2) return [...prev.slice(1), hash]; // 오래된 것 제거, 최대 2개
    return [...prev, hash];
  });
};

const handleCommitClick = (hash: string) => {
  setCodeViewHash(hash);
  setCodeViewMode('source');
};

const handleCompare = () => {
  if (selectedHashes.length === 2) setCodeViewMode('diff');
};
```

### 5.3 GitTimeline 수정 (체크박스 + 클릭)

```tsx
<ol className={styles.gitTimeline}>
  {gitLog.map((commit, i) => (
    <li
      key={commit.hash}
      className={`${styles.gitCommit} ${
        selectedHashes.includes(commit.hash) ? styles.gitCommitSelected : ''
      }`}
    >
      {/* 체크박스 */}
      <input
        type="checkbox"
        className={styles.commitCheckbox}
        checked={selectedHashes.includes(commit.hash)}
        onChange={() => handleHashToggle(commit.hash)}
        aria-label={`${commit.hash} 선택`}
      />
      <div className={styles.gitDot} data-first={i === 0 ? 'true' : undefined} />
      {/* 커밋 본문 — 클릭 시 소스 보기 */}
      <button
        type="button"
        className={styles.gitCommitBtn}
        onClick={() => handleCommitClick(commit.hash)}
      >
        <div className={styles.gitCommitMeta}>
          <code className={styles.gitHash}>{commit.hash}</code>
          <span className={styles.gitDate}>{commit.date}</span>
          <span className={styles.gitAuthor}>{commit.author}</span>
        </div>
        <p className={styles.gitMessage}>{commit.message}</p>
      </button>
    </li>
  ))}
</ol>

{/* 비교 바 — 2개 선택 시 */}
{selectedHashes.length === 2 && (
  <div className={styles.compareBar}>
    <span className={styles.compareBarLabel}>
      <code>{selectedHashes[0]}</code>
      <Icon icon="solar:arrow-right-linear" width={12} height={12} />
      <code>{selectedHashes[1]}</code>
    </span>
    <button type="button" className={styles.compareBtn} onClick={handleCompare}>
      <Icon icon="solar:code-scan-linear" width={13} height={13} />
      비교
    </button>
    <button
      type="button"
      className={styles.compareClearBtn}
      onClick={() => setSelectedHashes([])}
      aria-label="선택 해제"
    >
      <Icon icon="solar:close-circle-linear" width={13} height={13} />
    </button>
  </div>
)}

{/* CodeViewModal */}
{codeViewMode && (
  <CodeViewModal
    screenId={screen.id}
    mode={codeViewMode}
    hash={codeViewMode === 'source' ? codeViewHash! : undefined}
    hashA={codeViewMode === 'diff' ? selectedHashes[0] : undefined}
    hashB={codeViewMode === 'diff' ? selectedHashes[1] : undefined}
    commits={gitLog}
    onClose={() => { setCodeViewMode(null); setCodeViewHash(null); }}
  />
)}
```

---

## 6. CodeViewModal.tsx — 전체 설계

```typescript
'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import scss from 'highlight.js/lib/languages/scss';
import json from 'highlight.js/lib/languages/json';
// ... 필요한 언어만 tree-shaking으로 등록
import { Diff2Html } from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';
import type { GitCommit } from '@/lib/screens/git-history';
import { getCommitSourceAction, getCommitDiffAction } from '@/lib/actions/screens';
import styles from './CodeViewModal.module.scss';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('json', json);

interface CodeViewModalProps {
  screenId: string;
  mode: 'source' | 'diff';
  hash?: string;           // 소스 모드
  hashA?: string;          // diff 모드 — old
  hashB?: string;          // diff 모드 — new
  commits: GitCommit[];    // 커밋 메타 조회용
  onClose: () => void;
}

export default function CodeViewModal({
  screenId, mode, hash, hashA, hashB, commits, onClose,
}: CodeViewModalProps) {
  const [content, setContent] = useState('');
  const [diffViewType, setDiffViewType] = useState<'side-by-side' | 'line-by-line'>('side-by-side');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 데이터 로드
  useEffect(() => {
    setLoading(true);
    setError(null);
    const load = mode === 'source'
      ? getCommitSourceAction(screenId, hash!).then(({ source }) => source)
      : getCommitDiffAction(screenId, hashA!, hashB!);
    load
      .then(setContent)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [screenId, mode, hash, hashA, hashB]);

  // ESC 닫기 + 포커스
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // body 스크롤 차단
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // 소스 모드: highlight.js 렌더링
  const highlightedSource = mode === 'source' && content
    ? hljs.highlightAuto(content).value
    : '';

  // diff 모드: diff2html 렌더링
  const diffHtml = mode === 'diff' && content
    ? Diff2Html.html(content, {
        drawFileList: false,
        matching: 'lines',
        outputFormat: diffViewType,
        highlight: true,
        renderNothingWhenEmpty: false,
      })
    : '';

  // 헤더용 커밋 메타
  const commitMeta = mode === 'source'
    ? commits.find((c) => c.hash === hash)
    : null;

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'source' ? '소스 보기' : '커밋 비교'}
      >
        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {mode === 'source' && commitMeta ? (
              <>
                <code className={styles.headerHash}>{commitMeta.hash}</code>
                <span className={styles.headerDate}>{commitMeta.date}</span>
                <span className={styles.headerAuthor}>{commitMeta.author}</span>
                <span className={styles.headerMessage}>{commitMeta.message}</span>
              </>
            ) : (
              <>
                <Icon icon="solar:code-scan-linear" width={14} height={14} style={{ color: 'var(--accent)' }} />
                <span className={styles.headerTitle}>커밋 비교</span>
                <code className={styles.headerHash}>{hashA}</code>
                <Icon icon="solar:arrow-right-linear" width={12} height={12} style={{ color: 'var(--text-muted)' }} />
                <code className={styles.headerHash}>{hashB}</code>
              </>
            )}
          </div>
          <div className={styles.headerRight}>
            {/* diff 뷰 토글 */}
            {mode === 'diff' && (
              <div className={styles.viewToggle}>
                <button
                  type="button"
                  className={`${styles.viewToggleBtn} ${diffViewType === 'side-by-side' ? styles.viewToggleBtnActive : ''}`}
                  onClick={() => setDiffViewType('side-by-side')}
                >
                  <Icon icon="solar:sidebar-minimalistic-linear" width={13} height={13} />
                  Side-by-side
                </button>
                <button
                  type="button"
                  className={`${styles.viewToggleBtn} ${diffViewType === 'line-by-line' ? styles.viewToggleBtnActive : ''}`}
                  onClick={() => setDiffViewType('line-by-line')}
                >
                  <Icon icon="solar:list-linear" width={13} height={13} />
                  Line-by-line
                </button>
              </div>
            )}
            {/* 복사 버튼 */}
            <button
              type="button"
              className={styles.copyBtn}
              onClick={handleCopy}
              disabled={loading || !content}
            >
              <Icon
                icon={copied ? 'solar:check-circle-linear' : 'solar:copy-linear'}
                width={13}
                height={13}
                style={{ color: copied ? 'var(--success)' : undefined }}
              />
              {copied ? '복사됨' : '복사'}
            </button>
            {/* 닫기 */}
            <button
              ref={closeRef}
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="닫기"
            >
              <Icon icon="solar:close-circle-linear" width={16} height={16} />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className={styles.body}>
          {loading && (
            <div className={styles.loadingWrap}>
              <Icon icon="solar:refresh-linear" width={20} height={20} className={styles.spinning} />
              <span>불러오는 중...</span>
            </div>
          )}
          {error && (
            <div className={styles.errorWrap}>
              <Icon icon="solar:danger-circle-linear" width={20} height={20} />
              <span>{error}</span>
            </div>
          )}
          {!loading && !error && mode === 'source' && (
            <pre className={styles.codeBlock}>
              <code
                className="hljs"
                dangerouslySetInnerHTML={{ __html: highlightedSource }}
              />
            </pre>
          )}
          {!loading && !error && mode === 'diff' && (
            <div
              className={styles.diffWrap}
              dangerouslySetInnerHTML={{ __html: diffHtml }}
            />
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
```

---

## 7. CodeViewModal.module.scss

```scss
@use '../../../styles/variables' as *;
@use '../../../styles/mixins' as *;

// ─── 오버레이 ────────────────────────────────────
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  z-index: 1100;
}

// ─── 모달 컨테이너 ───────────────────────────────
.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(82vw, 1280px);
  height: 82vh;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: $border-radius-xl;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1101;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
}

// ─── 헤더 ────────────────────────────────────────
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: map-get($spacers, 3);
  padding: 0 map-get($spacers, 3);
  height: 48px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.headerLeft {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  min-width: 0;
}

.headerHash {
  font-family: $font-family-mono;
  font-size: $font-size-sm;
  color: var(--accent);
  background: var(--accent-subtle);
  padding: 2px 6px;
  border-radius: $border-radius-sm;
  flex-shrink: 0;
}

.headerDate, .headerAuthor {
  font-size: $font-size-sm;
  color: var(--text-muted);
  flex-shrink: 0;
}

.headerMessage {
  font-size: $font-size-sm;
  color: var(--text-secondary);
  @include text-truncate;
}

.headerTitle {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: var(--text-primary);
}

.headerRight {
  display: flex;
  align-items: center;
  gap: map-get($spacers, 2);
  flex-shrink: 0;
}

// ─── 뷰 토글 (Side-by-side / Line-by-line) ──────
.viewToggle {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: $border-radius-sm;
  overflow: hidden;
}

.viewToggleBtn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: $font-size-xs;
  cursor: pointer;
  transition: $transition-fast;

  &:hover { color: var(--text-primary); background: var(--bg-hover); }

  & + & { border-left: 1px solid var(--border-color); }
}

.viewToggleBtnActive {
  background: var(--accent-subtle);
  color: var(--accent);
}

// ─── 복사 / 닫기 버튼 ───────────────────────────
.copyBtn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: $border-radius-sm;
  color: var(--text-secondary);
  font-size: $font-size-xs;
  cursor: pointer;
  transition: $transition-fast;

  &:hover { border-color: var(--accent-subtle); color: var(--accent); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

.closeBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: $border-radius-sm;
  transition: $transition-fast;

  &:hover { color: var(--text-primary); background: var(--bg-hover); }
}

// ─── 본문 ─────────────────────────────────────────
.body {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

// 로딩 / 에러
.loadingWrap, .errorWrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: map-get($spacers, 2);
  height: 100%;
  color: var(--text-muted);
  font-size: $font-size-sm;
}

.errorWrap { color: var(--danger); }

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// ─── 소스 코드 블록 ──────────────────────────────
.codeBlock {
  margin: 0;
  padding: map-get($spacers, 3);
  font-family: $font-family-mono;
  font-size: 13px;
  line-height: 1.6;
  tab-size: 2;
  overflow: visible; // body가 스크롤 처리

  code {
    font-family: inherit;
    white-space: pre;
  }
}

// ─── diff2html 오버라이드 (다크/라이트 테마 통합) ─
.diffWrap {
  // diff2html 기본 스타일 위에 프로젝트 변수로 덮어씌움
  :global(.d2h-wrapper) {
    padding: map-get($spacers, 2);
  }

  :global(.d2h-file-header) {
    background: var(--bg-elevated);
    border-color: var(--border-color);
    color: var(--text-secondary);
    font-family: $font-family-mono;
    font-size: $font-size-sm;
  }

  :global(.d2h-code-linenumber),
  :global(.d2h-code-side-linenumber) {
    background: var(--bg-elevated);
    border-color: var(--border-color);
    color: var(--text-muted);
    font-size: 12px;
    min-width: 48px;
  }

  :global(.d2h-code-line),
  :global(.d2h-code-side-line) {
    font-family: $font-family-mono;
    font-size: 13px;
    line-height: 1.6;
  }

  // 추가 라인 (초록)
  :global(.d2h-ins) {
    background: rgba(46, 160, 67, 0.15) !important;
    :global(.d2h-code-line-ctn) { color: var(--text-primary); }
  }
  :global(.d2h-ins.d2h-code-linenumber),
  :global(.d2h-ins.d2h-code-side-linenumber) {
    background: rgba(46, 160, 67, 0.2) !important;
    color: #3fb950;
  }

  // 삭제 라인 (빨간)
  :global(.d2h-del) {
    background: rgba(248, 81, 73, 0.15) !important;
    :global(.d2h-code-line-ctn) { color: var(--text-primary); }
  }
  :global(.d2h-del.d2h-code-linenumber),
  :global(.d2h-del.d2h-code-side-linenumber) {
    background: rgba(248, 81, 73, 0.2) !important;
    color: #f85149;
  }

  // 헝크 헤더
  :global(.d2h-info) {
    background: rgba(59, 130, 246, 0.08) !important;
    color: var(--text-muted);
    font-family: $font-family-mono;
    font-size: 12px;
  }

  // 테이블 보더
  :global(.d2h-diff-table) {
    border-color: var(--border-color);
  }

  :global(.d2h-file-wrapper) {
    border-color: var(--border-color);
    border-radius: $border-radius;
    overflow: hidden;
    margin-bottom: map-get($spacers, 2);
  }
}
```

---

## 8. ScreenDrawer.module.scss — 추가 클래스

```scss
// ─── 커밋 체크박스 ───────────────────────────────
.commitCheckbox {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  margin-right: 6px;
  accent-color: var(--accent);
  cursor: pointer;
}

.gitCommitSelected {
  background: var(--accent-subtle);
  border-radius: $border-radius-sm;
}

.gitCommitBtn {
  flex: 1;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: inherit;
  min-width: 0;

  &:hover .gitHash { color: var(--accent); }
}

// ─── 비교 바 ────────────────────────────────────
.compareBar {
  display: flex;
  align-items: center;
  gap: map-get($spacers, 2);
  margin-top: map-get($spacers, 2);
  padding: 8px map-get($spacers, 2);
  background: var(--accent-subtle);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: $border-radius;
}

.compareBarLabel {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: $font-size-xs;
  color: var(--text-muted);
  overflow: hidden;
  min-width: 0;

  code {
    font-family: $font-family-mono;
    color: var(--accent);
    font-size: $font-size-xs;
  }
}

.compareBtn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  background: var(--accent);
  border: none;
  border-radius: $border-radius-sm;
  color: white;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  cursor: pointer;
  transition: $transition-fast;
  flex-shrink: 0;

  &:hover { opacity: 0.85; }
}

.compareClearBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;

  &:hover { color: var(--text-primary); }
}
```

---

## 9. 완료 기준 (DoD)

- [ ] 커밋 클릭 → CodeViewModal 소스 모드 열림
- [ ] highlight.js 신택스 하이라이팅 적용
- [ ] 소스 모드 "복사" 버튼 동작
- [ ] 체크박스 2개 선택 → compareBar 표시
- [ ] "비교" 버튼 → diff 모드 모달 열림
- [ ] diff2html Side-by-side 기본 표시
- [ ] Line-by-line 토글 동작
- [ ] diff 모드 "복사" (raw diff) 버튼 동작
- [ ] ESC / 오버레이 클릭 → 모달 닫기
- [ ] body 스크롤 차단
- [ ] 로딩 / 에러 상태 처리
- [ ] WCAG AA: role="dialog", aria-modal, aria-label
