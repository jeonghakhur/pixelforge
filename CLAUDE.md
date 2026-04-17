# CLAUDE.md — PixelForge (Figma Token Manager + Component Generator)

## 작업 전 필수 읽기
1. **QUALITY_RULES.md** — TypeScript 컨벤션, SCSS 규칙, 에러 처리 패턴, 커밋 메시지
2. **ARCHITECTURE.md** — 도메인 구조, 라우팅, DB 스키마, 액션 흐름
3. 수정 대상 파일의 기존 패턴 확인 (네이밍, 구조)
4. 디자인 관련: `supanova-design-skill/taste-skill/SKILL.md`, `soft-skill/SKILL.md`

## 프로젝트 요약
Figma에서 추출한 디자인 토큰을 관리하고, Bootstrap 기반 컴포넌트 코드를 생성하는 IDE 스타일 웹 앱.
```
Figma API → Token 추출 → SQLite 저장 → SCSS/TSX 코드 생성 → 화면 검수
```

## 기술 스택
| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript strict (`any` 금지) |
| Styling | SCSS Modules + Bootstrap Clone |
| DB | better-sqlite3 + Drizzle ORM |
| State | Zustand (전역 UI), react-hook-form + zod (폼) |
| Icons | @iconify/react (Solar 세트, lucide 금지) |
| Auth | iron-session + bcryptjs |
| Test | Playwright E2E |

## 코드 규칙 요약
- **색상:** CSS 변수(`var(--*)`)만 사용, `#` 하드코딩 금지
- **간격:** 8px 기반 스케일 ($spacers 맵 참조)
- **테마:** Vantablack Luxe (다크 기본, `$zinc-950` 베이스)
- **컴포넌트:** 300줄 이내, 단일 책임
- **서버 액션:** `'use server'` + zod 검증 + `{ error?: string }` 반환
- **SCSS:** 모듈 파일 (`*.module.scss`), Tailwind CDN 금지

## 금지 사항
- Inter, Noto Sans KR, Roboto 폰트
- Lucide, FontAwesome 아이콘
- `console.log`, `any` 타입
- `div onClick` (시맨틱 태그 사용)
- 보라/파란 AI 그라디언트, emoji

## 개발 명령어
```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
npm run format       # Prettier
npm run test         # Playwright E2E
```

## 작업 후 필수 검증
1. `npm run build` 성공
2. `npm run lint` 통과
3. 새 색상/간격: CSS 변수 사용 여부 확인
4. 새 UI: WCAG AA 명도대비 4.5:1 이상
5. 새 서버 액션: zod 스키마 검증 포함
6. 커밋: `<type>: <한글 설명>` (feat/fix/docs/chore/refactor)

## 문서 맵
| 문서 | 내용 |
|------|------|
| `ARCHITECTURE.md` | 도메인 구조, 라우팅, DB 스키마, 액션 흐름 |
| `QUALITY_RULES.md` | 코드 컨벤션, SCSS 규칙, 에러 패턴, 커밋 규칙 |
| `docs/conventions/code-style.md` | 파일 구조, 네이밍, 서버 액션, Drizzle 패턴 |
| `docs/conventions/design-system.md` | 토큰 사용법, WCAG AA, 컴포넌트 패턴 |
| `docs/conventions/component-generator-sandbox.md` | **생성기 필수** — Sandbox 호환 TSX 출력 규칙 (세미콜론, export type, HTML 충돌 prop) |
| `docs/conventions/component-generator-guide.md` | **생성기 필수** — 파일별 역할·수정 포인트·새 제너레이터 추가 절차·컴포넌트 목록 |
| `docs/test/playwright-guide.md` | E2E 설정, 인증 처리, 시나리오 |
| `docs/decisions/README.md` | ADR (주요 기술 결정 기록) |
| `docs/next-project-guide.md` | 전체 개발 가이드 |

## 디자인 스킬 (필수 참조)
- `supanova-design-skill/taste-skill/SKILL.md` — 디자인 엔진 기본 설정
- `supanova-design-skill/soft-skill/SKILL.md` — 프리미엄 마이크로 인터랙션
- `supanova-design-skill/output-skill/SKILL.md` — 전체 출력 규칙

## Impeccable 디자인 스킬 (UI 작업 시 필수)
UI 컴포넌트 생성 및 수정 시 `~/.claude/skills/` 경량 스킬셋을 활용한다:
- `/polish` — 출시 전 최종 품질 패스 (간격·정렬·일관성·마이크로디테일)
- `/audit` — 접근성·명도대비·인터랙션 상태 감사
- `/animate` — 마이크로 인터랙션·트랜지션 추가
- `/critique` — 디자인 비평 및 개선 방향 도출
- `/delight` — 디테일 UX 개선
- 컨텍스트 파일: `.impeccable.md` (프로젝트 루트, 자동 참조됨)

**규칙**: 새 UI 화면 또는 컴포넌트 구현 후 반드시 `/polish` 또는 `/audit` 실행.

## 관련 프로젝트
- **PixelForge Plugin**: `/Users/jeonghakhur/work/person/pixelforge-plugin`
  - 역할: Figma에서 Variables/Styles 추출 → JSON/CSS 내보내기
