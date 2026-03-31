# ARCHITECTURE.md — PixelForge

## 전체 구조

```
pixelforge/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # 루트 레이아웃 (테마, 폰트, 프로바이더)
│   │   ├── (auth)/                   # 인증 라우트 그룹
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (ide)/                    # IDE 라우트 그룹 (인증 필수)
│   │   │   ├── layout.tsx            # ActivityBar + Sidebar + TabBar
│   │   │   ├── page.tsx              # 대시보드
│   │   │   ├── tokens/[type]/        # 토큰 뷰어 (color/typography/spacing/radius)
│   │   │   ├── components/new/       # 컴포넌트 생성
│   │   │   ├── components/[name]/    # 컴포넌트 가이드
│   │   │   ├── screens/             # 화면 검수 목록
│   │   │   ├── screens/view/        # 화면 상세 + Figma 비교
│   │   │   ├── diff/                # 토큰 버전 비교
│   │   │   ├── settings/            # 설정
│   │   │   ├── admin/               # 관리자
│   │   │   └── pages/               # 데모 페이지 (home, login, profile 등)
│   │   └── viewer/                   # 뷰어 모드 (퍼블릭)
│   ├── components/
│   │   ├── common/                   # 공통 UI (Modal, Toast, Badge, Card 등)
│   │   ├── layout/                   # IDE 레이아웃 (ActivityBar, Sidebar, TabBar)
│   │   └── providers/                # React 프로바이더
│   ├── lib/
│   │   ├── actions/                  # Server Actions (10개 모듈)
│   │   ├── auth/                     # iron-session, zod 스키마
│   │   ├── db/                       # Drizzle ORM 스키마 + 초기화
│   │   ├── figma/                    # Figma REST API 클라이언트
│   │   ├── tokens/                   # 토큰 추출/변환/스냅샷 엔진
│   │   ├── generators/react/         # Bootstrap 컴포넌트 코드 생성기
│   │   ├── screens/                  # 화면 파일 스캐너 + Playwright 생성
│   │   ├── git/                      # 토큰 커밋 이력 관리
│   │   └── config/                   # 앱 설정
│   ├── stores/                       # Zustand 스토어
│   │   └── useUIStore.ts             # 테마, 섹션, 탭, drift 상태
│   └── styles/
│       ├── _variables.scss           # 디자인 토큰 (Vantablack Luxe)
│       ├── _accessibility.scss       # WCAG AA 포커스/sr-only
│       ├── _mixins.scss              # 반응형 믹스인
│       ├── globals.scss              # 엔트리 (CSS 변수 + 테마)
│       ├── components/               # 글로벌 컴포넌트 SCSS (16개)
│       └── bootstrap/                # Bootstrap SCSS 클론 (50+)
├── scripts/                          # Figma 추출 CLI 스크립트
├── tests/                            # Playwright E2E
├── data/                             # 추출된 토큰 JSON 캐시
└── .pixelforge/                      # 로컬 DB + 설정 (gitignore)
```

## 라우팅 구조

### 라우트 그룹

| 그룹 | 경로 | 인증 | 설명 |
|------|------|------|------|
| `(auth)` | `/login`, `/register` | 불필요 (로그인 시 `/`로 리다이렉트) | 세션 기반 인증 |
| `(ide)` | `/`, `/tokens/*`, `/components/*`, `/screens/*`, `/diff`, `/settings`, `/admin` | 필수 (미인증 시 `/login`으로 리다이렉트) | IDE 메인 |
| `viewer` | `/viewer` | 불필요 | 외부 공유용 읽기 전용 |

### IDE 레이아웃 구조

```
┌──────────────────────────────────────────────┐
│  TabBar (35px) — 열린 탭 목록                  │
├────┬─────────────────────────────────────────┤
│ A  │                                         │
│ c  │  Sidebar    │    Main Content            │
│ t  │  (토큰 목록, │    (페이지 컴포넌트)         │
│ i  │   메뉴 등)   │                            │
│ v  │             │                            │
│ i  │             │                            │
│ t  │             │                            │
│ y  │             │                            │
│    │             │                            │
│ B  │             │                            │
│ a  │             │                            │
│ r  │             │                            │
├────┴─────────────┴───────────────────────────┤
│  StatusBar (24px) — 프로젝트 정보, drift 상태   │
└──────────────────────────────────────────────┘
```

## DB 스키마 관계

