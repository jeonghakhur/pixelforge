## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 플러그인에서 아이콘을 전송해도 DB에만 저장되고, React 컴포넌트로 변환되지 않으며, 전용 뷰어 UI도 없어 아이콘을 확인하거나 활용할 방법이 없음 |
| **Solution** | 전송된 SVG를 sanitize → currentColor 정규화 → JSX 속성 변환 순으로 처리해 React 컴포넌트 파일을 자동 생성하고, 검색·복사 기능이 있는 전용 뷰어 페이지를 제공 |
| **Function/UX Effect** | 플러그인에서 "PixelForge로 전송" 클릭 즉시 `/icons` 페이지에 그리드 형태로 표시, 이름 검색 및 import 구문 복사 가능 |
| **Core Value** | Figma 아이콘 → React 컴포넌트 자동화로 디자인-코드 일관성 유지, 개발자가 즉시 `import { ArrowLeftIcon } from '@/generated/icons'` 형태로 활용 가능 |

---

# Plan: 아이콘 뷰어 — SVG → React 컴포넌트 자동 생성 + 전용 UI

> 플러그인 아이콘 전송 → 파일 자동 생성 → 전용 뷰어 페이지

**작성**: 2026-04-17
**상태**: Draft

---

## 1. 현재 상태

### 1-1. 잘 동작하는 것 (유지)

- **플러그인 전송**: `POST /api/sync/icons` → `sync_payloads` 테이블에 `{ name, svg }[]` JSON 저장
- **버전 관리**: SHA-256 해시 비교로 중복 저장 방지, 변경 시 version 자동 증가
- **Admin 표시**: `/admin` 페이지에서 버전 번호 확인 가능

### 1-2. 문제점

| # | 문제 | 영향 |
|---|------|------|
| 1 | 아이콘 데이터가 DB에만 저장, React 파일 미생성 | `import { XIcon }` 사용 불가 |
| 2 | SVG에 Figma 고유 속성 잔존 (하드코딩 fill 색상, `class` 속성 등) | 테마와 분리된 고정 색상 |
| 3 | XSS 위험 요소 미제거 (`<script>`, `on*` 핸들러 등) | 보안 취약점 |
| 4 | 전용 뷰어 UI 없음 | 아이콘 확인·검색 불가 |
| 5 | 사이드바/ActivityBar에 아이콘 섹션 없음 | 네비게이션 진입점 없음 |

---

## 2. 목표

### 2-1. SVG → React 컴포넌트 자동 생성
- 전송 즉시 `src/generated/icons/{IconName}/{IconName}.tsx` 생성
- SVG sanitize: `<script>`, `on*`, `javascript:` href 제거
- 단색 fill → `currentColor` 변환 (멀티컬러는 원본 유지)
- HTML 속성 → JSX 속성 변환 (`fill-rule` → `fillRule` 등)
- `src/generated/icons/index.ts` barrel export 자동 관리

### 2-2. 전용 뷰어 UI (`/icons`)
- `sync_payloads`에서 최신 아이콘 데이터 읽어 그리드 표시
- 아이콘 이름 검색 (실시간 필터)
- 아이콘 카드: SVG 미리보기 + 이름 + 복사 버튼 (SVG 복사 / import 구문 복사)
- 활성 프로젝트의 아이콘만 표시

### 2-3. 네비게이션 추가
- `ActivityBar`에 `icons` 섹션 추가 (solar:shapes-linear 아이콘)
- `AppShell`에 `/icons` 라우팅 연결

---

## 3. 범위

### 3-1. In Scope

- [ ] `src/lib/icons/generate.ts` — SVG → React 컴포넌트 생성기
- [ ] `/api/sync/icons/route.ts` 업데이트 — 저장 후 파일 생성 트리거
- [ ] `src/generated/icons/` — 생성된 아이콘 컴포넌트 파일
- [ ] `src/app/(main)/(ide)/icons/page.tsx` — 서버 컴포넌트 (DB 읽기)
- [ ] `src/app/(main)/(ide)/icons/IconGrid.tsx` — 클라이언트 컴포넌트 (검색·복사)
- [ ] `src/app/(main)/(ide)/icons/page.module.scss` — 스타일
- [ ] `ActivityBar.tsx` — `icons` 섹션 추가
- [ ] `AppShell.tsx` — `/icons` 라우팅 추가

### 3-2. Out of Scope

- 아이콘 편집 기능 (SVG 수정, 색상 변경)
- 아이콘 카테고리 분류 관리 (Admin UI)
- 아이콘 다운로드 (ZIP 등)
- SSE 실시간 알림 (icons sync 시) — 추후 고려

---

## 4. 요구사항

