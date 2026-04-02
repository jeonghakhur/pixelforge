# Design: token-menu — 토큰 메뉴 DB 자동 생성

## 1. 아키텍처 개요

```
[현재]
token-types.ts (하드코딩)
  + .pixelforge/config.json (파일 기반 오버라이드)
      ↓
getActiveTokenTypesAction()
      ↓ StoredTokenType[]
Sidebar

[변경 후]
sync / import
      ↓ runTokenPipeline()
      ↓ upsertTokenTypeConfigs()  ← 신규: 새 type만 INSERT
      ↓
token_type_configs (DB)
      ↓
getTokenMenuAction()             ← 신규: isVisible=true, ORDER BY menuOrder
      ↓ TokenTypeConfig[]
Sidebar
      ↑
Admin TokenTypeManager           ← 관리자 CRUD
```

---

## 2. DB 스키마

### 2.1 신규 테이블 — `token_type_configs`

**`src/lib/db/schema.ts`** 추가:
```ts
export const tokenTypeConfigs = sqliteTable('token_type_configs', {
  id:         text('id').primaryKey(),
  projectId:  text('project_id').notNull().references(() => projects.id),
  type:       text('type').notNull(),
  label:      text('label').notNull(),
  icon:       text('icon').notNull(),
  menuOrder:  integer('menu_order').notNull().default(0),
  isVisible:  integer('is_visible', { mode: 'boolean' }).notNull().default(true),
  createdAt:  integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt:  integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [unique().on(t.projectId, t.type)]);
```

**`src/lib/db/index.ts`** `initTables()` 추가:
```sql
CREATE TABLE IF NOT EXISTS token_type_configs (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  type        TEXT NOT NULL,
  label       TEXT NOT NULL,
  icon        TEXT NOT NULL,
  menu_order  INTEGER NOT NULL DEFAULT 0,
  is_visible  INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(project_id, type)
);
```

`migrateColumns()` 추가 (기존 DB 마이그레이션):
```ts
`CREATE TABLE IF NOT EXISTS token_type_configs (...);`  // try/catch로 감싸지 않고 initTables에서 처리
```

---

## 3. 타입 기본값 맵

**`src/lib/tokens/token-type-defaults.ts`** (신규 — token-types.ts 대체)

```ts
export interface TypeMeta {
  label: string;
  icon: string;
}

export const TYPE_DEFAULTS: Record<string, TypeMeta> = {
  color:      { label: 'Colors',     icon: 'solar:pallete-linear' },
  spacing:    { label: 'Spacing',    icon: 'solar:ruler-linear' },
  radius:     { label: 'Radius',     icon: 'solar:crop-linear' },
  typography: { label: 'Typography', icon: 'solar:text-field-linear' },
  size:       { label: 'Size',       icon: 'solar:scaling-linear' },
  resolution: { label: 'Resolution', icon: 'solar:monitor-linear' },
  float:      { label: 'Float',      icon: 'solar:calculator-linear' },
  string:     { label: 'String',     icon: 'solar:text-linear' },
  boolean:    { label: 'Boolean',    icon: 'solar:check-square-linear' },
};

const GENERIC_DEFAULT: TypeMeta = {
  label: 'Tokens',
  icon: 'solar:layers-minimalistic-linear',
};

/** 알 수 없는 type이면 generic 기본값 반환. label은 type을 capitalize */
export function getTypeDefault(type: string): TypeMeta {
  return TYPE_DEFAULTS[type] ?? {
    label: type.charAt(0).toUpperCase() + type.slice(1),
    icon: GENERIC_DEFAULT.icon,
  };
}
```

---

## 4. 파이프라인 연동

**`src/lib/tokens/pipeline.ts`** — `runTokenPipeline()` Step 5 이후에 추가:

### 4.1 upsertTokenTypeConfigs 내부 함수

```ts
async function upsertTokenTypeConfigs(
  projectId: string,
  types: string[],
): Promise<void> {
  // 이미 등록된 type 조회
  const existing = await db
    .select({ type: tokenTypeConfigs.type })
    .from(tokenTypeConfigs)
    .where(eq(tokenTypeConfigs.projectId, projectId))
    .all();
  const existingTypes = new Set(existing.map((r) => r.type));

  // 신규 type만 INSERT (기존 설정 덮어쓰지 않음)
  const newTypes = types.filter((t) => !existingTypes.has(t));
  if (newTypes.length === 0) return;

  // menuOrder: 기존 최대값 + 1씩 증가
  const maxOrder = existing.length;
  await db.insert(tokenTypeConfigs).values(
    newTypes.map((type, i) => {
      const meta = getTypeDefault(type);
      return {
        id: crypto.randomUUID(),
        projectId,
        type,
        label: meta.label,
        icon: meta.icon,
        menuOrder: maxOrder + i,
        isVisible: true,
      };
    }),
  );
}
```

