# Design System — PixelForge

## Vantablack Luxe 다크 테마

### 색상 토큰 (SCSS 변수 — `_variables.scss`)

| 계층 | SCSS 변수 | 값 | 용도 |
|------|----------|-----|------|
| Zinc 스케일 | `$zinc-950` | `#09090b` | 최하단 배경 (body) |
| | `$zinc-900` | `#18181b` | 카드/패널 배경 (surface) |
| | `$zinc-800` | `#27272a` | hover/elevated 배경 |
| | `$zinc-700` | `#3f3f46` | 스크롤바, 비활성 보더 |
| | `$zinc-500` | `#71717a` | muted 텍스트 |
| | `$zinc-400` | `#a1a1aa` | secondary 텍스트 |
| | `$zinc-100` | `#f4f4f5` | primary 텍스트 |
| 액센트 | `$blue-500` | `#3b82f6` | CTA, 활성 상태, 링크 |
| | `$blue-600` | `#2563eb` | 라이트 모드 액센트 |
| 시맨틱 | `$danger` | `#f87171` | 에러, 삭제 |
| | `$warning` | `#fbbf24` | 경고 |
| | `$success` | `#34d399` | 성공, 통과 |
| | `$info` | `#60a5fa` | 정보 |

### CSS 변수 (런타임 테마 — `globals.scss`)

