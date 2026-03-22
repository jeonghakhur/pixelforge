# PixelForge 프로젝트 기획서

> Figma 디자인 → Bootstrap 기반 코드 자동 생성 **로컬 설치형 웹앱**
> 작성일: 2026-03-22

---

## 1. 프로젝트 개요

### 목표
Figma URL을 입력하면 디자인 토큰과 Bootstrap 클론 컴포넌트를 자동 생성하는 **프로젝트별 로컬 설치형** 디자인 시스템 빌더

### 핵심 가치
> "사람이 판단할 여지를 없애는 것" — 누가 작업해도 동일한 결과물

### 해결하는 문제
- Figma ↔ 코드 간 디자인 토큰 수동 동기화 반복 작업
- 개발자마다 다른 컴포넌트 구현 방식
- 디자인 시스템 문서와 실제 코드 불일치
- 금융권 망분리 환경에서 외부 서버 의존 불가

---

## 2. 설치 및 실행 방식

### npx 방식 (권장)
```bash
# 프로젝트 루트에서 실행
cd my-project
npx pixelforge

# → http://localhost:3847 브라우저 자동 오픈
```

### 전역 설치 방식
```bash
npm install -g pixelforge
cd my-project
pixelforge
```

### 프로젝트별 독립 데이터
```
my-project/
├── .pixelforge/
│   ├── db.sqlite       ← 이 프로젝트의 토큰/컴포넌트 데이터
│   └── config.json     ← Figma API 토큰, 설정
├── src/
└── package.json
```

- 프로젝트마다 완전히 독립된 데이터
- 외부 서버 의존 없음 → 금융권 망분리 환경 OK
- `.gitignore`에 `.pixelforge/` 추가 권장 (API 토큰 보호)

---

## 3. 핵심 기능

### Phase 1 — 토큰 추출
- Figma URL 입력 → 토큰 자동 추출
- 색상, 타이포그래피, 간격, Border Radius
- 출력: `_variables.scss`, `tokens.json`

### Phase 2 — 컴포넌트 생성
- Bootstrap SCSS 클론 기반 컴포넌트 재가공
- 추출된 토큰을 컴포넌트에 자동 적용
- 사이드 메뉴에 컴포넌트 자동 등록
- 컴포넌트 선택 시 가이드 페이지 표시 (Storybook 스타일)

### Phase 3 — 코드 내보내기
- 생성된 SCSS/TSX 파일 프로젝트에 직접 복사
- 변경사항 diff 비교
- 히스토리 타임라인

---

## 4. 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 서버 | **Node.js + Express** (또는 Fastify) | 가볍고 CLI 친화적 |
| 프론트엔드 | **Next.js 15** (번들 포함) | GUI 구성, SSR |
| 언어 | TypeScript strict | 타입 안정성 |
| 스타일링 | Bootstrap SCSS 클론 | 완전한 제어권 |
| DB | **SQLite (better-sqlite3)** | 로컬 파일, 서버 불필요 |
| ORM | **Drizzle ORM** | SQLite 친화적, 타입 안전 |
| 상태관리 | Zustand | 가볍고 직관적 |
| 폼 | react-hook-form + zod | 검증 일원화 |
| 외부 API | Figma REST API | 디자인 토큰 추출 |
| 패키징 | npm 패키지 (npx 지원) | 간편 설치 |

---

## 5. DB 설계 (SQLite)

### `projects` — 프로젝트 정보
```sql
id          TEXT PK (nanoid)
name        TEXT NOT NULL
figma_url   TEXT
figma_key   TEXT
description TEXT
created_at  INTEGER (unix timestamp)
updated_at  INTEGER
```

### `tokens` — 추출된 디자인 토큰
```sql
id          TEXT PK
project_id  TEXT FK
version     INTEGER   -- 버전 (1, 2, 3...)
type        TEXT      -- 'color' | 'typography' | 'spacing' | 'radius'
name        TEXT      -- 토큰 이름
value       TEXT      -- 토큰 값
raw         TEXT      -- JSON 원본 (Figma 데이터)
created_at  INTEGER
```

### `components` — 생성된 컴포넌트
```sql
id          TEXT PK
project_id  TEXT FK
name        TEXT      -- 'Button', 'Input', 'Modal'
category    TEXT      -- 'action' | 'form' | 'navigation' | 'feedback'
scss        TEXT      -- 생성된 SCSS 코드
tsx         TEXT      -- 생성된 TSX 코드
description TEXT
menu_order  INTEGER   -- 사이드 메뉴 순서
is_visible  INTEGER   -- 1 | 0
created_at  INTEGER
updated_at  INTEGER
```

### `histories` — 추출/생성 히스토리
```sql
id          TEXT PK
project_id  TEXT FK
action      TEXT      -- 'extract_tokens' | 'generate_component' | 'export'
summary     TEXT      -- "색상 106개, 타이포 55개 추출"
metadata    TEXT      -- JSON 상세 데이터
created_at  INTEGER
```

---

## 6. 화면 구성

