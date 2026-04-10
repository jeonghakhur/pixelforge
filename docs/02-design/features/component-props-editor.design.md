## Executive Summary

| 관점 | 내용 |
|------|------|
| Problem | Figma 자동 생성 props를 수동 편집할 수 없어 재전송만 가능. loadingText 같은 불필요 prop, hierarchy→variant 같은 이름 변경, 기본값 조정 불가 |
| Solution | `components.propsOverrides` JSON 컬럼 + Props Editor UI + 재생성 액션. 생성기(`tsx-builder.ts`)가 overrides 옵션을 받아 반영 |
| Function UX Effect | 편집 → 저장 → 재생성 3클릭으로 컴포넌트 API 정제. Figma 재전송 시에도 오버라이드 유지 |
| Core Value | 자동 생성과 수동 커스터마이징의 간극 해소. 원본은 생성기, 정제는 개발자 |

---

# Design: Component Props Editor

**Plan 참조**: `docs/01-plan/features/component-props-editor.plan.md`
**작성**: 2026-04-10

---

## 1. 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│ Component 페이지                                             │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ Preview    │  │ Props Editor │  │ [저장] [재생성]   │   │
│  │ (iframe)   │  │ (editable)   │  │                   │   │
│  └────────────┘  └──────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                │                    │
         ▼                ▼                    ▼
    postMessage    updatePropsOverrides    regenerateComponentFiles
         │                │                    │
         │                ▼                    ▼
         │     ┌──────────────────┐   ┌─────────────────────┐
         │     │ DB: components   │   │ runPipeline(raw,    │
         │     │ propsOverrides   │   │   { overrides })    │
         │     │ JSON             │   └─────────────────────┘
         │     └──────────────────┘              │
         │                                       ▼
         │                          ┌──────────────────────┐
         │                          │ writeComponentFiles  │
         │                          │ (TSX + CSS + barrel) │
         │                          └──────────────────────┘
         │                                       │
         └───────────────────────────────────────┘
                      iframe reload
```

---

## 2. DB 스키마 변경

### 2-1. `components` 테이블 컬럼 추가

```typescript
// src/lib/db/schema.ts
export const components = sqliteTable('components', {
  // ... 기존 컬럼
  propsOverrides: text('props_overrides'),  // JSON, nullable
})
```

### 2-2. Drizzle 마이그레이션

```sql
-- drizzle/NNNN_add_props_overrides.sql
ALTER TABLE components ADD COLUMN props_overrides TEXT;
```

- `NULL` 허용 → 기존 컴포넌트 영향 없음
- 값은 `PropsOverride[]` JSON 직렬화

---

## 3. 데이터 모델

### 3-1. PropsOverride 타입

```typescript
// src/lib/component-generator/props-override.ts

export interface PropsOverride {
  /** 원본 prop 이름 (매칭 키) — 재전송 시 이 이름으로 매칭 */
  sourceName: string

  /** 편집된 prop 이름 (최종 출력 이름) */
  name: string

  /** 삭제 플래그 — true면 TSX에 포함하지 않음 */
  removed: boolean

  /** 편집된 TypeScript 타입 (undefined면 원본 타입 유지) */
  tsType?: string

  /** 편집된 기본값 (undefined면 원본 기본값 유지) */
  defaultValue?: string | boolean

  /** Boolean → ReactNode 같은 타입 종류 변경 */
  kind?: 'union' | 'boolean' | 'node' | 'string'
}

/** 컴포넌트당 오버라이드 묶음 */
export interface ComponentOverrides {
  /** 컴포넌트 이름 (null이면 원본 유지) */
  name?: string
  /** props 오버라이드 목록 */
  props: PropsOverride[]
}
```

### 3-2. 예시 JSON

```json
{
  "name": "PrimaryButton",
  "props": [
    {
      "sourceName": "hierarchy",
      "name": "variant",
      "removed": false,
      "defaultValue": "Primary"
    },
    {
      "sourceName": "loadingText",
      "name": "loadingText",
      "removed": true
    },
    {
      "sourceName": "iconLeading",
      "name": "startIcon",
      "removed": false
    }
  ]
}
```

---

## 4. 생성기 수정

### 4-1. `runPipeline()` 시그니처 확장

```typescript
// src/lib/component-generator/pipeline.ts

