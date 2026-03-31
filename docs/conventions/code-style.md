# Code Style — PixelForge

## 파일/폴더 구조

```
src/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # 인증 라우트 그룹
│   │   └── login/
│   │       ├── page.tsx              # Server Component (데이터 fetch)
│   │       └── page.module.scss      # 페이지 스타일
│   ├── (ide)/                        # IDE 라우트 그룹
│   │   └── tokens/[type]/
│   │       ├── page.tsx              # Server Component
│   │       ├── page.module.scss      # 페이지 스타일
│   │       ├── ColorGrid.tsx         # Client Component (인터랙션)
│   │       ├── TokenExtractModal.tsx  # Client Component (모달)
│   │       └── token-views.module.scss # 공유 스타일
│   └── viewer/                       # 퍼블릭 뷰어
├── components/
│   ├── common/                       # 공통 UI (Modal, Toast, Badge 등)
│   └── layout/                       # IDE 레이아웃 (ActivityBar, Sidebar 등)
├── lib/
│   ├── actions/                      # Server Actions (도메인별 분리)
│   ├── auth/                         # 인증 (session, schema)
│   ├── db/                           # DB (schema, index, queries)
│   ├── tokens/                       # 토큰 추출/변환 엔진
│   ├── generators/                   # 코드 생성기
│   └── figma/                        # Figma API 클라이언트
├── stores/                           # Zustand 스토어
└── styles/                           # 글로벌 SCSS
    ├── _variables.scss               # 디자인 토큰
    ├── globals.scss                  # CSS 변수 + 테마
    └── components/                   # 글로벌 컴포넌트 SCSS
```

### 파일 배치 규칙

| 파일 종류 | 위치 | 네이밍 |
|----------|------|--------|
| 페이지 | `app/(그룹)/경로/page.tsx` | `page.tsx` (고정) |
| 레이아웃 | `app/(그룹)/layout.tsx` | `layout.tsx` (고정) |
| 페이지 컴포넌트 | 페이지와 같은 디렉토리 | `PascalCase.tsx` |
| 공통 컴포넌트 | `components/common/` | `PascalCase.tsx` |
| 레이아웃 컴포넌트 | `components/layout/` | `PascalCase.tsx` |
| Server Action | `lib/actions/` | `kebab-case.ts` |
| DB 스키마 | `lib/db/schema.ts` | 단일 파일 |
| Zustand 스토어 | `stores/` | `use*.ts` |
| SCSS 모듈 | 컴포넌트 옆 | `kebab-case.module.scss` |

## 컴포넌트 네이밍

```typescript
// Server Component (page.tsx) — 기본값, 'use client' 불필요
export default async function TokensPage({ params }: Props) {
  const tokens = await getTokensByType(params.type);
  return <ColorGrid tokens={tokens} />;
}

// Client Component — 별도 파일, 'use client' 선언
'use client';
export function ColorGrid({ tokens }: { tokens: TokenRow[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  // ...
}

// 모달 컴포넌트 — *Modal 접미사
'use client';
export function TokenExtractModal({ isOpen, onClose }: ModalProps) { ... }

// 공통 컴포넌트 — Props interface 명시
interface BadgeProps {
  variant: 'success' | 'danger' | 'warning' | 'info';
  children: ReactNode;
  className?: string;
}
export function Badge({ variant, children, className }: BadgeProps) { ... }
```

## 서버 액션 패턴

```typescript
// src/lib/actions/tokens.ts
'use server';

import { db } from '@/lib/db';
import { tokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// 1. 반환 타입 명시
export interface TokenRow {
  id: string;
  name: string;
  type: string;
  value: string;
}

// 2. 데이터 조회 — 필요한 컬럼만 select
export async function getTokensByType(type: string): Promise<TokenRow[]> {
  return db.select({
    id: tokens.id,
    name: tokens.name,
    type: tokens.type,
    value: tokens.value,
  }).from(tokens).where(eq(tokens.type, type)).all();
}

// 3. 데이터 변경 — zod 검증 + error 반환
export async function createProject(data: ProjectForm): Promise<{ error?: string }> {
  const parsed = projectSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  db.insert(projects).values({
    id: crypto.randomUUID(),
    name: parsed.data.name,
  }).run();

  return {};
}
```

### 서버 액션 규칙
- 파일 상단에 `'use server'` 선언
- zod 스키마로 입력 검증 (클라이언트와 동일 스키마 재사용)
- 에러는 `{ error?: string }` 형태로 반환 (throw 금지)
- ID 생성: `crypto.randomUUID()`
- 날짜: `$defaultFn(() => new Date())` (스키마에서 처리)

## SCSS Modules 작성 규칙

```scss
// page.module.scss
@use '@/styles/variables' as *;

// 클래스명: camelCase
.wrapper {
  padding: map-get($spacers, 4);  // 24px (SCSS 변수)
  background: var(--bg-body);      // CSS 변수 (테마)
}

// 상태 변형: 별도 클래스
.card {
  border: 1px solid var(--border-color);
  border-radius: $border-radius-lg;
  transition: $transition-spring;
}

.cardActive {
  border-color: var(--accent);
  background: var(--accent-subtle);
}

// 반응형: 믹스인 사용
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: map-get($spacers, 3);

  @include media-up(md) {
    grid-template-columns: repeat(2, 1fr);
  }

  @include media-up(lg) {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### 사용 규칙

| 대상 | 방법 |
|------|------|
| 테마 색상 | CSS 변수: `var(--bg-surface)`, `var(--text-primary)` |
| 고정 크기 | SCSS 변수: `$border-radius-lg`, `$font-size-sm` |
| 간격 | SCSS 맵: `map-get($spacers, 3)` → 16px |
| 트랜지션 | SCSS 변수: `$transition-spring` |
| 브레이크포인트 | 믹스인: `@include media-up(md)` |

## Drizzle ORM 패턴

```typescript
// 스키마 정의 — snake_case SQL ↔ camelCase JS
export const tokens = sqliteTable('tokens', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  type: text('type').notNull(),
  name: text('name').notNull(),
  value: text('value').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// enum 컬럼
source: text('source', {
  enum: ['variables', 'styles-api', 'section-scan', 'node-scan']
}).default('node-scan'),

// boolean 컬럼
isVisible: integer('is_visible', { mode: 'boolean' }).notNull().default(true),

// JSON 컬럼 — text로 저장, 직렬화/역직렬화는 액션에서 처리
tokensData: text('tokens_data').notNull(),  // JSON.stringify/parse

// UNIQUE 복합 제약
}, (t) => [unique().on(t.projectId, t.type)]);
```

## import 순서

```typescript
// 1. React/Next.js
import { useState, useEffect } from 'react';
import { redirect } from 'next/navigation';

// 2. 외부 라이브러리
import { eq, desc } from 'drizzle-orm';
import { useForm } from 'react-hook-form';

// 3. 내부 모듈 (@/ 경로)
import { db } from '@/lib/db';
import { tokens } from '@/lib/db/schema';
import { useUIStore } from '@/stores/useUIStore';

// 4. 타입 (type import)
import type { TokenRow } from '@/lib/actions/tokens';

// 5. 스타일
import styles from './page.module.scss';
```