| 변수 | 다크 모드 | 라이트 모드 | 용도 |
|------|----------|-----------|------|
| `--bg-body` | `$zinc-950` | `$zinc-50` | 페이지 배경 |
| `--bg-surface` | `$zinc-900` | `$white` | 카드/패널 |
| `--bg-elevated` | `$zinc-800` | `$zinc-100` | 중첩/hover |
| `--text-primary` | `$zinc-100` | `$zinc-950` | 주요 텍스트 |
| `--text-secondary` | `$zinc-400` | `$zinc-600` | 보조 텍스트 |
| `--text-muted` | `$zinc-500` | `$zinc-500` | 라벨/캡션 |
| `--accent` | `$blue-500` | `$blue-600` | 강조색 |
| `--border-color` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` | 테두리 |
| `--border-focus` | `$blue-500` | `$blue-600` | 포커스 링 |

### 글래스 효과 (다크 전용)

```scss
$glass-bg:        rgba(255, 255, 255, 0.05);
$glass-border:    rgba(255, 255, 255, 0.08);
$glass-highlight: rgba(255, 255, 255, 0.1);
$glass-shadow:    inset 0 1px 1px rgba(255, 255, 255, 0.15);
```

### 트랜지션

```scss
$transition-spring:  all 0.5s cubic-bezier(0.16, 1, 0.3, 1);  // 기본
$transition-fast:    all 0.3s cubic-bezier(0.16, 1, 0.3, 1);  // 빠른 반응
```

**금지:** `linear`, `ease-in-out` 트랜지션. 항상 스프링 커브 사용.

## 타이포그래피

| 요소 | 크기 | 굵기 | 행간 |
|------|------|------|------|
| 페이지 제목 | `$font-size-2xl` (24px) | 700 (bold) | `$line-height-tight` |
| 섹션 제목 | `$font-size-lg` (18px) | 600 (semibold) | `$line-height-tight` |
| 본문 | `$font-size-base` (16px) | 400 (normal) | `$line-height-base` |
| 보조 텍스트 | `$font-size-sm` (14px) | 400 (normal) | `$line-height-base` |
| 캡션/라벨 | `$font-size-xs` (12px) | 500 (medium) | `$line-height-snug` |

**폰트 스택:**
- 한국어 기본: `Pretendard`, `-apple-system`, `BlinkMacSystemFont`, `system-ui`, `sans-serif`
- 코드: `Geist Mono`, `JetBrains Mono`, `Fira Code`, `monospace`
- **금지:** Inter, Noto Sans KR, Roboto, Arial, Open Sans

### 한국어 텍스트 규칙
- `word-break: keep-all` — 한국어 단어 분리 방지
- `leading-tight` ~ `leading-snug` — 한국어는 라틴보다 행간 필요

## 간격 시스템 (8px 기반)

| 단계 | 값 | SCSS |
|------|-----|------|
| 0 | 0 | `map-get($spacers, 0)` |
| 1 | 4px | `map-get($spacers, 1)` |
| 2 | 8px | `map-get($spacers, 2)` |
| 3 | 16px | `map-get($spacers, 3)` |
| 4 | 24px | `map-get($spacers, 4)` |
| 5 | 32px | `map-get($spacers, 5)` |
| 6 | 48px | `map-get($spacers, 6)` |
| 7 | 64px | `map-get($spacers, 7)` |
| 8 | 80px | `map-get($spacers, 8)` |

## 둥근 모서리

| 토큰 | 값 | 용도 |
|------|-----|------|
| `$border-radius-sm` | 6px | 입력 필드, 배지 |
| `$border-radius` | 8px | 기본 |
| `$border-radius-lg` | 12px | 카드, 모달 |
| `$border-radius-xl` | 16px | 큰 카드 |
| `$border-radius-pill` | 50rem | pill 탭, 태그 |

## WCAG AA 체크리스트

### 명도 대비

| 요소 | 최소 대비 | 확인 |
|------|----------|------|
| 일반 텍스트 (16px 이하) | **4.5:1** | `--text-primary` on `--bg-body` |
| 큰 텍스트 (18px+ bold) | **3:1** | `--text-secondary` on `--bg-body` |
| UI 컴포넌트/아이콘 | **3:1** | `--accent` on `--bg-body` |
| 비활성 요소 | 면제 | `--text-muted` |

### 인터랙션

- [ ] 모든 인터랙티브 요소: `cursor: pointer`
- [ ] 포커스 링: `:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }`
- [ ] 모달: 포커스 트랩 + ESC 닫기 + body 스크롤 차단
- [ ] 폼: `label htmlFor` + `aria-invalid` + `aria-describedby`
- [ ] 키보드: Tab 순서 논리적, 모든 기능 키보드 접근 가능

### 시맨틱 HTML

| 상황 | 올바른 태그 | 금지 |
|------|------------|------|
| 클릭 동작 | `<button>` | `<div onClick>` |
| 페이지 이동 | `<Link>` | `<div onClick={navigate}>` |
| 목록 | `<ul>/<ol>` | `<div>` 나열 |
| 표 데이터 | `<table>` + `<th>` | `<div>` 격자 |

## IDE 레이아웃 토큰

```css
:root {
  --activity-bar-width: 48px;
  --tab-bar-height: 35px;
  --status-bar-height: 24px;
  --content-padding: 20px;
}
```

## 컴포넌트 패턴

### 카드 (Double-Bezel)

```scss
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: $border-radius-lg;  // 12px
  padding: map-get($spacers, 4);     // 24px
  transition: $transition-spring;
}
```

### 버튼

```scss
// Primary CTA
.btnPrimary {
  height: 40px;
  padding: 0 map-get($spacers, 4);
  background: var(--accent);
  color: $white;
  border: none;
  border-radius: $border-radius;
  font-weight: $font-weight-semibold;
  font-size: $font-size-sm;
  transition: $transition-fast;

  &:hover { opacity: 0.9; transform: scale(1.02); }
  &:active { transform: scale(0.98); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}

// Ghost
.btnGhost {
  height: 40px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: $border-radius;
}
```

### 모달

```scss
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 50;
}

.dialog {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: $border-radius-xl;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}
```

## 안티패턴 (금지)

- 그라데이션 배경 (보라/파란 AI 스타일)
- `#000000` 순수 검정 (`$zinc-950` 사용)
- 과채도 색상 (채도 80% 초과)
- 3열 균등 카드 그리드 (비대칭 Bento 선호)
- `h-screen` (`min-h-[100dvh]` 사용)
- 이모지 (아이콘으로 대체)
- `shadow-md` 과도한 그림자 (다크 테마에서 불필요)