### 4.2 pipeline.ts 호출 위치

Step 5 (token_sources upsert) 완료 후:
```ts
// ── Step 5-b: token_type_configs 자동 등록 ────────
const distinctTypes = [...new Set(normalizedTokens.map((t) => t.type))];
await upsertTokenTypeConfigs(projectId, distinctTypes);
```

---

## 5. Sidebar 액션 교체

### 5.1 신규 액션 — `src/lib/actions/token-menu.ts`

```ts
'use server';

import { db } from '@/lib/db';
import { tokenTypeConfigs } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getActiveProjectId } from '@/lib/actions/tokens';

export interface TokenMenuEntry {
  id: string;
  type: string;
  label: string;
  icon: string;
  menuOrder: number;
}

export async function getTokenMenuAction(): Promise<TokenMenuEntry[]> {
  const projectId = await getActiveProjectId();
  if (!projectId) return [];

  return db
    .select({
      id: tokenTypeConfigs.id,
      type: tokenTypeConfigs.type,
      label: tokenTypeConfigs.label,
      icon: tokenTypeConfigs.icon,
      menuOrder: tokenTypeConfigs.menuOrder,
    })
    .from(tokenTypeConfigs)
    .where(
      eq(tokenTypeConfigs.projectId, projectId),
      // isVisible=true 만
    )
    .orderBy(asc(tokenTypeConfigs.menuOrder))
    .all()
    .filter((r) => /* isVisible */ true);  // Drizzle where 절에서 처리
}
```

> 실제 구현: `where(and(eq(...projectId), eq(...isVisible, true)))`

### 5.2 Sidebar.tsx 변경

```ts
// Before
import { getActiveTokenTypesAction } from '@/lib/actions/token-type-config';
import type { StoredTokenType } from '@/lib/config';
const [tokenTypes, setTokenTypes] = useState<StoredTokenType[]>([]);
// ...
getActiveTokenTypesAction().then(setTokenTypes);

// After
import { getTokenMenuAction, type TokenMenuEntry } from '@/lib/actions/token-menu';
const [tokenTypes, setTokenTypes] = useState<TokenMenuEntry[]>([]);
// ...
getTokenMenuAction().then(setTokenTypes);
```

렌더링 로직 변경 — `token.id` → `token.type` (URL 경로):
```tsx
href={`/tokens/${token.type}`}
```

count 조회: `summary.counts[token.type]` (기존 `token.id` → `token.type` 키로 통일)

---

## 6. Admin TokenTypeManager

### 6.1 신규 액션 — `src/lib/actions/token-type-admin.ts`

```ts
'use server';

// 타입 메타데이터 수정 (label, icon)
export async function updateTokenTypeConfigAction(
  id: string,
  data: { label?: string; icon?: string },
): Promise<{ error: string | null }>

// 표시 여부 토글
export async function toggleTokenTypeVisibilityAction(
  id: string,
): Promise<{ error: string | null }>

// 순서 변경 (id 배열 순서대로 menuOrder 재설정)
export async function reorderTokenTypeConfigsAction(
  orderedIds: string[],
): Promise<{ error: string | null }>

// 삭제 (tokens 테이블에 해당 type 잔여 데이터 없을 때만)
export async function deleteTokenTypeConfigAction(
  id: string,
): Promise<{ error: string | null }>
```

### 6.2 컴포넌트 — `src/app/(ide)/admin/TokenTypeManager.tsx`

```
[토큰 타입 관리]

┌─────────────────────────────────────────────────────┐
│ ≡  [pallete] Colors         color    👁  ↑ ↓  🗑   │
│ ≡  [ruler]   Spacing        spacing  👁  ↑ ↓  🗑   │
│ ≡  [crop]    Radius         radius   👁  ↑ ↓  🗑   │
│ ≡  [scale]   Size           size     👁  ↑ ↓  🗑   │
│ ≡  [monitor] Resolution     res...   👁  ↑ ↓  🗑   │
└─────────────────────────────────────────────────────┘

각 행 인터랙션:
  - label 클릭 → 인라인 수정 (input, Enter로 저장)
  - icon 클릭 → Solar 아이콘명 수정
  - 👁 클릭 → isVisible 토글 (숨기면 행이 dimmed)
  - ↑↓ 클릭 → 순서 변경 (reorderTokenTypeConfigsAction)
  - 🗑 클릭 → 삭제 확인 모달 (tokens 잔여 있으면 비활성)
```

**Props / State:**
```ts
interface TokenTypeConfigRow {
  id: string;
  type: string;
  label: string;
  icon: string;
  menuOrder: number;
  isVisible: boolean;
  tokenCount: number;  // tokens 테이블 COUNT — 삭제 가능 여부 판단
}
```