export interface PipelineOptions {
  overrides?: ComponentOverrides
}

export function runPipeline(
  raw: Record<string, unknown>,
  options?: PipelineOptions,
): PipelineResult {
  const payload = normalize(raw)

  // 컴포넌트명 오버라이드 적용
  if (options?.overrides?.name) {
    payload.name = options.overrides.name
  }

  // ... 기존 로직
  const output = gen(payload, { element, overrides: options?.overrides })
}
```

### 4-2. `tsx-builder.ts`에서 overrides 적용

```typescript
// src/lib/component-generator/generators/shared/tsx-builder.ts

export interface TsxBuildOptions {
  // ... 기존
  overrides?: ComponentOverrides
}

export function buildTsx(payload, dims, options): string {
  const overrideMap = new Map(
    (options.overrides?.props ?? []).map(o => [o.sourceName, o]),
  )

  // 각 prop 생성 시 오버라이드 체크
  // 1. removed === true → 스킵
  // 2. name이 다르면 → 편집된 이름 사용
  // 3. defaultValue가 있으면 → 편집된 값 사용
  // 4. kind가 다르면 → 타입 변경 (예: boolean → node)
}
```

### 4-3. 오버라이드 적용 우선순위

```
1. Figma raw data → parseComponentProperties → 원본 props 목록
2. overrides.props[].sourceName 으로 매칭
3. 매칭 성공:
   - removed === true → 제외
   - 이름/기본값/타입 오버라이드 적용
4. 매칭 실패 (새 prop 등장, Figma 재전송 후):
   - overrides에 없는 prop은 원본 그대로 사용
5. 재전송 후 없어진 prop:
   - overrides에서 해당 항목은 불필요, 다음 저장 시 정리
```

---

## 5. Actions Layer

### 5-1. `updatePropsOverrides`

```typescript
// src/lib/actions/components.ts

export async function updatePropsOverrides(
  id: string,
  overrides: ComponentOverrides,
): Promise<{ error: string | null }> {
  // zod 검증
  const parsed = componentOverridesSchema.safeParse(overrides)
  if (!parsed.success) return { error: parsed.error.message }

  // 이름 중복 체크
  if (overrides.name) {
    const duplicate = db.select().from(components)
      .where(and(eq(components.name, overrides.name), ne(components.id, id)))
      .get()
    if (duplicate) return { error: `이름 '${overrides.name}'은 이미 사용 중입니다` }
  }

  db.update(components).set({
    propsOverrides: JSON.stringify(overrides),
    updatedAt: new Date(),
  }).where(eq(components.id, id)).run()

  return { error: null }
}
```

### 5-2. `regenerateComponentFiles`

```typescript
export async function regenerateComponentFiles(
  id: string,
): Promise<{ error: string | null }> {
  const row = db.select({
    id: components.id,
    name: components.name,
    nodePayload: components.nodePayload,
    propsOverrides: components.propsOverrides,
  }).from(components).where(eq(components.id, id)).get()

  if (!row?.nodePayload) return { error: '원본 데이터 없음' }

  const overrides = row.propsOverrides
    ? JSON.parse(row.propsOverrides) as ComponentOverrides
    : undefined

  // 이름 변경 감지
  const oldName = row.name
  const newName = overrides?.name ?? oldName
  const nameChanged = oldName !== newName

  // 파이프라인 재실행
  const rawData = JSON.parse(row.nodePayload) as Record<string, unknown>
  const result = runPipeline(rawData, { overrides })

  if (!result.success || !result.output) {
    return { error: result.error ?? '생성 실패' }
  }

  // DB 업데이트 (이름 변경 포함)
  db.update(components).set({
    name: newName,
    tsx: result.output.tsx,
    scss: result.output.css,
    updatedAt: new Date(),
  }).where(eq(components.id, id)).run()

  // 파일 시스템 업데이트
  const figmaPath = (rawData.name as string) ?? newName
  const oldFigmaPath = nameChanged
    ? figmaPath.replace(new RegExp(`${oldName}$`), oldName)  // 이전 경로 추정
    : null

  // 이전 파일 삭제 (이름 변경 시)
  if (nameChanged && oldFigmaPath) {
    deleteComponentFiles(oldFigmaPath)
  }

  // 새 파일 생성
  const newFigmaPath = nameChanged
    ? figmaPath.replace(new RegExp(`${oldName}$`), newName)
    : figmaPath
  writeComponentFiles(newFigmaPath, result.output.tsx, result.output.css)

  return { error: null }
}
```

### 5-3. `importComponentFromJson` / `POST /api/sync/components` 수정

플러그인 재전송 시 기존 `propsOverrides`를 유지:

```typescript
// 기존 컴포넌트가 있으면 propsOverrides 보존
const existing = db.select({
  id: components.id,
  propsOverrides: components.propsOverrides,
}).from(components).where(eq(components.figmaNodeId, dataMeta.nodeId)).get()