### 4-1. 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-01 | `/api/sync/icons` 수신 즉시 React 컴포넌트 파일 생성 | High |
| FR-02 | SVG sanitize — `<script>`, `on*`, `javascript:` href 제거 | High |
| FR-03 | 단색 fill → `currentColor` 변환 (고유 fill 색상이 1종일 때만) | High |
| FR-04 | JSX 속성 변환 (`fill-rule` → `fillRule`, `class` → `className` 등) | High |
| FR-05 | Figma 이름 → PascalCase 변환 (`icon/arrow-left` → `ArrowLeft`) | High |
| FR-06 | 동일 이름 충돌 시 번호 suffix (`ArrowLeft`, `ArrowLeft2`) | Medium |
| FR-07 | 재전송 시 기존 파일 전체 삭제 후 재생성 (전체 갱신) | High |
| FR-08 | `/icons` 페이지에서 그리드 형태로 아이콘 표시 | High |
| FR-09 | 이름 실시간 검색 필터 | High |
| FR-10 | 아이콘 카드에서 SVG 복사 / import 구문 복사 | Medium |
| FR-11 | ActivityBar에 Icons 섹션 추가 | High |

### 4-2. 비기능 요구사항

| 카테고리 | 기준 | 측정 방법 |
|---------|------|---------|
| 보안 | SVG XSS 방지 (script, on* 제거) | 코드 리뷰 |
| 성능 | 500개 아이콘 생성 < 5초 | 로컬 측정 |
| 접근성 | WCAG AA, `aria-label` 포함 | 코드 리뷰 |
| 타입 안전성 | `any` 미사용, strict TypeScript | `npm run build` |

---

## 5. 기술 결정

### 5-1. 아이콘 데이터 소스

- **뷰어 UI**: `sync_payloads` 테이블 (DB-only read) — 파일 시스템이 아닌 DB에서 직접 읽어 렌더링
- **이유**: SVG 원본이 DB에 있으므로 파일 생성 실패 시에도 뷰어는 동작 가능

### 5-2. 파일 생성 전략

- **타이밍**: `upsertSyncPayload` 후 동기 호출 (route.ts 내부)
- **갱신 방식**: 전체 재생성 — `src/generated/icons/` 디렉터리 클리어 후 재기록
- **이유**: 삭제된 아이콘이 파일로 잔존하는 것을 방지

### 5-3. 컴포넌트 형태

```tsx
// src/generated/icons/ArrowLeft/ArrowLeft.tsx
import type { SVGProps } from 'react';

export function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path fillRule="evenodd" d="..." fill="currentColor" />
    </svg>
  );
}

export default ArrowLeftIcon;
```

### 5-4. 이름 변환 규칙

| Figma 이름 예시 | 변환 결과 |
|---------------|---------|
| `icon/arrow-left` | `ArrowLeft` |
| `arrow-left` | `ArrowLeft` |
| `Icon=Default, Name=close` | `Close` |
| `ic_home` | `IcHome` |

---

## 6. 폴더 구조

```
src/
├── lib/icons/
│   └── generate.ts          # SVG → React 생성기
├── generated/icons/
│   ├── ArrowLeft/
│   │   ├── ArrowLeft.tsx
│   │   └── index.ts
│   ├── Close/
│   │   ├── Close.tsx
│   │   └── index.ts
│   └── index.ts             # barrel export
└── app/(main)/(ide)/icons/
    ├── page.tsx              # 서버 컴포넌트
    ├── IconGrid.tsx          # 클라이언트 컴포넌트
    └── page.module.scss
```

---

## 7. 리스크

| 리스크 | 영향 | 가능성 | 대응 |
|-------|------|--------|------|
| SVG 속성 변환 누락으로 JSX 빌드 에러 | High | Medium | 포괄적 속성 맵 + `npm run build` 검증 |
| 대량 아이콘(500+) 파일 생성 시 route timeout | Medium | Low | 생성은 비동기, 응답 먼저 반환 고려 |
| Figma 이름 충돌로 덮어쓰기 | Medium | Low | suffix 번호 부여 로직 |
| 멀티컬러 아이콘의 currentColor 오변환 | Medium | Medium | 단색 여부 체크 로직 엄격 적용 |

---

## 8. 완료 기준

- [ ] `npm run build` 성공
- [ ] `npm run lint` 통과
- [ ] 플러그인 전송 후 `src/generated/icons/` 파일 자동 생성
- [ ] `/icons` 페이지에서 아이콘 그리드 표시
- [ ] 검색 필터 동작
- [ ] import 구문 복사 동작
- [ ] ActivityBar에서 `/icons` 진입 가능

---

## 9. 구현 순서

1. `src/lib/icons/generate.ts` 작성
2. `/api/sync/icons/route.ts` 업데이트
3. `src/app/(main)/(ide)/icons/` 페이지 구현
4. `ActivityBar` + `AppShell` 네비게이션 추가
5. `npm run build` + `npm run lint` 검증
