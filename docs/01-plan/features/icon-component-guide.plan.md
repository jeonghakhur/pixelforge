## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 아이콘이 `@/generated/icons`로 임포트 가능한 React 컴포넌트로 생성되어 있지만, 사용 방법·Props·라이브 프리뷰를 확인할 수 있는 상세 UI가 없어 개발자가 코드 파일을 직접 열거나 카드의 복사 버튼에만 의존해야 함 |
| **Solution** | 아이콘 카드 클릭 → `/icons/[name]` 상세 페이지로 이동. 일반 컴포넌트 가이드 페이지와 동일한 UX로 임포트 구문·Props 문서·라이브 프리뷰·코드 스니펫 제공 |
| **Function/UX Effect** | 아이콘 그리드에서 카드 클릭 시 사이드바 또는 전환 페이지로 상세 정보 표시. color picker·size slider로 실시간 프리뷰 조절, TSX 스니펫 원클릭 복사 |
| **Core Value** | 아이콘을 "문서화된 컴포넌트"로 격상 — `import { IconArrowLeft } from '@/generated/icons'` 사용법을 코드베이스 내에서 즉시 확인·검증할 수 있는 단일 진입점 |

---

# Plan: 아이콘 컴포넌트 상세 가이드 페이지

> 아이콘을 일반 컴포넌트처럼 — 상세 페이지에서 임포트·Props·라이브 프리뷰 제공

**작성**: 2026-04-17
**상태**: Draft

---

## 1. 현재 상태

### 1-1. 잘 동작하는 것 (유지)

- **아이콘 생성**: 플러그인 전송 → SVG sanitize → JSX 변환 → `src/generated/icons/Icon{Name}/Icon{Name}.tsx` 파일 자동 생성
- **배럴 파일**: `src/generated/icons/index.ts` — `export { IconArrowLeft } from './IconArrowLeft'` 자동 관리
- **아이콘 뷰어**: `/icons` 그리드 — 카테고리 탭·드래그 정렬·검색·SVG 복사·import 복사·삭제
- **아이콘 Props 구조**: `{ size?, color?, className?, width, height, ...SVGProps }`
- **생성 코드 패턴**: `fill="currentColor"` 테마 대응, `style={{ color }}` prop 연결

### 1-2. 문제점

| # | 문제 | 영향 |
|---|------|------|
| 1 | 아이콘 상세 페이지 없음 — 카드의 복사 버튼이 유일한 사용 진입점 | Props 문서, 사용 예시 확인 불가 |
| 2 | 실시간 프리뷰 없음 — 실제 렌더링 결과를 색상·크기 조합으로 확인 불가 | 테마·색상 호환성 검증 어려움 |
| 3 | 컴포넌트 가이드(`/components/[name]`)와 UX 불일치 — 아이콘은 2등 시민 취급 | 툴 내 일관성 저하 |
| 4 | 카드 클릭이 현재 아무 동작 없음 — 사용자 기대 행동(클릭=상세)과 불일치 | 발견성(discoverability) 낮음 |

---

## 2. 목표

### 2-1. 아이콘 상세 페이지 (`/icons/[name]`)

- 카드 클릭 → `/icons/[name]` 라우팅 (URL: `/icons/IconArrowLeft`)
- 페이지 구성:
  - **헤더**: 아이콘 이름, 카테고리(섹션), Figma 원본 이름
  - **라이브 프리뷰**: 아이콘 렌더링 — 배경색(light/dark), 색상 picker, 크기 slider
  - **임포트 구문**: 원클릭 복사 (`import { IconArrowLeft } from '@/generated/icons'`)
  - **Props 테이블**: width, height, color, className, size 각 설명·기본값
  - **TSX 사용 예시**: 주요 패턴 코드 스니펫 (기본, 색상 지정, 크기 지정)
  - **SVG 원본 보기**: raw SVG 코드 토글 (복사 포함)

### 2-2. 아이콘 카드 클릭 연동

- `IconCard` 컴포넌트에서 카드 전체 영역 클릭 → `router.push('/icons/[name]')` 이동
- 기존 액션 버튼(SVG 복사, import 복사, 삭제)은 `e.stopPropagation()`으로 독립 유지

### 2-3. 라이브 프리뷰 인터랙션

- **색상 picker**: HEX 직접 입력 + preset 팔레트 (primary, secondary, muted, danger 등 CSS 변수 기반)
- **크기 slider**: 16px ~ 64px 범위, 4px step
- **테마 토글**: light / dark 배경 전환
- 선택 값에 따라 `<Icon{Name} color="..." width={N} height={N} />` 미리보기 실시간 반영

### 2-4. 아이콘 데이터 서버 액션

- `getIconByName(name: string)` — DB에서 단일 아이콘 조회 (`{ name, svg, section }`)
- `getIconsList()` — 전체 아이콘 목록 조회 (상세 페이지 뒤로가기 후 목록 복원용)

---

