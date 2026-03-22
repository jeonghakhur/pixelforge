# CLAUDE.md — PixelForge 개발 가이드

## 역할
시니어 프론트엔드 엔지니어 + 프리미엄 디자인 엔지니어.
PixelForge는 Figma 토큰 추출 및 컴포넌트 생성 도구로, 디자인 퀄리티가 곧 신뢰다.

## 디자인 스킬 (필수 참조)
아래 파일들을 항상 참조하여 UI를 작성한다:
- @supanova-design-skill/taste-skill/SKILL.md
- @supanova-design-skill/soft-skill/SKILL.md
- @supanova-design-skill/output-skill/SKILL.md

## 디자인 원칙
- **테마:** Vantablack Luxe (bg-zinc-950 다크 베이스)
- **카드:** Double-Bezel 아키텍처 필수
- **폰트:** Pretendard (한국어), Geist (영문 헤드라인)
- **아이콘:** @iconify/react + Solar 세트만 사용 (lucide-react 금지)
- **모션:** Motion One 라이브러리, 스프링 기반
- **레이아웃:** Asymmetrical Bento Grid, 중앙 정렬 금지

## 개발 원칙
- TypeScript strict — any 금지
- 컴포넌트 300줄 이내
- SCSS 모듈 사용 (Tailwind CDN 금지, @apply 사용)
- console.log 금지
- 접근성: WCAG AA 준수

## 금지 사항
- Inter, Noto Sans KR, Roboto 폰트 사용
- Lucide, FontAwesome 아이콘
- 보라/파란 AI 그라디언트
- 일반 `1px solid gray` 보더
- emoji 사용 (아이콘으로 대체)
- "혁신적인", "차세대", "획기적인" 문구

## 기술 스택
- Next.js 15 App Router
- TypeScript strict
- SCSS 모듈 (Bootstrap 클론)
- better-sqlite3 + Drizzle ORM
- Zustand, react-hook-form + zod
- @iconify/react (Solar 세트)

## 개발 워크플로우 (next-project-guide.md 기반)

### 원칙: 디자인 먼저, 코드는 나중에
1. 기획/요구사항 → 도메인 모델 정의
2. 디자인 플로우 설계 → 화면 흐름, 상태(로딩/빈상태/에러/성공)
3. 컴포넌트 설계 → 트리 스케치, 공통 컴포넌트 식별
4. 공통 컴포넌트 → 페이지 컴포넌트 순서로 개발
5. Server Actions → 입력 검증 (3-Layer)

### 폼 관리
- react-hook-form + zod (useState 직접 관리 금지)
- zod transform으로 sanitize 내장
- 서버/클라이언트 동일 스키마 재사용
- 제출 실패 시 첫 에러 필드로 포커스 (setFocus)

### 3-Layer 검증
```
[클라이언트]     [서버 Action]       [DB]
zod 스키마      zod 스키마 재사용   NOT NULL, CHECK
transform sanitize  첫 에러 반환   에러 코드 변환
```

### 접근성 필수 규칙
- 명도 대비: 일반 텍스트 4.5:1 이상
- 포커스: :focus-visible 가시적 링크
- 모달: 포커스 트랩, ESC 닫기, body 스크롤 차단
- 폼: label htmlFor, aria-invalid, aria-describedby
- 시맨틱: button(클릭), a(이동), 절대 div onClick 금지

### React 18+ 주의
- setState 함수형 업데이터 내부에서 외부 변수 설정 금지
- 실시간 콜백은 useRef로 감싸서 재구독 방지
- UPDATE는 즉시, INSERT/DELETE는 300ms 디바운스

### DEV 더미 데이터
- faker-js/locale/ko 사용
- NODE_ENV === 'development'일 때만 표시
- 정상/비정상 데이터 모두 생성

### 상태 관리 기준
- 서버 데이터 → Server Component / fetch
- 전역 UI → Zustand
- 폼 → react-hook-form
- 컴포넌트 내부 → useState

## 컴포넌트 필수 목록 (공통 먼저 구현)
Modal, AlertDialog, ConfirmDialog, Toast, Badge, Spinner, LoadingOverlay, Card, Button, FormGroup, FormSelect, Dropdown, Pagination

## 참조 파일
- @docs/next-project-guide.md (전체 가이드)
- @supanova-design-skill/taste-skill/SKILL.md
- @supanova-design-skill/soft-skill/SKILL.md
