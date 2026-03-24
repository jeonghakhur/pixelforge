## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | git-history-viewer |
| 시작일 | 2026-03-24 |
| 대상 | ScreenDrawer → 수정 이력 섹션 |

### Value Delivered

| 관점 | 내용 |
|------|------|
| Problem | 커밋 해시만 보여주는 이력 목록으로는 실제 변경 내용을 확인하려면 터미널을 직접 열어야 함 |
| Solution | Drawer 내에서 단일 커밋 소스 보기 + 두 커밋 diff 비교를 바로 제공 |
| Function / UX Effect | 클릭 1회로 소스 패널 열기, 2회 선택 후 비교 버튼으로 인라인 diff 확인 — 컨텍스트 전환 없이 빠른 리뷰 가능 |
| Core Value | 화면 대시보드에서 코드 리뷰 루프를 완성, 개발자·QA 협업 속도 향상 |

---

# Plan: git-history-viewer

## 1. 개요

ScreenDrawer의 "수정 이력" 섹션에서:
- **단일 커밋 클릭** → 해당 커밋 시점의 파일 소스를 패널에 표시 + 복사 버튼
- **두 커밋 선택 → 비교 버튼** → 두 커밋 사이의 unified diff를 인라인 렌더링

## 2. 사용자 시나리오

### 시나리오 A: 단일 커밋 소스 보기
1. 수정 이력 목록에서 커밋 항목 클릭
2. 이력 섹션 아래 소스 패널이 슬라이드다운으로 열림
3. `git show <hash>:<filePath>` 결과를 코드 블록으로 표시
4. "복사" 버튼 클릭 시 전체 소스 클립보드 복사
5. 패널 닫기(×) 또는 다른 커밋 클릭 시 전환

### 시나리오 B: 두 커밋 비교 (diff)
1. 체크박스로 두 커밋 선택 (최대 2개 강제)
2. 상단에 "비교" 버튼 활성화
3. 클릭 시 diff 패널이 열리며 추가(+)/삭제(-) 라인 컬러 하이라이트
4. `git diff <hashA> <hashB> -- <filePath>` 결과 파싱
5. "복사" 버튼으로 raw diff 복사

## 3. 기술 스택 및 제약

| 항목 | 결정 |
|------|------|
| git 실행 | 기존 `spawnSync` 패턴 그대로 (`src/lib/screens/git-history.ts`) |
| 신규 Server Action | `getCommitSourceAction(id, hash)` — `git show hash:filePath` |
| 신규 Server Action | `getCommitDiffAction(id, hashA, hashB)` — `git diff hashA hashB -- filePath` |
| **diff 렌더링** | **`diff2html` v3.4.56** — git unified diff → GitHub 스타일 HTML 변환 |
| **소스 렌더링** | **`highlight.js` v11.11.1** — 신택스 하이라이팅 |
| **UI 위치** | `document.body` Portal 기반 전용 모달 — 뷰포트 대부분을 차지 |
| 상태 관리 | ScreenDrawer 로컬 useState (전역 Zustand 불필요) |
| 최대 선택 | 체크박스 2개 제한 — 세 번째 선택 시 가장 오래된 항목 해제 |

### 라이브러리 선택 근거: diff2html

`diff2html`은 `git diff`의 unified diff 출력을 그대로 받아 GitHub PR과 동일한 수준의 diff UI로 렌더링한다.

| 특징 | 설명 |
|------|------|
| 입력 | `git diff A B -- file` 출력 그대로 사용 (별도 파싱 불필요) |
| Side-by-side 뷰 | 좌(old) / 우(new) 분할 — GitHub PR 리뷰와 동일한 레이아웃 |
| Line-by-line 뷰 | 한 줄씩 +/- 표시 — 좁은 화면 대응 |
| 신택스 하이라이팅 | highlight.js 연동으로 파일 확장자 기반 언어 감지 |
| 번들 크기 | ~90KB minified (Monaco 대비 20배 가벼움) |
| GitHub 유사도 | 색상·레이아웃·헝크 헤더 모두 GitHub 스타일과 동일 |

### UI 레이아웃 결정: 전용 모달

소스/diff는 가독성이 핵심이므로 ScreenDrawer 내 인라인 패널 대신 **전체 오버레이 모달**을 사용한다.

```
[ ScreenDrawer (우측 슬라이드, 배경 유지) ]
         ↓ 커밋 클릭 / 비교 버튼
┌─────────────────────────────────────────────────────────────┐
│ CodeViewModal  (Portal → body, min(80vw,1200px) × 80vh)     │
│─────────────────────────────────────────────────────────────│
│ 헤더: [소스보기 | 비교] 탭  ·  해시·날짜·작성자  [복사] [×] │
│─────────────────────────────────────────────────────────────│
│ [소스 모드]                    [diff 모드 — diff2html]       │
│  highlight.js 신택스 하이라이트  ┌──────────┬──────────┐   │
│  ┌───┬───────────────────┐      │ OLD (해시A)│ NEW (해시B)│  │
│  │ 1 │ import React...   │      ├──────────┼──────────┤   │
│  │ 2 │ export default... │      │  - 삭제줄 │           │   │
│  │ 3 │ ...               │      │           │  + 추가줄 │   │
│  └───┴───────────────────┘      └──────────┴──────────┘   │
│  overflow-y: auto                Side-by-side (기본)        │
│                                  Line-by-line (토글 가능)   │
└─────────────────────────────────────────────────────────────┘
```

