# Design: variables-api

> Plan 참조: `docs/01-plan/features/variables-api.plan.md`

---

## 1. 아키텍처 개요

### 1.1 현재 vs 변경 후

```
[ 현재 ]
extractTokensAction
  └─ FigmaClient.getFile()
       └─ extractor.ts (노드 트리 순회)
            └─ DB 저장

[ 변경 후 ]
extractTokensAction
  ├─ FigmaClient.getVariables()   ← 신규
  │    ├─ 성공 + 데이터 있음 → variables-extractor.ts  ← 신규
  │    └─ 실패 / 빈 결과   → (폴백)
  └─ FigmaClient.getFile()
       └─ extractor.ts (기존 유지, 폴백용)
            └─ DB 저장 (source 컬럼 추가)
```

### 1.2 영향 범위

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/lib/figma/api.ts` | 수정 | `getVariables()` 메서드 + 응답 타입 추가 |
| `src/lib/tokens/variables-extractor.ts` | 신규 | Variables → TokenRow 변환 로직 |
| `src/lib/db/schema.ts` | 수정 | `tokens` 테이블 컬럼 3개 추가 |
| `src/lib/db/migrate.ts` | 신규 | ALTER TABLE 마이그레이션 |
| `src/lib/actions/project.ts` | 수정 | Variables 우선 추출 + 폴백 로직 |
| `src/app/(ide)/tokens/[type]/ColorGrid.tsx` | 수정 | mode 배지 표시 |
| `src/app/(ide)/tokens/[type]/page.tsx` | 수정 | source 표시 배너 |

---

## 2. API 레이어 (`src/lib/figma/api.ts`)

### 2.1 추가 타입

```typescript
// Variables API 응답 타입
export interface FigmaVariableValue {
  r?: number; g?: number; b?: number; a?: number;  // COLOR
  type?: 'VARIABLE_ALIAS';
  id?: string;  // alias인 경우 참조 variable ID
}

export interface FigmaVariable {
  id: string;
  name: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  valuesByMode: Record<string, FigmaVariableValue | number | string | boolean>;
  scopes: string[];
  hiddenFromPublishing: boolean;
}

export interface FigmaVariableCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  defaultModeId: string;
  variableIds: string[];
}

export interface FigmaVariablesResponse {
  meta: {
    variableCollections: Record<string, FigmaVariableCollection>;
    variables: Record<string, FigmaVariable>;
  };
}
```

### 2.2 `FigmaClient.getVariables()` 메서드

```typescript
/**
 * 파일의 로컬 Variables 조회
 * - 커뮤니티 파일(읽기 전용)은 403 반환 → 빈 결과 반환
 * - Variables 없는 파일은 빈 meta 반환
 */
async getVariables(fileKey: string): Promise<FigmaVariablesResponse | null> {
  try {
    return await this.request<FigmaVariablesResponse>(
      `/files/${fileKey}/variables/local`
    );
  } catch (err) {
    // 403(권한 없음), 404(Variables 없음) → null 반환으로 폴백 신호
    if (err instanceof Error && /40[34]/.test(err.message)) {
      return null;
    }
    throw err;
  }
}
```

---

## 3. Variables Extractor (`src/lib/tokens/variables-extractor.ts`)

### 3.1 출력 타입

기존 `extractor.ts`의 토큰 타입을 확장:

```typescript
import type { ColorToken, TypographyToken, SpacingToken, RadiusToken } from './extractor';

export interface VariableTokenMeta {
  source: 'variables';
  mode: string;           // "Light" | "Dark" | "Default" 등
  collectionName: string; // "Primitives" | "Semantic" 등
  alias: string | null;   // alias인 경우 참조 variable ID, 아니면 null
}

export type ColorTokenV = ColorToken & VariableTokenMeta;
export type SpacingTokenV = SpacingToken & VariableTokenMeta;
export type RadiusTokenV = RadiusToken & VariableTokenMeta;
export type TypographyTokenV = TypographyToken & VariableTokenMeta;