const overrides = existing?.propsOverrides
  ? JSON.parse(existing.propsOverrides) as ComponentOverrides
  : undefined

const result = runPipeline(rawData, { overrides })
// → 재전송 시에도 편집 내용이 결과에 반영됨
```

---

## 6. UI: Props Editor

### 6-1. 컴포넌트 구조

```
src/app/(main)/(ide)/components/[name]/
├── ComponentGuideClient.tsx    (수정: PropsEditor 통합)
├── PropsEditor.tsx             (신규)
├── PropsEditor.module.scss     (신규)
└── page.module.scss
```

### 6-2. PropsEditor.tsx 인터페이스

```typescript
interface PropsEditorProps {
  componentId: string
  componentName: string
  tsx: string  // 생성된 TSX (props 파싱용)
  initialOverrides: ComponentOverrides | null
  onRegenerate: () => Promise<void>  // 재생성 콜백
}
```

### 6-3. UI 레이아웃

```
┌─ Props Editor ────────────────────────────────┐
│ 컴포넌트명: [Button           ]               │
│                                                │
│ ┌─ Props ─────────────────────────────────┐  │
│ │ ☑ hierarchy     union      [Primary ▼] │  │
│ │   이름: [variant          ]             │  │
│ │                                          │  │
│ │ ☑ size          union      [md      ▼] │  │
│ │   이름: [size             ]             │  │
│ │                                          │  │
│ │ ☐ loadingText   boolean    [true    ▼] │  │  ← removed
│ │   (삭제됨 — 클릭하여 복원)              │  │
│ │                                          │  │
│ │ ☑ iconLeading   ReactNode               │  │
│ │   이름: [startIcon        ]             │  │
│ │   타입: [ReactNode ▼]                   │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ [변경사항 저장]  [파일 재생성]                │
└────────────────────────────────────────────────┘
```

### 6-4. 상태 관리

```typescript
const [overrides, setOverrides] = useState<ComponentOverrides>(
  initialOverrides ?? { name: undefined, props: [] }
)
const [dirty, setDirty] = useState(false)
const [saving, setSaving] = useState(false)
const [regenerating, setRegenerating] = useState(false)

// prop 수정 시 dirty = true
// 저장 성공 시 dirty = false
// 재생성은 저장 후에만 가능 (dirty면 비활성)
```

### 6-5. Parsed props 추출

현재 sandbox의 `parseSandboxProps()`를 재사용하여 TSX에서 props 정의 추출:

```typescript
const baseProps = useMemo(() => parseSandboxProps(tsx), [tsx])

