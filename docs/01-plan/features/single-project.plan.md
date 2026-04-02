---
template: plan
version: 1.2
---

# single-project Planning Document

> **Summary**: 멀티 프로젝트 구조를 단일 활성 프로젝트 구조로 리팩터링
>
> **Project**: PixelForge
> **Author**: Jeonghak Hur
> **Date**: 2026-04-02
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | `projects` 테이블에 Figma 파일 키마다 프로젝트가 생성되고, UI는 `orderBy(updated_at).limit(1)` 해킹으로 현재 프로젝트를 추측함 |
| **Solution** | `app_settings` 테이블에 `active_project_id`를 저장해 모든 액션이 하나의 명시적 프로젝트를 바라보게 함 |
| **Function/UX Effect** | 플러그인 sync → 자동으로 해당 프로젝트가 활성화 → UI가 항상 올바른 토큰을 표시 |
| **Core Value** | "하나의 Figma 파일 = 하나의 디자인 시스템" 원칙에 맞는 단순하고 예측 가능한 데이터 흐름 |

---

## 1. Overview

### 1.1 Purpose

PixelForge는 하나의 Figma 디자인 시스템 파일에서 토큰을 추출·관리하는 도구다. 그러나 현재 구현은 `figmaFileKey` 마다 별도 프로젝트 행을 생성하는 멀티 프로젝트 구조로 되어 있어, 의도치 않은 데이터 분산과 UI 불일치가 발생한다.

### 1.2 Background

- `route.ts`가 `figmaFileKey` 기준으로 프로젝트를 생성/조회함
- 개발 중 `figma.fileKey = undefined` → `0:0` 같은 임시 키로 별도 프로젝트 생성
- 모든 토큰 조회 액션이 `orderBy(updated_at).limit(1)` 로 "현재 프로젝트"를 추측
- 결과: 토큰은 저장됐는데 UI에 반영 안 됨, 중복 프로젝트 생성

### 1.3 관련 문서

- `docs/01-plan/features/db.plan.md` — 현재 db 피처 계획

---

## 2. Scope

### 2.1 In Scope

- [ ] `app_settings` 테이블 추가 (`active_project_id` 컬럼)
- [ ] 플러그인 sync 시 해당 프로젝트를 자동으로 활성 프로젝트로 설정
- [ ] 모든 토큰 조회 액션에서 `orderBy(updated_at).limit(1)` → `active_project_id` 로 교체
- [ ] `getActiveProject()` 헬퍼 함수 추출
- [ ] 기존 테스트 데이터 정리 (DB 초기화)

### 2.2 Out of Scope

- `projects` 테이블 제거 (호환성 유지)
- 멀티 프로젝트 전환 UI (미래 기능)
- `project_id` FK 컬럼 제거 (스키마 대규모 변경 불필요)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `app_settings` 테이블에 `active_project_id` 저장 | High | Pending |
| FR-02 | 플러그인 sync 성공 시 해당 `projectId`를 active로 설정 | High | Pending |
| FR-03 | `getActiveProject()` 함수 — settings → fallback(latest) 순서로 조회 | High | Pending |
| FR-04 | 토큰/소스/스냅샷 조회 액션 전체를 `getActiveProject()` 기반으로 교체 | High | Pending |
| FR-05 | JSON 임포트 시에도 active project에 저장 | Medium | Pending |
| FR-06 | 설정 페이지에서 활성 프로젝트 수동 변경 가능 (선택) | Low | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria |
|----------|----------|
| 하위 호환 | 기존 DB 마이그레이션 — 테이블 추가만, 기존 컬럼 변경 없음 |
| 안전성 | `active_project_id`가 없을 때 graceful fallback (`updated_at` 기준) |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 플러그인 sync → 페이지 새로고침 → 토큰이 UI에 즉시 반영
- [ ] 동일 데이터 재전송 → `changed: false` 반환 (중복 스냅샷 없음)
- [ ] 여러 번 sync해도 항상 같은 프로젝트에 누적
- [ ] `npm run build` 성공

### 4.2 Quality Criteria

- [ ] Zero lint errors
- [ ] 기존 token 액션 동작 유지 (회귀 없음)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `app_settings` 행이 없는 기존 DB | Medium | High | `getActiveProject()` fallback 로직으로 처리 |
| JSON 임포트가 다른 프로젝트에 저장됨 | Medium | Medium | JSON 임포트도 active project 기준으로 통일 |

---

## 6. Architecture

### 6.1 변경 구조

```
현재:
  route.ts
    └── projects WHERE figmaKey = X  →  없으면 INSERT
    └── 모든 액션: projects ORDER BY updated_at LIMIT 1  (추측)

변경 후:
  route.ts
    └── projects WHERE figmaKey = X  →  없으면 INSERT
    └── app_settings.active_project_id = projectId  (명시적)

  getActiveProject()
    └── app_settings.active_project_id  →  없으면 ORDER BY updated_at LIMIT 1 (fallback)

  모든 토큰 액션
    └── getActiveProject() 사용
```

### 6.2 신규 테이블

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- 사용: key = 'active_project_id', value = '{uuid}'
```

### 6.3 영향 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/db/index.ts` | `app_settings` 테이블 DDL 추가 |
| `src/lib/db/schema.ts` | `appSettings` Drizzle 스키마 추가 |
| `src/lib/actions/tokens.ts` | `getActiveProject()` 헬퍼 추출, 전체 교체 |
| `src/app/api/sync/tokens/route.ts` | sync 후 `active_project_id` 설정 |

---

## 7. 구현 순서

1. `app_settings` 스키마 + DDL 추가
2. `getActiveProject()` 헬퍼 작성 (fallback 포함)
3. `route.ts` — sync 후 active 설정
4. `tokens.ts` 액션 전체 교체
5. DB 테스트 데이터 초기화
6. 플러그인 end-to-end 검증

---

## 8. Next Steps

1. [ ] `/pdca design single-project` — 설계 문서 작성
2. [ ] 구현 시작

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-02 | Initial draft | Jeonghak Hur |
