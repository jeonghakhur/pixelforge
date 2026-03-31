# PixelForge — Quality Rules

## TypeScript 코드 컨벤션

### 네이밍

| 대상 | 규칙 | 예시 |
|------|------|------|
| interface/type | PascalCase | `TokenRow`, `SessionData`, `ExtractOptions` |
| 서버 액션 함수 | camelCase, 동사 시작 | `getTokensByType()`, `createSnapshot()` |
| Zustand 스토어 | `use` + PascalCase + `Store` | `useUIStore` |
| 컴포넌트 | PascalCase | `TokenExtractModal`, `ColorGrid` |
| SCSS 모듈 | kebab-case + `.module.scss` | `page.module.scss`, `token-views.module.scss` |
| 상수 | UPPER_SNAKE_CASE | `PUBLIC_PATHS`, `SESSION_OPTIONS` |
| DB 스키마 테이블 | camelCase (JS) → snake_case (SQL) | `tokenSources` → `token_sources` |

### 서버/클라이언트 구분

```typescript
// Server Component (기본값) — page.tsx, layout.tsx
// DB 접근, fetch, 초기 렌더링

// Client Component — 별도 파일로 분리
'use client';
// 인터랙션, useState, useEffect, 이벤트 핸들러

// Server Action — src/lib/actions/*.ts
'use server';
// DB 쿼리, 파일 I/O, 외부 API
```

### 서버 액션 에러 처리 패턴

```typescript
// 표준 반환 타입
export async function createProject(data: ProjectForm): Promise<{ error?: string }> {
  const parsed = projectSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }
  // ... DB 작업
  return {};
}

// 데이터 반환 시
export async function getTokensByType(type: string): Promise<TokenRow[]> {
  return db.select({ ... }).from(tokens).where(eq(tokens.type, type)).all();
}
```

### 타입 안전성

- `any` 금지 (Figma API 타입 미지원 시만 예외, 주석 필수)
- `as` 캐스팅 최소화 — 타입 가드 우선
- zod 스키마로 런타임 검증 (클라이언트 + 서버 동일 스키마)
- Drizzle 스키마에서 타입 추론 활용

## SCSS Modules 규칙

### 네이밍

```scss
// 파일명: kebab-case.module.scss
// page.module.scss, token-views.module.scss

// 클래스명: camelCase (CSS Modules 자동 변환)
.wrapper { }
.headerTitle { }
.tokenCard { }
.tokenCardActive { }  // 상태 변형

// 컴포넌트 스타일: 페이지와 동일 디렉토리에 배치
// src/app/(ide)/tokens/[type]/page.module.scss
// src/app/(ide)/tokens/[type]/token-views.module.scss
```

### 변수 사용

```scss
// SCSS 변수 (빌드 타임): _variables.scss에서 import
@use '@/styles/variables' as *;

.card {
  border-radius: $border-radius-lg;      // SCSS 변수
  transition: $transition-spring;         // 트랜지션
  background: var(--bg-surface);          // CSS 변수 (테마)
  color: var(--text-primary);             // CSS 변수 (테마)
  border: 1px solid var(--border-color);  // CSS 변수 (테마)
}
```

### 규칙 요약

- 테마 관련(색상, 텍스트): CSS 변수 (`var(--*)`)
- 크기/간격/반경/트랜지션: SCSS 변수 (`$*`)
- `#` 하드코딩 색상 금지
- Tailwind CDN, `@apply` 사용 금지
- 글로벌 스타일은 `src/styles/components/` 디렉토리

## Drizzle ORM 쿼리 패턴

```typescript
// SELECT — 필요한 컬럼만 명시
const rows = db.select({
  id: tokens.id,
  name: tokens.name,
  value: tokens.value,
}).from(tokens).where(eq(tokens.type, type)).all();

// INSERT — crypto.randomUUID()로 ID 생성
db.insert(tokens).values({
  id: crypto.randomUUID(),
  projectId,
  type: 'color',
  name: tokenName,
  value: tokenValue,
}).run();

// UPDATE
db.update(tokens)
  .set({ value: newValue })
  .where(eq(tokens.id, tokenId))
  .run();

// DELETE
db.delete(tokens).where(eq(tokens.projectId, projectId)).run();

// 트랜잭션은 미사용 (SQLite 단일 연결, WAL 모드)
```

## 컴포넌트 규칙

- 300줄 이내, 단일 책임
- Props에 TypeScript interface 명시
- 접근성 내장: ARIA 속성, 시맨틱 태그
- `className` prop으로 외부 스타일 확장
- 공통 컴포넌트: `src/components/common/`
- 레이아웃 컴포넌트: `src/components/layout/`

## 접근성 (WCAG AA)

- 명도대비: 일반 텍스트 4.5:1, 큰 텍스트 3:1, UI 컴포넌트 3:1
- 포커스: `:focus-visible` 가시적 링 (2px solid var(--border-focus))
- 모달: 포커스 트랩, ESC 닫기, body 스크롤 차단
- 폼: `label htmlFor`, `aria-invalid`, `aria-describedby`
- 시맨틱: `button`(클릭), `a`(이동), `div onClick` 금지

## 커밋 메시지 규칙

```
<type>: <한글 설명>

type: feat | fix | docs | chore | refactor | test | style
```

**예시:**
```
feat: 토큰 버전 비교 diff 뷰어 추가
fix: 색상 토큰 추출 시 alias 누락 수정
docs: ARCHITECTURE.md 서버 액션 목록 업데이트
refactor: 토큰 추출 엔진 타입별 모듈 분리
chore: ESLint + Prettier 설정 추가
```

## Claude Code 작업 규칙

### 작업 중 금지
1. CSS 변수 외 색상값 하드코딩 금지
2. `any` 타입 사용 금지
3. `console.log` 금지
4. `div onClick` 금지 (시맨틱 태그 사용)
5. Inter, Noto Sans KR, Roboto 폰트 사용 금지
6. Lucide, FontAwesome 아이콘 사용 금지

### 작업 후 필수
1. `npm run build` 성공 확인
2. `npm run lint` 통과 확인
3. 색상/간격 하드코딩 검수
4. 새 UI: WCAG AA 명도대비 확인
5. 새 서버 액션: zod 스키마 검증 포함 확인