```
users ──────────────────────────────────────
  id, email, passwordHash, role(admin|member)

projects ─┬── tokens (1:N)
  id       │     id, projectId, type, name, value, source, mode
  name     │
  figmaUrl ├── components (1:N)
  figmaKey │     id, projectId, name, category, scss, tsx
           │
           ├── tokenSources (1:N, UNIQUE projectId+type)
           │     id, projectId, type, figmaUrl, contentHash
           │
           ├── tokenSnapshots (1:N)
           │     id, projectId, version, tokensData(JSON), diffSummary(JSON)
           │
           └── histories (1:N)
                 id, projectId, action, summary

screens (독립)
  id, route(UNIQUE), filePath, name, status(wip→dev-done→qa-ready→qa-done)
  figmaUrl, figmaScreenshot, implScreenshot
  playwrightStatus, playwrightScore, playwrightReport(JSON)
```

### 토큰 타입

| type | 설명 | 추출 소스 |
|------|------|----------|
| `color` | 색상 토큰 | Variables API, Styles API |
| `typography` | 폰트 정보 | Text Styles API |
| `spacing` | 간격 값 | Variables API (spacing 패턴) |
| `radius` | 둥근 모서리 | Variables API (radius 패턴) |

## 주요 액션 흐름

### 1. Figma 토큰 추출 → DB 저장

```
사용자: Figma URL 입력 + 추출 버튼
  │
  ▼
scanAndExtractTokens() [project.ts]
  ├── FigmaClient.getFileVariables()     # Figma Variables API 호출
  ├── extractTokensAction()              # 타입별 파서 실행
  │   ├── extractColors()
  │   ├── extractTypography()
  │   ├── extractSpacing()
  │   └── extractRadius()
  ├── upsertTokens()                     # DB INSERT/UPDATE
  ├── createSnapshot()                   # 버전 스냅샷 생성 + diff
  └── createHistory()                    # 이력 기록
```

### 2. 컴포넌트 코드 생성

```
사용자: 컴포넌트 타입 선택 + 생성
  │
  ▼
generateComponent() [components.ts]
  ├── 토큰 조회 (color, typography, spacing)
  ├── 템플릿 선택 (button, modal, badge 등 15종)
  ├── SCSS 생성 (토큰 기반 CSS 변수)
  ├── TSX 생성 (React 컴포넌트)
  └── DB 저장 (components 테이블)
```

### 3. 화면 검수

```
scanScreensFromProject() [screens.ts]
  ├── 프로젝트 파일에서 @page 주석 파싱
  ├── screens 테이블 UPSERT
  └── Git 히스토리 매핑

updateScreenScreenshots() [screens.ts]
  ├── Figma 스크린샷 캡처
  ├── 구현 스크린샷 캡처 (Playwright)
  └── 비교 뷰 제공
```

## 서버 액션 모듈

| 모듈 | 파일 | 핵심 함수 |
|------|------|----------|
| 인증 | `actions/auth.ts` | `register`, `login`, `logout`, `addUser` |
| 프로젝트 | `actions/project.ts` | `createProject`, `scanAndExtractTokens` |
| 토큰 | `actions/tokens.ts` | `getTokensByType`, `exportTokensAsCSS` |
| 스냅샷 | `actions/snapshots.ts` | `createSnapshot`, `compareSnapshots`, `revertToSnapshot` |
| 컴포넌트 | `actions/components.ts` | `generateComponent`, `listComponents` |
| 화면 | `actions/screens.ts` | `scanScreensFromProject`, `updateScreenStatus` |
| 설정 | `actions/settings.ts` | `updateSettings`, `getSettings` |
| 프리뷰 | `actions/preview.ts` | `generatePreviewCSS` |
| 토큰이력 | `actions/token-history.ts` | `getTokenCommitHistory`, `createTokenCommit` |
| 토큰타입 | `actions/token-type-config.ts` | 토큰 타입 설정 CRUD |

## 서버/클라이언트 경계

| 계층 | 위치 | 역할 |
|------|------|------|
| Server Component | `page.tsx`, `layout.tsx` | 데이터 fetch, 초기 렌더링 |
| Client Component | `'use client'` 선언 파일 | 인터랙션, 상태 관리 |
| Server Action | `'use server'` 선언 파일 | DB 접근, Figma API, 파일 I/O |
| Middleware | `middleware.ts` | 인증 체크, 리다이렉트 |

### 규칙
- `page.tsx`는 Server Component (기본값) — 데이터를 fetch하여 Client 컴포넌트에 props 전달
- 인터랙티브 컴포넌트는 별도 파일로 분리 후 `'use client'` 선언
- Server Action은 `src/lib/actions/` 디렉토리에 집중 관리
- DB 직접 접근은 Server Action/Server Component에서만 허용
