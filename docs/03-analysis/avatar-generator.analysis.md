# Gap Analysis: Avatar Generator

_Design vs Implementation — `avatar-generator.design.md` 기준_

---

## Executive Summary

| 항목 | 결과 |
|------|------|
| **Match Rate** | **100%** (11/11) + 보안/품질 초과 달성 6건 |
| 설계 성공 기준 | 11개 |
| 충족 (✅) | 11개 |
| 초과 달성 (✅+) | 6건 |
| 미충족 (❌) | 0개 |
| 분석일 | 2026-04-16 |

```
[Plan] ✅ → [Design] ✅ → [Do] ✅ → [Check] 100% ✅ → Act: 불필요 (≥90%)
```

---

## 1. 파일별 구현 상태

| 파일 | 설계 섹션 | 상태 |
|------|-----------|:----:|
| `generators/avatar/extract.ts` | §3 | ✅ |
| `generators/avatar/index.ts` | §4 | ✅ |
| `detect.ts` | §2-2 | ✅ |
| `generators/registry.ts` | §2-3 | ✅ |
| `AvatarImage.tsx` | §4-2 | ✅ |
| `AvatarImage.module.css` | §4-3 | ✅ |

---

## 2. 성공 기준 검증 (Design §8 전체 11개)

| # | 성공 기준 | 상태 | 구현 위치 |
|---|----------|:----:|-----------|
| 1 | GENERIC_FALLBACK 경고 없음 (전용 제너레이터 사용) | ✅ | `detect.ts:14` + `registry.ts:25` |
| 2 | `forwardRef` + `data-shape` + `data-size` + `figure` | ✅ | `AvatarImage.tsx:23, 40-44` |
| 3 | `shape='circle'` → `50%`, `square` → `var(--radius-md)` | ✅ | `AvatarImage.module.css:24-29` |
| 4 | `size='sm/md/lg'` → `160/240/320px` | ✅ | `AvatarImage.module.css:32-34` |
| 5 | Name → `var(--text-primary)`, Source → `var(--text-tertiary)` | ✅ | `AvatarImage.module.css:44, 52` |
| 6 | Source `text-decoration: underline` 조건부 포함 | ✅ | `index.ts:hasUnderline` 분기 |
| 7 | font-size/line-height → 토큰 변수 출력 | ✅ | `extract.ts` mapFontSizeValue 등 |
| 8 | DB 저장 + 파일 생성 (버튼과 동일 경로) | ✅ | `generateAvatar → GeneratorOutput` |
| 9 | `tsx-builder.ts` 미수정 | ✅ | 구현 파일에 포함되지 않음 |
| 10 | `registry.ts` `GeneratorFn` 시그니처 변경 없음 | ✅ | `registry.ts:18-21` |
| 11 | `npm run build` + `npm run lint` 통과 | ✅ | 확인 완료 |

---

## 3. 설계 초과 달성 항목 (✅+ 보안/품질 개선)

설계 작성 이후 보안 분석을 통해 추가 적용된 개선사항 — 모두 긍정적 구현:

| # | 항목 | 설계 | 구현 | 이유 |
|---|------|------|------|------|
| A | 이미지 렌더링 | `<div style={backgroundImage}>`  | `<img> + isSafeUrl()` | **CSS injection 취약점 차단** |
| B | `name` prop | `name?: string` | `displayName?: string` | HTML `name` attribute 충돌 방지 |
| C | `role` prop | `role?: string` | `jobTitle?: string` + `Omit<..., 'role'>` | HTML ARIA `role` attribute 충돌 방지 |
| D | placeholder 배경 토큰 | `var(--surface-secondary)` | `var(--bg-secondary)` | 실제 존재하는 토큰으로 교정 |
| E | Props 타입 | `React.HTMLAttributes<HTMLElement>` | `Omit<React.HTMLAttributes<HTMLElement>, 'role'>` | `role` prop 재정의 충돌 회피 |
| F | 파서 호환성 | `export type …` | `export type …;` (세미콜론) | Sandbox prop 파서 호환성 |

---

## 4. 추가 구현 우수 사항

| # | 내용 | 위치 | 평가 |
|---|------|------|------|
| G | childStyles 키 유연 매칭 (`toLowerCase()`) | `extract.ts` | 🟢 Figma 노드명 변경에 견고 |
| H | `<img loading="lazy" decoding="async">` | `AvatarImage.tsx` | 🟢 성능 최적화 |
| I | `AvatarImageShape` / `AvatarImageSize` 타입 export | `AvatarImage.tsx:4-5` | 🟢 외부 소비자 DX 향상 |
| J | `[styles.root, className].filter(Boolean).join(' ')` | `AvatarImage.tsx` | 🟢 `undefined`/빈 문자열 안전 |
| K | `altText = displayName \|\| jobTitle \|\| ''` | `AvatarImage.tsx:37` | 🟢 접근성 fallback |
| L | placeholder `<div aria-hidden="true">` | `AvatarImage.tsx:55` | 🟢 보조기술 노출 차단 |

---

## 5. 설계 문서 업데이트 권장 (v1.1)

| 항목 | 내용 |
|------|------|
| §4-2 TSX 예시 | `<div backgroundImage>` → `<img> + isSafeUrl()` 패턴으로 교체 |
| §4-2 Props | `name` → `displayName`, `role` → `jobTitle` |
| §4-3 CSS | `--surface-secondary` → `--bg-secondary` |
| §9 의존성 | `--surface-secondary` → `--bg-secondary` |

---

## 6. 결론

**Match Rate 100%** — 설계 성공 기준 11개 전부 충족.  
추가로 6건 보안/품질 개선 + 6건 구현 우수 사항으로 설계 초과 달성.

- `/pdca iterate` **불필요** (Match Rate ≥ 90%)
- `/pdca report avatar-generator` 진행 가능
