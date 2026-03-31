# Architecture Decision Records (ADR)

이 문서는 PixelForge 앱 개발 과정에서 내린 주요 기술 결정을 기록한다.

## 형식

```markdown
## ADR-NNN: 제목

- 상태: 채택 / 폐기 / 대체
- 일자: YYYY-MM-DD
- 맥락: 왜 결정이 필요했는가
- 결정: 무엇을 선택했는가
- 결과: 어떤 영향이 있었는가
```

---

## ADR-001: SQLite + better-sqlite3 선택

- **상태:** 채택
- **일자:** 2025-03
- **맥락:** PixelForge는 로컬 환경에서 동작하는 IDE 스타일 도구다. PostgreSQL이나 MySQL 같은 외부 DB 서버를 요구하면 설치 장벽이 높아진다. 동시 접속은 1~2명(관리자)으로 제한적이며, 토큰 데이터는 프로젝트당 수백~수천 행 수준이다.
- **결정:** SQLite(better-sqlite3) + Drizzle ORM을 선택했다. DB 파일은 `.pixelforge/db.sqlite`에 저장하며, WAL 모드를 활성화하여 읽기 성능을 확보한다.
- **결과:** 별도 DB 서버 설치 불필요. `npm run dev`만으로 전체 스택 실행. 데이터 백업은 파일 복사로 해결. Drizzle ORM으로 타입 안전한 쿼리 작성 가능.

---

## ADR-002: SCSS Modules + Bootstrap Clone 전략

- **상태:** 채택
- **일자:** 2025-03
- **맥락:** tennis-tab 프로젝트에서 Tailwind + shadcn/ui를 사용했으나, 컴포넌트 커스터마이징이 제한적이었다. PixelForge는 IDE 스타일의 정밀한 레이아웃이 필요하고, Figma 토큰에서 생성하는 CSS와의 일관성이 중요했다.
- **결정:** Bootstrap SCSS를 클론하여 프로젝트에 맞게 커스터마이징한다. Tailwind CDN은 사용하지 않는다. 페이지별 스타일은 CSS Modules(`.module.scss`)로 스코핑하고, 공통 컴포넌트 스타일은 `src/styles/components/`에서 글로벌로 관리한다.
- **결과:** 토큰 기반 스타일 시스템과 완전한 일관성 확보. 번들에 불필요한 유틸리티 클래스 없음. SCSS 변수로 디자인 토큰을 빌드 타임에 적용하고, CSS 변수로 런타임 테마를 전환한다.

---

## ADR-003: Vantablack Luxe 다크 테마 기본

- **상태:** 채택
- **일자:** 2025-03
- **맥락:** PixelForge는 디자인 토큰 관리 도구로, 사용자가 색상 토큰을 주로 다루게 된다. 밝은 배경에서는 색상 스와치의 가시성이 떨어지고, IDE 스타일 UI에는 다크 테마가 집중력을 높인다. Figma 에디터 자체도 다크 UI를 기본으로 사용한다.
- **결정:** `$zinc-950` (#09090b) 베이스의 Vantablack Luxe 테마를 기본으로 채택했다. 3단계 배경 계층(`zinc-950` → `zinc-900` → `zinc-800`)으로 깊이감을 표현하고, 액센트는 `$blue-500` 단일 포인트로 절제한다. 라이트 테마도 지원하되, 다크가 기본이다.
- **결과:** 색상 토큰 프리뷰가 명확하게 보임. IDE 느낌의 전문적인 UI. 모든 색상을 SCSS 변수 + CSS 변수로 이중 관리하여 테마 전환이 가능.

---

## ADR-004: iron-session 기반 세션 인증

- **상태:** 채택
- **일자:** 2025-03
- **맥락:** 인증이 필요한 보호된 관리 도구이지만, OAuth나 JWT 기반 외부 인증 서비스를 도입하면 설정이 복잡해진다. 사용자 수는 소수(admin + 소수 member)이며, DB에 직접 저장된 비밀번호 해시로 충분하다.
- **결정:** iron-session으로 서버사이드 암호화 쿠키 세션을 구현한다. bcryptjs로 비밀번호 해싱. Next.js middleware에서 인증 체크하여 `/login`, `/register`, `/viewer` 외 모든 라우트를 보호한다.
- **결과:** 외부 의존성 최소화. 별도 토큰 관리 불필요. middleware 한 곳에서 인증 로직 집중 관리. 최초 사용자는 `/register`에서 admin 계정 생성.

---

## ADR-005: Zustand 단일 스토어 (useUIStore)

- **상태:** 채택
- **일자:** 2025-03
- **맥락:** tennis-tab에서 useState/useContext로 전역 상태를 관리했으나, prop drilling과 불필요한 리렌더링이 문제였다. PixelForge는 테마, 활성 섹션, 탭 상태, drift 감지 등 여러 전역 UI 상태가 필요하다.
- **결정:** Zustand의 `useUIStore` 단일 스토어에 모든 UI 상태를 집중한다. 서버 데이터는 Server Component/Server Action에서 직접 fetch하고, 폼 상태는 react-hook-form에 위임한다.
- **결과:** 전역 상태 관리가 한 곳에서 투명하게 이루어짐. 셀렉터 패턴(`useUIStore((s) => s.theme)`)으로 필요한 값만 구독하여 리렌더링 최소화. `invalidateTokens()`로 캐시 무효화를 수동 트리거.

---

## ADR-006: 토큰 스냅샷 버전 관리

- **상태:** 채택
- **일자:** 2025-03
- **맥락:** Figma에서 토큰을 반복 추출하면 이전 데이터가 덮어쓰기된다. 디자이너가 Figma에서 토큰을 변경했을 때, "무엇이 변경되었는가"를 추적할 방법이 없었다.
- **결정:** `tokenSnapshots` 테이블에 추출 시마다 전체 토큰 데이터를 JSON으로 스냅샷한다. 자동 증가 `version` 번호를 부여하고, 이전 스냅샷과의 diff를 `diffSummary`에 저장한다. `/diff` 페이지에서 두 버전을 비교할 수 있다.
- **결과:** 토큰 변경 이력 완전 추적. 문제 발생 시 이전 버전으로 `revertToSnapshot()` 가능. diff 뷰어로 added/removed/changed 토큰을 시각적으로 확인.

---

## ADR-007: @page 주석 기반 화면 자동 등록

- **상태:** 채택
- **일자:** 2025-03
- **맥락:** 화면 검수(QA) 기능을 위해 프로젝트의 모든 페이지를 등록해야 했다. 수동 등록은 유지보수가 어렵고, 페이지 추가/삭제 시 동기화가 깨진다.
- **결정:** 소스 코드의 `page.tsx` 파일에 `@page` 주석을 파싱하여 화면을 자동 등록한다. Git 히스토리에서 작성자와 변경 이력도 추출한다. `scanScreensFromProject()`로 프로젝트 파일을 스캔하여 `screens` 테이블에 UPSERT한다.
- **결과:** 코드가 곧 문서. 페이지 추가 시 `@page` 주석만 작성하면 자동으로 검수 대상에 등록. Figma 스크린샷과 구현 스크린샷 비교로 디자인 드리프트를 시각적으로 검출.