- 모달 너비: `min(80vw, 1200px)` / 높이: `80vh`
- diff 뷰: **Side-by-side 기본**, Line-by-line 토글 버튼 제공
- ESC 키 / 오버레이 클릭으로 닫기
- ScreenDrawer가 열린 상태에서 모달이 그 위에 렌더링됨 (`z-index` 계층 관리)

## 4. 컴포넌트 설계

```
ScreenDrawer
└── gitSection
    ├── CommitList
    │   └── CommitItem         (체크박스 + 클릭 → 소스 모달 열기)
    └── CompareBar             (선택 수 = 2일 때 표시 — "비교" 버튼)

CodeViewModal                  (Portal → document.body)
    ├── ModalOverlay           (클릭 시 닫기)
    ├── ModalHeader            (커밋 정보 + 모드 탭 + 복사/닫기 버튼)
    └── CodePane               (라인 번호 + 코드 렌더링)
        ├── SourceView         (소스 모드)
        └── DiffView           (diff 모드: +/- 컬러 라인)
```

## 5. Server Actions 설계

### `getCommitSourceAction(screenId, hash): Promise<string>`
```
git show <hash>:<filePath>
```
- 반환: 파일 전체 소스 문자열
- 에러: 커밋에 파일 없으면 `''` 반환

### `getCommitDiffAction(screenId, hashA, hashB): Promise<string>`
```
git diff <hashA> <hashB> -- <filePath>
```
- 반환: unified diff 문자열
- hashA = 오래된 커밋, hashB = 최신 커밋 (자동 정렬)

## 6. UI 상태 정의

| 상태 | 설명 |
|------|------|
| `selectedCommits: string[]` | 체크된 커밋 해시 목록 (최대 2) |
| `panelMode: 'source' \| 'diff' \| null` | 현재 패널 모드 |
| `panelHash: string \| null` | 소스 보기 대상 커밋 |
| `panelContent: string` | 로드된 소스 또는 diff 텍스트 |
| `panelLoading: boolean` | 로딩 중 여부 |
| `panelError: string \| null` | 에러 메시지 |

## 7. SCSS 신규 클래스

**수정 이력 섹션 (ScreenDrawer 내)**
- `.commitCheckbox` — 커밋 항목 좌측 체크박스
- `.commitItemSelected` — 선택된 커밋 행 하이라이트
- `.compareBar` — "비교" 버튼 행 (2개 선택 시 표시)

**CodeViewModal (전용 모달)**
- `.codeViewOverlay` — 전체 오버레이 (`position: fixed; inset: 0`)
- `.codeViewModal` — 모달 컨테이너 (`width: min(80vw, 1200px); height: 80vh`)
- `.codeViewHeader` — 헤더 (커밋 메타 + 버튼)
- `.codeViewBody` — 코드 스크롤 영역 (`overflow-y: auto; flex: 1`)
- `.codeLine` — 라인 단위 래퍼 (라인 번호 + 코드)
- `.codeLineNum` — 라인 번호
- `.diffLineAdd` / `.diffLineRemove` / `.diffLineHunk` — diff 컬러
- `.codeViewCopyBtn` — 복사 버튼

## 8. 구현 순서

1. 패키지 설치: `npm install diff2html highlight.js`
2. `git-history.ts` — `getCommitSource`, `getCommitDiff` 함수 추가
3. `actions/screens.ts` — `getCommitSourceAction`, `getCommitDiffAction` 추가
4. `CodeViewModal.tsx` + `CodeViewModal.module.scss` 신규 컴포넌트 생성
   - 소스 모드: highlight.js로 신택스 하이라이팅
   - diff 모드: diff2html로 GitHub 스타일 diff 렌더링
   - Side-by-side / Line-by-line 토글
5. `ScreenDrawer.tsx` — 커밋 체크박스 + 비교 버튼 + `CodeViewModal` 연동
6. 수동 테스트: 소스 보기, diff 비교, 복사, ESC 닫기

## 9. 비기능 요구사항

- 모달 크기: `width: min(80vw, 1200px)`, `height: 80vh`
- 코드 영역 스크롤: `overflow-y: auto` (줄 수 제한 없음)
- 가로 스크롤: `overflow-x: auto` (긴 라인 대응)
- ESC 키 + 오버레이 클릭으로 모달 닫기
- 모달 오픈 시 body 스크롤 차단
- 접근성: `role="dialog"`, `aria-modal="true"`, 체크박스 `aria-label`
- z-index 계층: ScreenDrawer(1000) < CodeViewModal(1100)

## 10. 완료 기준 (DoD)

- [ ] 커밋 클릭 → 소스 패널 열림
- [ ] 소스 패널에서 "복사" 버튼 동작
- [ ] 두 커밋 선택 → "비교" 버튼 활성화
- [ ] 비교 버튼 클릭 → diff 패널 열림 (추가/삭제 라인 컬러)
- [ ] diff 패널에서 "복사" 버튼 동작
- [ ] 패널 닫기(×) 동작
- [ ] 에러 상태 처리 (커밋에 파일 없음 등)
- [ ] WCAG AA 접근성 준수