`tokenCount`는 admin 전용 조회 액션에서 JOIN으로 가져옴:
```sql
SELECT ttc.*, COUNT(t.id) as token_count
FROM token_type_configs ttc
LEFT JOIN tokens t ON t.project_id = ttc.project_id AND t.type = ttc.type
WHERE ttc.project_id = ?
GROUP BY ttc.id
ORDER BY ttc.menu_order
```

### 6.3 Admin 페이지 통합

**`src/app/(ide)/admin/page.tsx`** 수정:
- 기존 `TokenTypeSettings` (Settings 페이지) 제거
- `TokenTypeManager` 컴포넌트를 Admin 페이지 내 섹션으로 추가

---

## 7. 기존 코드 정리

### 제거 대상

| 파일 | 처리 |
|------|------|
| `src/lib/actions/token-type-config.ts` | 삭제 |
| `src/app/(ide)/settings/TokenTypeSettings.tsx` | 삭제 (Admin으로 이동) |
| `src/lib/config/index.ts` `tokenTypes` 필드 | 필드 제거 (`figmaToken`은 유지) |
| `src/lib/tokens/token-types.ts` | `sectionPattern`, `TOKEN_TYPES` 배열 제거 → `token-type-defaults.ts`로 대체 |

### token-types.ts 정리 후 잔여 용도

`sectionPattern`은 `src/lib/tokens/extractor.ts`에서만 사용됨:
```ts
// extractor.ts는 Figma URL 직접 호출(4순위) 경로에서만 쓰임
// sectionPattern → extractor.ts 내부에 인라인으로 이동
```

---

## 8. 데이터 흐름 정리

```
[최초 sync]
  POST /api/sync/tokens
    ↓ parseVariablesPayload()
    ↓ runTokenPipeline(projectId, normalizedTokens)
      Step 1: tokens upsert (color 273, spacing 16, radius 6, size 10, resolution 9)
      Step 2: diff 계산
      Step 3: tokenSnapshots INSERT
      Step 4: CSS 재생성
      Step 5: token_sources upsert
      Step 5b: upsertTokenTypeConfigs()
        → INSERT color (label:Colors, icon:solar:pallete-linear, order:0)
        → INSERT spacing (label:Spacing, ..., order:1)
        → INSERT radius  (label:Radius, ..., order:2)
        → INSERT size    (label:Size, ..., order:3)
        → INSERT resolution (label:Resolution, ..., order:4)

[Sidebar 렌더링]
  useEffect → getTokenMenuAction()
    → SELECT * FROM token_type_configs WHERE projectId=? AND isVisible=1 ORDER BY menuOrder
    → [Colors, Spacing, Radius, Size, Resolution]

[관리자 설정]
  Resolution → isVisible=false
    → Sidebar: [Colors, Spacing, Radius, Size]

[두 번째 sync — 토큰 변경 없으면]
  upsertTokenTypeConfigs() → 이미 등록된 type → INSERT 없음
  → 관리자 설정 유지
```

---

## 9. 구현 순서

```
Day 1 (DB + 파이프라인)
  1. schema.ts — tokenTypeConfigs 테이블 추가
  2. db/index.ts — initTables DDL + migrateColumns 추가
  3. token-type-defaults.ts — TYPE_DEFAULTS + getTypeDefault()
  4. pipeline.ts — upsertTokenTypeConfigs() + Step 5b 호출
  5. 로컬 curl 테스트: sync 후 token_type_configs 확인

Day 2 (Sidebar 교체)
  6. token-menu.ts 액션 — getTokenMenuAction()
  7. Sidebar.tsx — getActiveTokenTypesAction → getTokenMenuAction 교체
  8. 메뉴 자동 반영 동작 확인

Day 3 (Admin + 정리)
  9. token-type-admin.ts — 4개 액션
  10. admin/TokenTypeManager.tsx — 관리 UI
  11. admin/page.tsx — TokenTypeManager 섹션 추가
  12. 기존 token-type-config.ts, TokenTypeSettings.tsx 삭제
  13. config/index.ts tokenTypes 필드 제거
  14. token-types.ts 정리
```

---

## 10. 성공 기준

- [ ] sync 후 `token_type_configs`에 `size`, `resolution` 포함 5개 타입 자동 등록
- [ ] `typography` — DB에 없으면 Sidebar 메뉴에 나타나지 않음
- [ ] 두 번째 sync 시 관리자 설정(label/icon/order/visibility) 유지
- [ ] Admin에서 label·icon·순서·표시여부 수정 → Sidebar 즉시 반영
- [ ] tokenCount > 0인 타입은 삭제 버튼 비활성
- [ ] `token-type-config.ts`, `TokenTypeSettings.tsx` 파일 삭제 완료
- [ ] TypeScript 빌드 오류 없음 (`npm run build` 통과)