export interface ExtractedVariableTokens {
  colors: ColorTokenV[];
  spacing: SpacingTokenV[];
  radius: RadiusTokenV[];
  typography: TypographyTokenV[];
  hasData: boolean;
}
```

### 3.2 FLOAT 타입 추론 로직

Variable 이름 패턴으로 tokenType 판별:

```typescript
function inferFloatTokenType(
  name: string,
  scopes: string[]
): 'spacing' | 'radius' | 'typography' | null {
  const lower = name.toLowerCase();

  // Figma scopes 우선 (명시적)
  if (scopes.includes('GAP') || scopes.includes('WIDTH_HEIGHT')) return 'spacing';
  if (scopes.includes('CORNER_RADIUS')) return 'radius';
  if (scopes.includes('FONT_SIZE') || scopes.includes('LINE_HEIGHT')) return 'typography';

  // 이름 패턴 폴백
  if (/spacing|gap|padding|margin/.test(lower)) return 'spacing';
  if (/radius|corner|rounded/.test(lower)) return 'radius';
  if (/font|size|line.height|letter/.test(lower)) return 'typography';

  return null; // 분류 불가 → 무시
}
```

### 3.3 메인 추출 함수

```typescript
export function extractFromVariables(
  response: FigmaVariablesResponse
): ExtractedVariableTokens {
  const { variableCollections, variables } = response.meta;

  const colors: ColorTokenV[] = [];
  const spacing: SpacingTokenV[] = [];
  const radius: RadiusTokenV[] = [];
  const typography: TypographyTokenV[] = [];

  for (const collection of Object.values(variableCollections)) {
    for (const varId of collection.variableIds) {
      const variable = variables[varId];
      if (!variable || variable.hiddenFromPublishing) continue;

      for (const mode of collection.modes) {
        const rawValue = variable.valuesByMode[mode.modeId];
        if (rawValue === undefined) continue;

        const meta: VariableTokenMeta = {
          source: 'variables',
          mode: mode.name,
          collectionName: collection.name,
          alias: null,
        };

        // VARIABLE_ALIAS 처리
        if (
          typeof rawValue === 'object' &&
          rawValue !== null &&
          (rawValue as FigmaVariableValue).type === 'VARIABLE_ALIAS'
        ) {
          meta.alias = (rawValue as FigmaVariableValue).id ?? null;
          // alias는 실제 값이 아니므로 color 계산 스킵 (이름만 저장)
        }

        if (variable.resolvedType === 'COLOR') {
          const v = rawValue as FigmaVariableValue;
          if (v.r !== undefined) {
            const toHex = (n: number) =>
              Math.round(n * 255).toString(16).padStart(2, '0');
            colors.push({
              name: variable.name,
              hex: `#${toHex(v.r!)}${toHex(v.g!)}${toHex(v.b!)}`,
              rgba: {
                r: Math.round(v.r! * 255),
                g: Math.round(v.g! * 255),
                b: Math.round(v.b! * 255),
                a: v.a ?? 1,
              },
              ...meta,
            });
          }
        } else if (variable.resolvedType === 'FLOAT') {
          const val = rawValue as number;
          const tokenType = inferFloatTokenType(variable.name, variable.scopes);

          if (tokenType === 'spacing') {
            spacing.push({ name: variable.name, gap: val, ...meta });
          } else if (tokenType === 'radius') {
            radius.push({ name: variable.name, value: val, ...meta });
          } else if (tokenType === 'typography') {
            typography.push({
              name: variable.name,
              fontFamily: '',
              fontSize: val,
              fontWeight: 400,
              ...meta,
            });
          }
        }
      }
    }
  }

  return {
    colors,
    spacing,
    radius,
    typography,
    hasData: colors.length + spacing.length + radius.length + typography.length > 0,
  };
}
```

---

## 4. DB 스키마 (`src/lib/db/schema.ts`)

### 4.1 `tokens` 테이블 변경

```typescript
export const tokens = sqliteTable('tokens', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  version: integer('version').notNull().default(1),
  type: text('type', { enum: ['color', 'typography', 'spacing', 'radius'] }).notNull(),
  name: text('name').notNull(),
  value: text('value').notNull(),
  raw: text('raw'),
  // ── 신규 컬럼 ──
  source: text('source', { enum: ['variables', 'node-scan'] }).default('node-scan'),
  mode: text('mode'),               // "Light" | "Dark" | null
  collectionName: text('collection_name'), // "Primitives" | "Semantic" | null
  alias: text('alias'),             // alias variable ID | null
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

### 4.2 마이그레이션 (`src/lib/db/migrate.ts`)

```typescript
import { db } from './index';

export function runMigrations(): void {
  // tokens 테이블 신규 컬럼 추가 (없으면 추가, 있으면 스킵)
  const cols = db.all<{ name: string }>(
    `PRAGMA table_info(tokens)`
  ).map((r) => r.name);

  if (!cols.includes('source')) {
    db.run(`ALTER TABLE tokens ADD COLUMN source TEXT DEFAULT 'node-scan'`);
  }
  if (!cols.includes('mode')) {
    db.run(`ALTER TABLE tokens ADD COLUMN mode TEXT`);
  }
  if (!cols.includes('collection_name')) {
    db.run(`ALTER TABLE tokens ADD COLUMN collection_name TEXT`);
  }
  if (!cols.includes('alias')) {
    db.run(`ALTER TABLE tokens ADD COLUMN alias TEXT`);
  }
}
```

### 4.3 마이그레이션 실행 위치

`src/lib/db/index.ts`에서 앱 시작 시 1회 실행:

```typescript
import { runMigrations } from './migrate';
// DB 초기화 후 마이그레이션
runMigrations();
```

---

## 5. `extractTokensAction` 변경 (`src/lib/actions/project.ts`)

### 5.1 Variables 우선 + 폴백 흐름

```typescript
// 1. Variables 시도
const variablesRes = await client.getVariables(fileKey);
const variablesData = variablesRes
  ? extractFromVariables(variablesRes)
  : null;

const useVariables = variablesData?.hasData ?? false;

// 2. 소스 결정
let colors, typography, spacing, radius, extractionSource;

if (useVariables) {
  // Variables 기반
  colors    = variablesData!.colors;
  typography = variablesData!.typography;
  spacing   = variablesData!.spacing;
  radius    = variablesData!.radius;
  extractionSource = 'variables' as const;
} else {
  // 기존 노드 순회 폴백
  const file = await client.getFile(fileKey);
  const extracted = extractFromNode(file.document);
  colors    = extracted.colors;
  typography = extracted.typography;
  spacing   = extracted.spacing;
  radius    = extracted.radius;
  extractionSource = 'node-scan' as const;
}
```

### 5.2 DB 저장 시 신규 컬럼 포함

```typescript
// 색상 저장 예시
if (selectedTypes.includes('color')) {
  for (const color of colors) {
    db.insert(tokens).values({
      id: generateId(),
      projectId,
      version,
      type: 'color',
      name: color.name,
      value: serializeColorValue(color),
      raw: color.hex,
      source: extractionSource,
      mode: (color as ColorTokenV).mode ?? null,
      collectionName: (color as ColorTokenV).collectionName ?? null,
      alias: (color as ColorTokenV).alias ?? null,
    }).run();
  }
}
```

---

## 6. UI 변경

### 6.1 토큰 페이지 상단 배너 (`page.tsx`)

```tsx
// ExtractResult에 source 정보 포함 후
{extractionSource === 'variables' ? (
  <div className={styles.sourceBanner}>
    <Icon icon="solar:magic-stick-3-linear" width={14} height={14} />
    Variables 기반 추출 — 디자이너가 정의한 토큰
  </div>
) : (
  <div className={`${styles.sourceBanner} ${styles.sourceBannerFallback}`}>
    <Icon icon="solar:scanner-linear" width={14} height={14} />
    노드 스캔 방식 — Variables 없음
  </div>
)}
```

### 6.2 색상 카드 모드 배지 (`ColorGrid.tsx`)

```tsx
{token.mode && (
  <span className={`${styles.modeBadge} ${token.mode === 'Dark' ? styles.modeDark : styles.modeLight}`}>
    {token.mode}
  </span>
)}
{token.collectionName && (
  <span className={styles.collectionBadge}>{token.collectionName}</span>
)}
```

---

## 7. 토큰 타입 정의 확장 (`TokenRow`)

`src/lib/actions/tokens.ts`의 `TokenRow`에 신규 필드 추가:

```typescript
export interface TokenRow {
  id: string;
  name: string;
  type: string;
  value: string;
  raw: string | null;
  // 신규
  source: 'variables' | 'node-scan' | null;
  mode: string | null;
  collectionName: string | null;
  alias: string | null;
}
```

---

## 8. 구현 순서 (체크리스트)

### Phase 1: 백엔드 (1일차)
- [ ] `src/lib/figma/api.ts` — Variables 타입 + `getVariables()` 추가
- [ ] `src/lib/tokens/variables-extractor.ts` — 신규 파일 작성
- [ ] `src/lib/db/schema.ts` — tokens 테이블 컬럼 추가
- [ ] `src/lib/db/migrate.ts` — ALTER TABLE 마이그레이션
- [ ] `src/lib/db/index.ts` — 마이그레이션 실행 연결
- [ ] `src/lib/actions/project.ts` — Variables 우선 + 폴백 로직
- [ ] `src/lib/actions/tokens.ts` — TokenRow 타입 확장 + SELECT에 신규 컬럼 포함

### Phase 2: UI (2일차)
- [ ] `src/app/(ide)/tokens/[type]/page.tsx` — source 배너
- [ ] `src/app/(ide)/tokens/[type]/ColorGrid.tsx` — mode/collection 배지
- [ ] `src/styles/components/` — 배지 스타일 추가

---

## 9. 엣지 케이스

| 케이스 | 처리 |
|--------|------|
| Variable 값이 VARIABLE_ALIAS (alias 체인) | alias 필드에 참조 ID 저장, 실제 색상값은 저장 안 함 |
| 같은 Variable이 Light/Dark 두 모드로 저장 | 별도 row로 저장 (mode 필드로 구분) |
| Variables API 응답이 빈 collections | `hasData = false` → 폴백 |
| `hiddenFromPublishing = true` Variable | 스킵 (퍼블리싱 비공개 토큰 제외) |
| FLOAT Variables 중 분류 불가 항목 | `inferFloatTokenType` → null 반환 → 저장 안 함 |
| 기존 tokens 테이블에 컬럼 없는 상황 | migrate.ts가 PRAGMA로 확인 후 없을 때만 ALTER |