### 레이아웃
```
┌─────────────────────────────────────────────────────┐
│  Header: PixelForge 로고 + 프로젝트명 + 설정         │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ 사이드바  │  메인 컨텐츠                              │
│          │                                          │
│ 📋 개요   │                                          │
│          │                                          │
│ 🎨 토큰   │  (선택한 메뉴에 따라 변경)                 │
│  └ 색상   │                                          │
│  └ 타이포 │                                          │
│  └ 간격   │                                          │
│  └ 반경   │                                          │
│           │                                          │
│ 🧩 컴포넌트│                                         │
│  └ Button │                                          │
│  └ Input  │                                          │
│  └ Modal  │                                          │
│  └ ...    │                                          │
│           │                                          │
│ [+컴포넌트]│                                         │
│           │                                          │
│ 📜 히스토리│                                         │
└──────────┴──────────────────────────────────────────┘
```

### 주요 페이지

#### 1. 프로젝트 홈 `/`
- Figma URL 입력
- 토큰 추출 버튼
- 추출 결과 요약 카드
- 히스토리 타임라인

#### 2. 토큰 가이드 `/tokens/[type]`
- 색상: 팔레트 시각화 + HEX 복사
- 타이포: 폰트 샘플 + CSS 복사
- 간격: 박스 시각화
- 반경: 예시 박스
- SCSS/JSON 전체 코드 다운로드

#### 3. 컴포넌트 가이드 `/components/[name]`
- 라이브 프리뷰 (실제 렌더링)
- 변형(variant) 목록
- SCSS + TSX 코드 보기/복사
- 사용 가이드 (Props 설명)

#### 4. 컴포넌트 추가 `/components/new`
- Bootstrap 클론 컴포넌트 목록에서 선택
- 현재 토큰 자동 적용 미리보기
- 생성 → 사이드 메뉴 자동 등록

#### 5. 설정 `/settings`
- Figma API 토큰 관리
- 토큰 매핑 커스텀
- 내보내기 경로 설정

---

## 7. 컴포넌트 생성 플로우

```
사용자: [+ 컴포넌트 추가] 클릭
    ↓
컴포넌트 유형 선택 (Button, Input, Modal 등)
    ↓
Bootstrap 클론 템플릿 로드
    ↓
현재 프로젝트 토큰 자동 매핑
  $primary       → 추출된 primary 색상
  $font-size-base → 추출된 base 폰트 크기
  $border-radius  → 추출된 반경 값
    ↓
SCSS + TSX 코드 생성
    ↓
사이드 메뉴 자동 등록 + DB 저장
    ↓
가이드 페이지 자동 생성
```

---

## 8. Bootstrap 토큰 매핑 전략

Figma 토큰 → Bootstrap SCSS 변수 자동 매핑:

| Figma 토큰 패턴 | Bootstrap 변수 |
|----------------|----------------|
| Primary 색상 | `$primary` |
| Secondary 색상 | `$secondary` |
| Success 색상 | `$success` |
| Danger/Error 색상 | `$danger` |
| 기본 텍스트 색 | `$body-color` |
| 배경 색 | `$body-bg` |
| Base 폰트 패밀리 | `$font-family-base` |
| Base 폰트 크기 | `$font-size-base` |
| Base Border Radius | `$border-radius` |
| 기본 간격 단위 | `$spacer` |

사용자가 매핑 커스텀 가능 (설정 페이지에서)

---

## 9. 코드 내보내기

```bash
# 생성된 토큰/컴포넌트를 프로젝트 src에 복사
pixelforge export --output ./src/styles

# 출력 결과
src/styles/
├── _variables.scss     ← Figma 토큰 기반 Bootstrap 변수
├── tokens.json         ← Style Dictionary 포맷
└── components/
    ├── _button.scss
    ├── _input.scss
    └── _modal.scss
```

---

## 10. 개발 일정 (Phase 1 기준)

| 단계 | 내용 | 기간 |
|------|------|------|
| Day 1 | npm 패키지 기본 구조, CLI 진입점, SQLite 연결 | 1일 |
| Day 2 | Next.js GUI 세팅, 레이아웃, 사이드바 | 1일 |
| Day 3-4 | Figma API 연동, 토큰 추출 엔진 | 2일 |
| Day 5 | 토큰 가이드 페이지 (색상/타이포/간격) | 1일 |
| Day 6-8 | Bootstrap 컴포넌트 클론 + 토큰 자동 매핑 | 3일 |
| Day 9 | 컴포넌트 가이드 페이지 + 메뉴 자동 등록 | 1일 |
| Day 10 | 코드 내보내기 (export 커맨드) | 1일 |
| Day 11-12 | 히스토리 + 설정 페이지 | 2일 |
| Day 13-14 | 테스트 + npm publish | 2일 |

---

## 11. MVP 범위 (Phase 1)

### 포함
- [ ] `npx pixelforge` 실행 → 브라우저 GUI 오픈
- [ ] Figma URL → 토큰 추출 (색상/타이포/간격/반경)
- [ ] 토큰 가이드 페이지
- [ ] Bootstrap Button, Input, Modal 컴포넌트 생성
- [ ] 사이드 메뉴 자동 등록
- [ ] SCSS/TSX 코드 다운로드
- [ ] 히스토리 저장
- [ ] SQLite 로컬 DB

### 제외 (Phase 2 이후)
- 팀 공유 / 클라우드 동기화
- 버전 diff 비교
- Figma Webhook 연동 (변경 감지)
- 자동 PR 생성

---

## 12. 참고

- [figma_token_extractor.py](./figma_token_extractor.py) — 추출 엔진 프로토타입 (검증 완료)
- [next-project-guide.md](../tennis-tab/docs/next-project-guide.md) — 개발 가이드라인
- Figma REST API: https://www.figma.com/developers/api
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3
- Drizzle ORM: https://orm.drizzle.team
