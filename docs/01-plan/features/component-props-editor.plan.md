# Component Props Editor Planning Document

> **Summary**: Figma에서 자동 생성된 컴포넌트 props를 수동 편집하고, 편집 내용을 반영하여 TSX 파일을 재생성하는 기능
>
> **Project**: PixelForge
> **Author**: Jeonghak Hur
> **Date**: 2026-04-10
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Figma 자동 생성 props는 그대로 쓰기 어렵다. 불필요한 prop(loadingText 등) 제거, 이름 변경(hierarchy→variant), 기본값 조정, boolean/ReactNode 타입 변경 같은 수동 조정이 필요한데 매번 플러그인 재전송으로 되돌아간다. |
| **Solution** | 컴포넌트 페이지에 Props Editor 섹션을 추가. props 활성/비활성 토글, 이름/기본값 편집, 타입 선택을 DB에 오버라이드로 저장하고, "파일 재생성" 버튼으로 저장된 설정을 반영한 TSX/CSS를 재생성한다. |
| **Function/UX Effect** | 플러그인 재전송 없이 프로젝트 컨벤션에 맞게 컴포넌트 API 조정 가능. 편집 이력은 DB에 저장되어 재생성 후에도 유지. |
| **Core Value** | Figma → React 자동 생성과 수동 커스터마이징 사이의 간극을 메운다. 생성기는 원본 구조를 제공하고, 개발자는 React 관용 구조로 정제한다. |

---

## 1. Overview

### 1.1 Purpose

Figma COMPONENT_SET에서 자동 생성된 컴포넌트의 TypeScript props interface를 수동 편집하여 React 관용 구조에 맞게 정제하는 기능. 편집 내용을 저장하고 언제든 재생성할 수 있도록 한다.

### 1.2 Background

현재 파이프라인:
1. Figma → 플러그인이 payload 전송
2. `runPipeline()` → TSX + CSS 생성
3. DB 저장 + `src/generated/components/` 파일 생성

**문제점**:
- Figma `componentProperties` 이름이 그대로 prop 이름이 됨 (예: `loadingText`, `iconLeadingSwap`)
- 일부 prop은 Figma 특화 의미라 실제 코드에서 불필요 (예: `loadingText` boolean은 Figma 토글용)
- 기본값을 프로젝트 컨벤션에 맞추려면 재전송만으로는 불가능
- 수동 수정은 플러그인 재전송 시 덮어씌워짐

**해결**: 편집 오버라이드를 DB에 저장 → 재전송/재생성 시에도 유지.

### 1.3 Related Documents

- 관련 기능: `component-generator.design.md` (파이프라인 재설계)
- 플러그인: `PixelForge Plugin` (Figma 플러그인)

---

## 2. Scope

### 2.1 In Scope

- [ ] **Props 편집 UI** — 컴포넌트 페이지에 Props Editor 섹션 추가
- [ ] **컴포넌트명 변경** — 생성된 컴포넌트의 이름 수정 (예: `Button` → `PrimaryButton`). DB name, 파일명, 폴더명, 루트 barrel 모두 업데이트
- [ ] **Prop 삭제/복원** — 불필요 prop을 TSX 출력에서 제거 (예: `loadingText`). 복원 가능 (소프트 삭제)
- [ ] **Prop 이름 변경** — `hierarchy` → `variant`, `iconLeading` 유지 등
- [ ] **기본값 편집** — `size = 'md'` → `size = 'lg'`
- [ ] **타입 변경** — boolean ↔ ReactNode (아이콘 slot의 경우)
- [ ] **DB 저장** — `components.propsOverrides` JSON 컬럼 추가
- [ ] **파일 재생성 액션** — 저장된 오버라이드를 생성기에 전달하여 TSX/CSS 재생성
- [ ] **재생성 시 오버라이드 병합** — 플러그인 재전송 시에도 편집 내용 유지

### 2.2 Out of Scope

- JSX body 자체를 편집하는 기능 (props만 편집, JSX 구조는 자동 생성 유지)
- 새 prop 추가 기능 (Figma에 없는 prop을 생성기가 만들 수 없음)
- CSS 편집 (별도 기능)
- 편집 이력(undo/redo)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | DB `components` 테이블에 `propsOverrides` JSON 컬럼 추가 | High | Pending |
| FR-02 | 컴포넌트 페이지에 Props Editor 섹션 추가 | High | Pending |
| FR-03 | 컴포넌트명 변경 UI — DB name, 파일/폴더 이름, URL 경로, 루트 barrel 재생성 | High | Pending |
| FR-04 | Props Editor에서 각 prop 삭제/복원 토글 | High | Pending |
| FR-05 | Prop 이름 변경 UI (input + 저장) | High | Pending |
| FR-06 | Prop 기본값 편집 UI | Medium | Pending |
| FR-07 | Prop 타입 변경 UI (boolean ↔ ReactNode) | Medium | Pending |
| FR-08 | "저장" 버튼 → DB에 `propsOverrides` 업데이트 | High | Pending |
| FR-09 | "파일 재생성" 버튼 → 현재 DB 데이터로 TSX/CSS 재생성 및 파일 쓰기 | High | Pending |
| FR-10 | `runPipeline()`이 `propsOverrides`를 받아 생성 결과에 반영 | High | Pending |
| FR-11 | 플러그인 재전송 시 기존 `propsOverrides` 유지 및 병합 | High | Pending |
| FR-12 | 오버라이드가 원본 prop 이름과 다를 때 sandbox preview도 동기화 | Medium | Pending |
| FR-13 | 컴포넌트명 변경 시 기존 파일 삭제 후 새 이름으로 재생성 (무고아 파일 방지) | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 재생성 < 500ms (단일 컴포넌트) | Chrome DevTools Timing |
| UX | 편집 후 재생성까지 3 클릭 이내 | Manual test |
| Reliability | 잘못된 prop 이름/타입 입력 시 validation 에러 표시 | Zod schema |
| Backward compatibility | `propsOverrides`가 없으면 기존 동작 유지 | Unit test |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] DB migration 적용 (`propsOverrides` 컬럼 추가)
- [ ] Props Editor UI 동작 (토글/편집/저장)
- [ ] 재생성 액션이 오버라이드를 반영한 TSX/CSS 생성
- [ ] 플러그인 재전송 후에도 오버라이드 유지
- [ ] 기존 컴포넌트(오버라이드 없음)는 영향 없음
- [ ] Playwright E2E 테스트 1개 작성 (편집 → 저장 → 재생성 → 파일 검증)

