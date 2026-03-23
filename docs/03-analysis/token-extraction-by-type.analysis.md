# Gap Analysis: token-extraction-by-type

> Design 참조: `docs/02-design/features/token-extraction-by-type.design.md`
> 분석 일자: 2026-03-23

---

## 1. 결과 요약

| 항목 | 결과 |
|------|------|
| Match Rate | **88%** |
| 총 체크포인트 | 23개 |
| 완전 구현 | 19개 |
| 부분 구현 | 2개 |
| 미구현 (의도적) | 1개 |
| 미구현 (수정 필요) | 1개 |

```
[Plan] ✅ → [Design] ✅ → [Do] ✅ → [Check] 88% → [Act] ⏳
```

---

## 2. 체크포인트별 결과

### 2.1 DB 스키마 (5/5 ✅)

| # | 체크포인트 | 결과 | 비고 |
|---|------------|------|------|
| 1 | tokenSources 테이블 모든 필드 | ✅ | schema.ts 정확히 일치 |
| 2 | UNIQUE(project_id, type) 제약 | ✅ | drizzle unique() 사용 |
| 3 | initTables() DDL 추가 | ✅ | db/index.ts 반영 |
| 4 | migrateColumns() 불필요 확인 | ✅ | 신규 테이블, IF NOT EXISTS만으로 충분 |
| 5 | schema exports | ✅ | tokenSources 정상 export |

### 2.2 Server Actions (8/10 — 2개 부분 구현)

| # | 체크포인트 | 결과 | 비고 |
|---|------------|------|------|
| 6 | extractTokensByTypeAction 시그니처 | ✅ | 설계와 일치 |
| 7 | fileKey 유효성 검증 | ✅ | extractFileKey() 사용 |
| 8 | extractTokensAction 위임 + type 필터 | ✅ | { types: [type] } 옵션 전달 |
| 9 | token_sources UPSERT 로직 | ✅ | 기존/신규 분기 정확히 구현 |
| 10 | token_count, last_extracted_at 업데이트 | ✅ | 정상 |
| 11 | **figma_version 미저장** | ⚠️ | extractTokensAction 반환값에 version 없음 |
| 12 | captureTokenPageScreenshotAction non-blocking | ✅ | try/catch 적용 |
| 13 | playwright 설정 (url, timeout, fullPage) | ✅ | 설계 스펙 충족 |
| 14 | waitForSelector('[data-token-grid]') | ✅ | try/catch로 EmptyState도 허용 |
| 15 | **countMap이 custom type 미지원** | ⚠️ | shadow, opacity, border 타입은 count=0 반환 |

**Gap 11: figma_version 미저장**
```typescript
// 현재: figma_version 필드가 업데이트되지 않음
// 설계: token_sources 업데이트 시 figma_version 포함

// 수정 방법: extractTokensAction 반환값 또는 별도 API 호출로 버전 조회 후 저장
```

**Gap 15: custom token type count 미지원**
```typescript
// 현재:
const countMap: Record<string, number> = {
  color: result.colors,
  typography: result.typography,
  spacing: result.spacing,
  radius: result.radii,
};
const count = countMap[type] ?? 0;  // shadow/opacity/border → 항상 0

// 수정 방법: DB에서 직접 COUNT 조회
const count = db.select({ cnt: sql<number>`count(*)` })
  .from(tokens)
  .where(and(eq(tokens.projectId, projectId), eq(tokens.type, type)))
  .get()?.cnt ?? 0;
```

### 2.3 UI 컴포넌트 (6/7 — 1개 의도적 생략)

| # | 체크포인트 | 결과 | 비고 |
|---|------------|------|------|
| 16 | TokenExtractModal props 정확성 | ✅ | 설계 인터페이스 일치 |
| 17 | 상태 머신 (idle/extracting/capturing/done/error) | ✅ | step 변수로 구현 |
| 18 | zod 폼 검증 (url + figma.com refine) | ✅ | 설계 스펙 일치 |
| 19 | addBtn — count === 0이어도 표시 | ✅ | 기존 `if (count === 0) return null` 제거 |
| 20 | page.tsx parallel Promise.all 페칭 | ✅ | 정확히 구현 |
| 21 | screenshotSection img (lazy, decoding=async) | ✅ | 설계 속성 모두 포함 |
| 22 | data-token-grid — 개별 컴포넌트 대신 page.tsx 래퍼에 추가 | ✅* | 기능적으로 동일, 더 간결 |

### 2.4 runner.ts (의도적 미구현)

| # | 체크포인트 | 결과 | 비고 |
|---|------------|------|------|
| 23 | src/lib/tokens/runner.ts 신규 작성 | ⏭️ | tokens.ts → project.ts 직접 import (순환 의존 없음 확인) |

**판단:** runner.ts 생략은 설계 시 가정한 "순환 의존성 위험"이 실제로 없었음이 구현 중 확인됨. extractTokensAction을 직접 import해서 코드량 감소 + 동일 기능 달성. Gap 아님.

---

## 3. 수정 필요 항목 (2개)

### Gap A: custom type countMap (Priority: High)

**영향:** `shadow`, `opacity`, `border` 등 custom 타입으로 추출 시 token_sources.token_count = 0 저장 → UI에서 "0개 추출됨" 표시.

**수정 위치:** `src/lib/actions/tokens.ts` — `extractTokensByTypeAction`

```typescript
// BEFORE
const countMap: Record<string, number> = {
  color: result.colors,
  typography: result.typography,
  spacing: result.spacing,
  radius: result.radii,
};
const count = countMap[type] ?? 0;

// AFTER
const knownCount = ({ color: result.colors, typography: result.typography,
  spacing: result.spacing, radius: result.radii } as Record<string, number>)[type];
const count = knownCount !== undefined
  ? knownCount
  : db.select({ cnt: sql<number>`count(*)` })
      .from(tokens)
      .where(and(eq(tokens.projectId, projectId!), eq(tokens.type, type)))
      .get()?.cnt ?? 0;
```

### Gap B: figma_version 미저장 (Priority: Low)

**영향:** `token_sources.figma_version` 필드가 null로 유지됨. 캐시 무효화 기능에 활용되지 않음.

**수정 위치:** `extractTokensByTypeAction` 내 token_sources 업데이트 부분

방법 A — DB 조회 추가:
```typescript
// token_sources 업데이트 시 project.figmaVersion 조회하여 저장
const proj = db.select({ figmaVersion: projects.figmaVersion })
  .from(projects).where(eq(projects.id, projectId)).get();
// ...
.set({ figmaVersion: proj?.figmaVersion ?? null, ... })
```

방법 B — extractTokensAction 반환값 확장 (향후 이터레이션에서 처리).

**현재 권장:** 방법 A, 별도 이터레이션으로 처리.

---

## 4. 결론

| 영역 | 구현 완성도 |
|------|------------|
| DB 스키마 | 100% |
| Server Actions | 80% (2개 부분) |
| UI 컴포넌트 | 100% |
| Playwright 스크린샷 | 100% |
| **전체** | **88%** |

88%로 90% 미달. Gap A (custom type countMap)를 수정하면 90% 이상 달성 가능.
Gap B (figma_version)는 중요도가 낮아 다음 이터레이션으로 연기 가능.
