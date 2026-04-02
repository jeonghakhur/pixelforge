---
template: design
version: 1.2
---

# single-project Design Document

> **Summary**: `app_settings` 테이블로 활성 프로젝트를 명시적으로 관리
>
> **Project**: PixelForge
> **Author**: Jeonghak Hur
> **Date**: 2026-04-02
> **Status**: Draft
> **Planning Doc**: [single-project.plan.md](../01-plan/features/single-project.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- 모든 토큰 조회 액션이 단일 명시적 프로젝트를 바라보게 한다
- `orderBy(updatedAt).limit(1)` 추측 로직을 완전히 제거한다
- 스키마 변경 최소화 (FK 제거 없이 설정 테이블 추가만)

### 1.2 Design Principles

- 기존 `projects` 테이블 구조 유지 (하위 호환)
- `getActiveProject()` 단일 진입점으로 프로젝트 조회 일원화
- fallback 있는 graceful degradation

---

## 2. Architecture

### 2.1 변경 전/후 데이터 흐름

```
[변경 전]
플러그인 sync → projects INSERT/FIND → tokens INSERT
UI 조회      → projects ORDER BY updated_at LIMIT 1  ← 추측

[변경 후]
플러그인 sync → projects INSERT/FIND → tokens INSERT
              → app_settings SET active_project_id
UI 조회      → app_settings GET active_project_id  ← 명시적
              → fallback: ORDER BY updated_at LIMIT 1
```

### 2.2 getActiveProject() 흐름

```
getActiveProject()
  ├── app_settings WHERE key='active_project_id' 조회
  │     └── 존재하면 → projects WHERE id=value GET
  │           └── 프로젝트 존재하면 → return project
  └── fallback: projects ORDER BY updated_at LIMIT 1 GET
```

### 2.3 영향 범위

| 파일 | 변경 유형 |
|------|-----------|
| `src/lib/db/index.ts` | DDL 추가 (`app_settings` 테이블) |
| `src/lib/db/schema.ts` | Drizzle 스키마 추가 (`appSettings`) |
| `src/lib/actions/tokens.ts` | `getActiveProject()` 추가, 8곳 교체 |
| `src/app/api/sync/tokens/route.ts` | sync 후 `setActiveProject()` 호출 |

---

## 3. Data Model

### 3.1 신규 테이블: `app_settings`

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

사용 레코드:

| key | value | 설명 |
|-----|-------|------|
| `active_project_id` | `{uuid}` | 현재 활성 프로젝트 ID |

### 3.2 Drizzle 스키마

```typescript
// src/lib/db/schema.ts에 추가
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
```

---

## 4. 함수 설계

### 4.1 getActiveProject()

**위치**: `src/lib/actions/tokens.ts` (또는 `src/lib/actions/project.ts`)

```typescript
// 반환 타입 (기존 프로젝트 조회와 동일)
interface ActiveProject {
  id: string;
  name: string;
  figmaKey: string | null;
  figmaUrl: string | null;
}

export function getActiveProject(): ActiveProject | undefined {
  // 1차: app_settings에서 active_project_id 조회
  const setting = db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, 'active_project_id'))
    .get();

  if (setting?.value) {
    const project = db
      .select()
      .from(projects)
      .where(eq(projects.id, setting.value))
      .get();
    if (project) return project;
  }

  // fallback: 가장 최근 업데이트 프로젝트
  return db
    .select()
    .from(projects)
    .orderBy(desc(projects.updatedAt))
    .limit(1)
    .get();
}
```

### 4.2 setActiveProject()

**위치**: `src/lib/actions/tokens.ts` (또는 `src/lib/db/index.ts` 내부 헬퍼)

```typescript
export function setActiveProject(projectId: string): void {
  const existing = db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, 'active_project_id'))
    .get();

  if (existing) {
    db.update(appSettings)
      .set({ value: projectId })
      .where(eq(appSettings.key, 'active_project_id'))
      .run();
  } else {
    db.insert(appSettings)
      .values({ key: 'active_project_id', value: projectId })
      .run();
  }
}
```

### 4.3 route.ts 변경

```typescript
// sync 성공 후 (runTokenPipeline 이후)
setActiveProject(projectId);
```

---

## 5. 교체 대상 목록

`src/lib/actions/tokens.ts` 내 `orderBy(desc(projects.updatedAt)).limit(1).get()` 8곳:

| 라인 | 함수명 | 교체 후 |
|------|--------|---------|
| 110 | (익명) | `getActiveProject()` |
| 153 | (익명) | `getActiveProject()` |
| 224 | `getProjectInfo` | `getActiveProject()` |
| 261 | `getTokenSourceAction` | `getActiveProject()` |
| 326 | `extractTokensByTypeAction` | `getActiveProject()` |
| 453 | `deleteTokenScreenshotsAction` | `getActiveProject()` |
| 561 | `verifyTokensAction` | `getActiveProject()` |
| (captureFigmaFrameAction 관련) | — | `getActiveProject()` |

---

## 6. DB 초기화 (기존 테스트 데이터)

구현 전 기존 테스트 데이터 전체 삭제:

```sql
DELETE FROM token_snapshots;
DELETE FROM token_sources;
DELETE FROM tokens;
DELETE FROM projects;
```

---

## 7. 구현 순서

1. [ ] `src/lib/db/schema.ts` — `appSettings` 테이블 스키마 추가
2. [ ] `src/lib/db/index.ts` — `app_settings` DDL 추가 (`initTables`)
3. [ ] `src/lib/actions/tokens.ts` — `getActiveProject()` / `setActiveProject()` 추가
4. [ ] `src/lib/actions/tokens.ts` — 8곳 `orderBy(updated_at)` 교체
5. [ ] `src/app/api/sync/tokens/route.ts` — `setActiveProject(projectId)` 호출
6. [ ] DB 테스트 데이터 초기화
7. [ ] `npm run build` 확인

---

## 8. Test Plan

| 시나리오 | 기대 결과 |
|----------|-----------|
| 최초 sync (app_settings 없음) | tokens 저장 + active_project_id 설정 |
| 동일 데이터 재전송 | `changed: false`, DB 변경 없음 |
| sync 후 UI 조회 | 올바른 프로젝트의 토큰 표시 |
| app_settings 없는 기존 DB | fallback(updated_at)으로 정상 동작 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-02 | Initial draft | Jeonghak Hur |
