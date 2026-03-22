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