// baseProps와 overrides를 병합하여 화면에 표시
const displayProps = baseProps.map(base => {
  const override = overrides.props.find(o => o.sourceName === base.name)
  return {
    sourceName: base.name,
    name: override?.name ?? base.name,
    removed: override?.removed ?? false,
    defaultValue: override?.defaultValue ?? base.defaultValue,
    kind: base.kind,
  }
})
```

---

## 7. 컴포넌트명 변경 처리

### 7-1. 이름 변경 시 영향 범위

| 대상 | 변경 내용 |
|------|-----------|
| DB `components.name` | 새 이름 저장 |
| 파일 경로 | `Buttons/Button/Button.tsx` → `Buttons/PrimaryButton/PrimaryButton.tsx` |
| 폴더 | 이전 폴더 삭제, 새 폴더 생성 |
| TSX `export const` | `Button` → `PrimaryButton` |
| 루트 barrel | 자동 갱신 |
| URL `/components/[name]` | `/components/Button` → `/components/PrimaryButton` |

### 7-2. 404 방지

이름 변경 후 기존 URL 접근 시 404 발생. 해결:
- 변경 직후 클라이언트에서 `router.replace('/components/{newName}')`
- 저장/재생성 응답에 `newName` 포함 → 프론트에서 redirect

### 7-3. 이전 파일 정리

```typescript
if (nameChanged) {
  // 이전 figmaPath에서 마지막 세그먼트를 oldName으로 교체
  // "Buttons/Button" → oldName=Button → 삭제
  // 새 figmaPath: "Buttons/PrimaryButton"
  deleteComponentFiles(oldFigmaPath)
  writeComponentFiles(newFigmaPath, tsx, css)
}
```

---

## 8. Zod Schema (검증)

```typescript
// src/lib/component-generator/props-override.ts

import { z } from 'zod'

export const propsOverrideSchema = z.object({
  sourceName: z.string().min(1),
  name: z.string().min(1).regex(/^[a-z][a-zA-Z0-9]*$/, 'camelCase'),
  removed: z.boolean(),
  tsType: z.string().optional(),
  defaultValue: z.union([z.string(), z.boolean()]).optional(),
  kind: z.enum(['union', 'boolean', 'node', 'string']).optional(),
})

export const componentOverridesSchema = z.object({
  name: z.string()
    .min(1)
    .regex(/^[A-Z][a-zA-Z0-9]*$/, 'PascalCase')
    .optional(),
  props: z.array(propsOverrideSchema),
})

// 저장 시 중복 이름 체크
function validateUniqueNames(props: PropsOverride[]): boolean {
  const names = props.filter(p => !p.removed).map(p => p.name)
  return new Set(names).size === names.length
}
```

---

## 9. 구현 순서 (Phase별)

### Phase 1: 데이터 + 생성기 (백엔드)
1. `props-override.ts` — 타입 + zod schema
2. `components` 스키마에 `propsOverrides` 컬럼 추가 + 마이그레이션
3. `tsx-builder.ts` — `overrides` 옵션 받아 prop 생성 시 반영
4. `runPipeline()` — `overrides` 전달
5. `regenerateComponentFiles()` 액션
6. `importComponentFromJson` / route.ts — 재전송 시 overrides 보존

### Phase 2: UI
7. `PropsEditor.tsx` — props 목록 표시, 편집 상태 관리
8. `PropsEditor.module.scss` — 스타일
9. `ComponentGuideClient.tsx` — PropsEditor 통합
10. `updatePropsOverrides()` 액션 연결
11. 재생성 버튼 → `regenerateComponentFiles()` 호출

### Phase 3: 컴포넌트명 변경
12. 이름 중복 검증
13. 파일 시스템 이동 (이전 폴더 삭제, 새 폴더 생성)
14. URL redirect
15. 루트 barrel 재생성 (기존 로직 재사용)

### Phase 4: 검증 + 마무리
16. E2E 테스트 (Playwright)
17. 빌드 + lint 통과
18. 문서 업데이트

---

## 10. 검증 기준

- [ ] Phase 1 완료 후: 단위 테스트로 overrides 반영 확인
- [ ] Phase 2 완료 후: 브라우저에서 편집/저장 동작
- [ ] Phase 3 완료 후: 이름 변경 후 이전 파일 없음, 새 파일 존재, URL 이동 동작
- [ ] Phase 4 완료 후: `npm run build` 성공, `npm run lint` 통과
- [ ] 기존 컴포넌트(오버라이드 없음) 동작 유지
- [ ] 플러그인 재전송 후에도 오버라이드 유지