## 3. 범위

### In Scope

- `/icons/[name]` 서버 컴포넌트 (DB 조회) + 클라이언트 컴포넌트 (프리뷰 인터랙션)
- `IconCard` 클릭 핸들러 추가 (라우팅)
- `getIconByName` 서버 액션 추가
- Props 테이블 정적 정의 (width, height, color, className, size)
- TSX 코드 스니펫 생성 (사용 중인 값 기반 동적 업데이트)
- 페이지 SCSS 모듈 (`page.module.scss` 확장 또는 신규)
- 뒤로가기 버튼 → 이전 카테고리·스크롤 위치 유지 (쿼리스트링 기반)

### Out of Scope

- 아이콘을 `src/generated/components/`로 이전하거나 컴포넌트 파이프라인과 통합
- iframe sandbox (아이콘은 props 구조가 단순해 동적 import 불필요)
- 아이콘 편집 기능 (이름 변경, SVG 수정)
- 아이콘 버전 히스토리 비교

---

## 4. 기술 설계

### 4-1. 라우팅 구조

```
src/app/(main)/(ide)/icons/
  page.tsx                 ← 기존 (그리드)
  [name]/
    page.tsx               ← 신규 (상세 페이지, 서버 컴포넌트)
    IconDetailClient.tsx   ← 신규 (프리뷰 인터랙션, 클라이언트)
    page.module.scss       ← 신규
```

### 4-2. 데이터 흐름

```
page.tsx (server)
  └─ getIconByName(name)       ← DB syncPayloads 조회
      └─ { name, svg, section }
  └─ toComponentName(name)     ← lib/icons/generate.ts 재사용
  └─ IconDetailClient(props)
        ├─ import * as Icons from '@/generated/icons'  ← 정적 임포트
        ├─ Icons[`Icon${componentName}`]               ← 동적 접근
        └─ 렌더링: 색상·크기 state로 조절
```

### 4-3. 아이콘 동적 렌더링

`IconGrid.tsx`와 동일 패턴 — `import * as GeneratedIcons from '@/generated/icons'` 정적 임포트 후 런타임 키 접근:
```tsx
const Comp = GeneratedIcons[`Icon${componentName}`] as React.ComponentType<...>
```
iframe 불필요 — 아이콘은 SVGProps만 받으므로 직접 렌더링 가능.

### 4-4. Props 테이블 정의

```ts
const ICON_PROPS = [
  { name: 'width',     type: 'number',  default: '24',       desc: '아이콘 너비 (px)' },
  { name: 'height',    type: 'number',  default: '24',       desc: '아이콘 높이 (px)' },
  { name: 'color',     type: 'string',  default: 'inherit',  desc: 'CSS color 값 — style.color로 적용 (fill="currentColor" 상속)' },
  { name: 'size',      type: '"default"', default: 'undefined', desc: '사이즈 variant — 현재 "default" 단일값' },
  { name: 'className', type: 'string',  default: 'undefined', desc: '추가 CSS 클래스' },
]
```

### 4-5. TSX 스니펫 동적 생성

프리뷰 state 값 기반으로 코드 스니펫 실시간 업데이트:
```tsx
// 기본 사용
<IconArrowLeft width={32} height={32} />

// 색상 지정
<IconArrowLeft color="#4ade80" width={32} height={32} />

// 테마 CSS 변수 사용
<IconArrowLeft color="var(--text-primary)" width={24} height={24} />
```

---

## 5. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | `getIconByName` 서버 액션 추가 | `src/lib/actions/icons.ts` |
| 2 | `/icons/[name]/page.tsx` 서버 컴포넌트 | 신규 |
| 3 | `IconDetailClient.tsx` — 프리뷰·controls | 신규 |
| 4 | `page.module.scss` — 상세 페이지 스타일 | 신규 |
| 5 | `IconCard` 클릭 핸들러 추가 (라우팅 연결) | `IconGrid.tsx` |
| 6 | 뒤로가기: 그리드 스크롤 위치 복원 | `IconGrid.tsx` + `[name]/page.tsx` |

---

## 6. 검증 기준

| 항목 | 기준 |
|------|------|
| 상세 페이지 접근 | 아이콘 카드 클릭 → `/icons/IconArrowLeft` 이동 |
| 프리뷰 렌더링 | 생성된 React 컴포넌트가 실제 렌더링 (placeholder 아님) |
| 색상 변경 | color picker 값 → 아이콘 색상 실시간 반영 |
| 크기 변경 | slider 값 → width/height 실시간 반영 |
| 임포트 복사 | 클립보드에 `import { IconArrowLeft } from '@/generated/icons'` 복사 |
| 스니펫 동기화 | 색상·크기 변경 시 코드 스니펫도 같이 업데이트 |
| 뒤로가기 | 이전 카테고리 위치로 복귀 |
| 없는 아이콘 | 잘못된 `[name]` → 404 또는 그리드로 리다이렉트 |