### 4.2 Quality Criteria

- [ ] `npm run build` 성공
- [ ] `npm run lint` 통과
- [ ] 새 코드에 `any` 타입 없음
- [ ] 생성된 TSX가 유효한 React 컴포넌트 (TypeScript 컴파일 가능)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 오버라이드가 원본 prop과 충돌 (이름 중복) | High | Medium | 저장 시 zod validation으로 중복 체크 |
| 타입 변경(boolean → ReactNode) 시 JSX body 로직과 불일치 | High | High | 타입 변경 시 body 생성 로직이 오버라이드된 타입을 존중해야 함. 필요 시 제약 (예: 아이콘 slot만 boolean↔ReactNode 허용) |
| 편집된 prop이 Figma 재전송으로 사라진 경우 | Medium | High | 재전송 시 `componentProperties` 키 기준으로 오버라이드 매칭 → 없어진 prop의 오버라이드는 폐기 (warning 표시) |
| 재생성 실패로 파일이 깨진 상태로 저장 | High | Low | try/catch로 에러 시 rollback 또는 기존 파일 유지 |
| DB migration이 기존 프로젝트 깨뜨림 | High | Low | 마이그레이션을 `ADD COLUMN ... DEFAULT NULL`로 안전하게 추가 |
| 컴포넌트명 변경 시 URL 경로 404 | Medium | Medium | 이전 이름으로 접근 시 새 이름으로 redirect |
| 컴포넌트명 중복으로 충돌 | Medium | Medium | 저장 시 DB unique constraint + zod validation |
| 컴포넌트명 변경 후 외부 코드에서 구 이름 import 중 | Medium | Low | 경고 표시 + 사용자가 수동으로 import 경로 업데이트 |

---

## 6. Architecture Considerations

### 6.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure | Static sites | ☐ |
| **Dynamic** | Feature-based modules, DB 통합 | Web apps with backend | ☑ |
| **Enterprise** | Strict layer separation | High-traffic systems | ☐ |

PixelForge는 이미 Dynamic 레벨이고, 이 기능은 기존 구조에 추가되는 형태.

### 6.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| DB 저장 방식 | 새 테이블 / JSON 컬럼 | JSON 컬럼 | 편집은 컴포넌트당 1개, 정규화 불필요 |
| 편집 UI | 인라인 / 모달 / 별도 탭 | 인라인 (페이지 내 섹션) | 프리뷰와 함께 보며 편집 |
| 재생성 트리거 | 자동 / 수동 버튼 | 수동 버튼 | 편집 중 반복 재생성 방지 |
| 오버라이드 형식 | diff / 전체 props | 전체 props | 편집 시 UI에서 전체 상태 관리가 더 단순 |
| 타입 변경 범위 | 자유 / 제약 | 제약 (prop별 허용 타입 정의) | body 로직과 충돌 방지 |

### 6.3 Clean Architecture Approach

```
DB Schema:
  components
    + propsOverrides TEXT NULL  ← 신규 컬럼 (JSON)

Domain Layer:
  src/lib/component-generator/
    + props-override.ts         ← 신규: 오버라이드 타입, 병합 로직
    tsx-builder.ts              ← 수정: overrides 옵션 추가
    pipeline.ts                 ← 수정: overrides 전달

Actions Layer:
  src/lib/actions/components.ts
    + updatePropsOverrides(id, overrides)  ← 신규
    + regenerateComponentFiles(id)          ← 신규

UI Layer:
  src/app/(main)/(ide)/components/[name]/
    + PropsEditor.tsx           ← 신규
    + PropsEditor.module.scss   ← 신규
    ComponentGuideClient.tsx    ← 수정: PropsEditor 통합
```

---

## 7. Convention Prerequisites

### 7.1 Existing Project Conventions

- [x] `CLAUDE.md` 코딩 컨벤션
- [x] TypeScript strict (`any` 금지)
- [x] Drizzle ORM (DB 마이그레이션)
- [x] SCSS Modules
- [x] Zod schema validation
- [x] `react-hook-form` (폼 핸들링)

### 7.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **PropsOverride JSON 스키마** | 없음 | zod schema로 정의 | High |
| **재생성 액션 네이밍** | `importComponentFromJson` 패턴 | `regenerateComponentFiles` | Medium |
| **DB 마이그레이션 경로** | `drizzle/` 폴더 기존 마이그레이션 | 새 마이그레이션 파일 추가 | High |

### 7.3 Environment Variables Needed

추가 환경변수 없음.

---

## 8. Next Steps

1. [ ] Design 문서 작성 (`component-props-editor.design.md`)
2. [ ] DB 스키마 변경 검토
3. [ ] Props Editor UI 와이어프레임
4. [ ] 구현 순서 확정 (Phase 1: 재생성 액션 → Phase 2: UI → Phase 3: 고급 편집)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-10 | 초기 작성 | Jeonghak Hur |
