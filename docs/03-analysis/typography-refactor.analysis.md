# Analysis: typography-refactor

_TypographyList 범용 재설계 — Gap Analysis Report_

---

## Executive Summary

| Item | Result |
|------|--------|
| **Match Rate** | **98%** |
| Total Checkpoints | 10 |
| Fully Matched | 9 |
| Minor Deviation | 1 |
| Missing / Mismatched | 0 |

```
[Plan] ✅ → [Design] ✅ → [Do] ✅ → [Check] 98% ✅ → Act: 불필요 (≥90%)
```

---

## 1. 파일별 구현 상태

| 파일 | 예상 변경 | 상태 |
|------|-----------|:----:|
| `src/app/(main)/(ide)/tokens/[type]/TypographyList.tsx` | 범용 알고리즘으로 전면 교체 | ✅ |
| `src/lib/tokens/css-generator.ts` (L473-477) | `familySlug`: `parsed.category` 우선 | ✅ |
| `src/app/(main)/(ide)/tokens/[type]/page.tsx` | `text-style`/`heading` 분기 삭제 | ✅ |

---

## 2. Checkpoint 검증 (10개)

| # | 요구사항 (design §) | 상태 |
|---|---------------------|:----:|
| 1 | §2.1, §6 — `SIZE_ORDER`/`WEIGHT_ORDER` 및 관련 타입 완전 삭제 | ✅ |
| 2 | §2.3 — `PURE_WEIGHT_REGEX`, `WEIGHT_SUFFIX_REGEX`, `groupKey()` 설계 동일 구현 | ✅ |
| 3 | §2.3 — `buildScaleMap()`: insertion order, fontWeight asc, label/fontSize/variants 구조 | ⚠️ |
| 4 | §2.4 — `toCssVar` 삭제 + `toVarName`/`TYPE_PREFIX` import | ✅ |
| 5 | §2.6 — `font: var(${variantVar}, ${fallbackFont})` CSS var + inline fallback | ✅ |
| 6 | §2.3.1 — `firstSegCount` + `sectionHeaderBefore` Set, multi-group 첫 entry에만 헤더 | ✅ |
| 7 | §3.1 — `familySlug`: `parsed.category` 우선, `sizeSlug.startsWith('display')` fallback | ✅ |
| 8 | §4 — `page.tsx` `text-style`/`heading` 분기 삭제 | ✅ |
| 9 | §2.7 — `parsePrimitiveTokens` 분류 로직 유지, `toVarName` 교체 | ✅ |
| 10 | §6 — `parseName`, `parseScaleTokens`, `formatScaleLabel`, `ScaleCell`, `TypeScaleMap` 삭제 | ✅ |

### 2.1 Minor Deviation — ScaleEntry `nameSlug` 필드 누락

**Design §2.2** 명세:
```typescript
type ScaleEntry = {
  label: string;
  nameSlug: string;   // CSS var 슬러그 (toVarName 기준)
  fontSize: number;
  variants: VariantEntry[];
};
```

**실제 구현** (`TypographyList.tsx` L29-33):
```typescript
interface ScaleEntry {
  label: string;
  fontSize: number;
  variants: VariantEntry[];
}
```

- `nameSlug` 필드 없음. `buildScaleMap` 반환값도 `{label, fontSize, variants}` — nameSlug 미포함.
- **영향 없음**: 렌더 코드가 `toVarName(variant.tokenName, ...)` per-variant 방식으로 CSS var를 직접 도출하므로 entry-level slug 불필요.
- **판정**: 🟢 YAGNI 관점에서 더 나은 구현. 미사용 필드를 제거한 것.

---

## 3. 추가 개선 (설계 초과)

| # | 내용 | 위치 |
|---|------|------|
| A | `font: var(variantVar, fallback)` — CSS var 미로드 시 fallback 적용 | L342-350 |
| B | `displayLabel` — 섹션 헤더 있는 경우 첫 path segment 제거해 표시 | L311-313 |
| C | `uniqueWeights` — 전체 고유 fontWeight 동적 수집 (화이트리스트 없음) | L249-251 |

---

## 4. 종합

**Match Rate: 98%** — 이터레이션 불필요.

단 하나의 편차(`nameSlug` 필드)는 설계 문서에서 명세했지만 실제 렌더에서 사용하지 않는 dead 필드로, 제거한 구현이 오히려 더 낫다. Design §2.2 명세를 실제 구현에 맞게 사후 정정 권장.

---

## 5. 후속 조치

- [x] Gap analysis 완료 (≥90%)
- [ ] Design doc §2.2 `ScaleEntry`에서 `nameSlug` 제거 (선택)
- [ ] `/pdca report typography-refactor` 실행 가능

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-04-15 | 초기 분석 — Match Rate 98%, `nameSlug` 편차 1건 |
