## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | token-menu — 토큰 메뉴 DB 자동 생성 |
| 시작일 | 2026-04-02 |
| 목표 완료일 | 2026-04-04 |
| 기간 | 2~3일 |

| 관점 | 내용 |
|------|------|
| Problem | 토큰 메뉴가 `token-types.ts`에 하드코딩 + `.pixelforge/config.json` 파일로 수동 관리되어, Figma sync 후 실제 존재하는 타입(`size`, `resolution` 등)이 메뉴에 나타나지 않고 없는 타입(`typography`)은 dimmed로 항상 노출된다 |
| Solution | 토큰 sync 시 `tokens` 테이블에서 실제 존재하는 `DISTINCT type`을 `token_type_configs` 테이블에 자동 등록하고, Sidebar는 이 테이블을 읽어 메뉴를 구성한다 |
| Function UX Effect | sync 한 번으로 메뉴가 자동 갱신되며, 없는 타입은 노출되지 않고 새 타입은 자동 추가된다. 관리자 페이지에서 라벨·아이콘·순서·표시 여부를 수정할 수 있다 |
| Core Value | Figma Variables 구조가 메뉴에 그대로 반영되는 완전 자동화 — 수동 설정 없이 프로젝트별 토큰 타입을 정확하게 표시 |

---

# Plan: token-menu — 토큰 메뉴 DB 자동 생성

## 1. 배경 및 문제

### 1.1 현재 구조

```
token-types.ts (하드코딩: color / typography / spacing / radius)
    ↓ builtin 또는 .pixelforge/config.json 오버라이드
getActiveTokenTypesAction()
    ↓
Sidebar — 해당 타입 메뉴 표시 (토큰 없으면 dimmed)
```

### 1.2 문제점

| 타입 | 실제 Figma 데이터 | 현재 메뉴 |
|------|-----------------|----------|
| `color` | 273개 | ✅ 노출 |
| `spacing` | 16개 | ✅ 노출 |
| `radius` | 6개 | ✅ 노출 |
| `size` | 10개 | ❌ 없음 (`float`으로 묻힘) |
| `resolution` | 9개 | ❌ 없음 (`float`으로 묻힘) |
| `typography` | 0개 | ⚠️ dimmed로 항상 노출 |

**핵심 모순**: 토큰은 자동으로 sync되는데 메뉴는 수동으로 관리해야 한다.

### 1.3 토큰 JSON 파일 분석 결과 (2026-04-02)

실제 Figma 플러그인이 전송하는 토큰 구조:
- `Global` collection: `colors/*`, `spacing/*`, `radius/*`, `size/*`, `resolution/*`
- `Colors` collection (light/dark): Semantic 토큰 전부 VARIABLE_ALIAS
- FLOAT 변수에 `scopes` 필드 없음 → name prefix로 분류
- `size`, `resolution`은 현재 파서에서 `float`으로 분류됨

---

## 2. 목표

### 2.1 핵심 목표

```
sync 완료
    ↓
pipeline: tokens 테이블 DISTINCT type → token_type_configs 자동 upsert
    ↓
Sidebar: token_type_configs WHERE isVisible=true ORDER BY menuOrder
    ↓
없는 타입은 노출 안 함 / 새 타입은 자동 추가
```

### 2.2 관리자 기능

Admin 페이지에서 token_type_configs 관리:
- 라벨 수정 (예: `size` → `Size`)
- 아이콘 수정 (Solar 아이콘셋)
- 표시 순서 변경 (위/아래 버튼)
- 표시 여부 토글 (isVisible)
- **삭제 불가** (tokens 테이블에 데이터가 있는 한) — 단 isVisible=false로 숨기기 가능

---

## 3. DB 스키마

### 3.1 신규 테이블: `token_type_configs`

```sql
token_type_configs (
  id          TEXT PRIMARY KEY,
  projectId   TEXT NOT NULL REFERENCES projects(id),
  type        TEXT NOT NULL,           -- tokens.type과 동일 값
  label       TEXT NOT NULL,           -- 표시 이름 (예: "Colors")
  icon        TEXT NOT NULL,           -- Solar 아이콘 (예: "solar:pallete-linear")
  menuOrder   INTEGER NOT NULL DEFAULT 0,
  isVisible   INTEGER NOT NULL DEFAULT 1,  -- boolean
  createdAt   TIMESTAMP,
  updatedAt   TIMESTAMP,
  UNIQUE(projectId, type)
)
```

### 3.2 타입별 기본값 (known types)

`token-types.ts`는 메타데이터 기본값 맵으로만 역할 변경:

| type | label | icon |
|------|-------|------|
| `color` | Colors | `solar:pallete-linear` |
| `spacing` | Spacing | `solar:ruler-linear` |
| `radius` | Radius | `solar:crop-linear` |
| `typography` | Typography | `solar:text-field-linear` |
| `size` | Size | `solar:scaling-linear` |
| `resolution` | Resolution | `solar:monitor-linear` |
| `float` | Float | `solar:calculator-linear` |
| `string` | String | `solar:text-linear` |
| `boolean` | Boolean | `solar:check-square-linear` |

---

## 4. 구현 범위

### Phase 1 — DB 스키마 + 파이프라인 연동

**`src/lib/db/schema.ts`** 수정
- `tokenTypeConfigs` 테이블 추가

**`src/lib/tokens/token-type-defaults.ts`** 신규 (token-types.ts 대체)
- `TYPE_DEFAULTS: Record<string, { label, icon }>` 맵만 보유
- `getTypeDefault(type)` — 알 수 없는 타입은 generic 기본값 반환

**`src/lib/tokens/pipeline.ts`** 수정
- upsert 완료 후 DISTINCT type 추출
- `token_type_configs` 신규 타입만 INSERT (기존 설정 덮어쓰지 않음)

### Phase 2 — Sidebar 교체

**`src/lib/actions/token-menu.ts`** 신규
```ts
// 현재 프로젝트의 token_type_configs 반환 (isVisible=true, ORDER BY menuOrder)
export async function getTokenMenuAction(): Promise<TokenTypeConfig[]>
```

**`src/components/layout/Sidebar.tsx`** 수정
- `getActiveTokenTypesAction()` → `getTokenMenuAction()` 교체
- `StoredTokenType` 타입 제거, DB 기반 타입 사용

### Phase 3 — Admin 페이지

**`src/app/(ide)/admin/TokenTypeManager.tsx`** 신규
- 현재 프로젝트의 token_type_configs 목록
- 라벨 인라인 수정
- 아이콘 수정
- 순서 변경 (up/down 버튼)
- isVisible 토글
- 삭제: tokens 테이블에 해당 type 데이터가 없을 때만 가능

**`src/lib/actions/token-type-admin.ts`** 신규
```ts
updateTokenTypeConfigAction(id, { label?, icon?, menuOrder?, isVisible? })
deleteTokenTypeConfigAction(id)  // tokens 잔여 여부 검사 포함
reorderTokenTypeConfigsAction(orderedIds)
```

### Phase 4 — 기존 코드 정리

제거:
- `.pixelforge/config.json`의 `tokenTypes` 필드 (설정 마이그레이션 후)
- `src/lib/actions/token-type-config.ts` → 삭제
- `src/app/(ide)/settings/TokenTypeSettings.tsx` → Admin으로 이동
- `token-types.ts`의 `TOKEN_TYPES` 배열, `sectionPattern` (더 이상 메뉴 생성에 불필요)

유지:
- `sectionPattern` → `extract-color.ts` 등 스크립트에서만 사용되므로 scripts 전용으로 이동

---

## 5. 구현 순서

```
Day 1:
  1. schema.ts — tokenTypeConfigs 테이블 추가
  2. DB 마이그레이션 실행
  3. token-type-defaults.ts — TYPE_DEFAULTS 맵
  4. pipeline.ts — sync 후 token_type_configs 자동 upsert
  5. curl/테스트로 token_type_configs 자동 생성 확인

Day 2:
  6. token-menu.ts 액션 — getTokenMenuAction()
  7. Sidebar 교체 — getActiveTokenTypesAction → getTokenMenuAction
  8. 메뉴 자동 갱신 동작 확인

Day 3:
  9. Admin TokenTypeManager 컴포넌트
  10. token-type-admin.ts 액션들
  11. 기존 코드 정리 (token-type-config.ts, TokenTypeSettings.tsx)
```

---

## 6. 파일 목록

| 파일 | 변경 | 설명 |
|------|------|------|
| `src/lib/db/schema.ts` | 수정 | `tokenTypeConfigs` 테이블 추가 |
| `src/lib/tokens/token-type-defaults.ts` | 신규 | TYPE_DEFAULTS 맵 |
| `src/lib/tokens/pipeline.ts` | 수정 | sync 후 token_type_configs 자동 upsert |
| `src/lib/actions/token-menu.ts` | 신규 | getTokenMenuAction() |
| `src/lib/actions/token-type-admin.ts` | 신규 | 관리자 CRUD 액션 |
| `src/components/layout/Sidebar.tsx` | 수정 | getTokenMenuAction 사용 |
| `src/app/(ide)/admin/TokenTypeManager.tsx` | 신규 | 관리자 UI |
| `src/lib/actions/token-type-config.ts` | 삭제 | DB 기반으로 교체 |
| `src/app/(ide)/settings/TokenTypeSettings.tsx` | 삭제/이동 | Admin으로 통합 |
| `src/lib/tokens/token-types.ts` | 수정 | sectionPattern 제거, 메타데이터 맵으로 단순화 |

---

## 7. 성공 기준

- [ ] sync 후 `token_type_configs`에 새 타입 자동 등록 (`size`, `resolution` 포함)
- [ ] Sidebar 메뉴가 DB 기반으로 표시 (없는 타입은 노출 안 함)
- [ ] `typography` — 데이터 없으면 메뉴에 나타나지 않음
- [ ] `size` / `resolution` — 데이터 있으면 메뉴에 자동 등장
- [ ] Admin에서 라벨·아이콘·순서·표시여부 수정 가능
- [ ] 수정 사항이 Sidebar에 즉시 반영
- [ ] 기존 token-type-config.ts 파일 기반 설정 제거
