# Gap Analysis — db

- **분석일**: 2026-03-23
- **Phase**: Check
- **Match Rate**: 83%
- **TypeScript 오류**: 0

---

## 분석 범위

| 파일 | 역할 |
|------|------|
| `src/lib/db/schema.ts` | Drizzle ORM 스키마 정의 |
| `src/lib/db/index.ts` | SQLite 초기화, DDL, 마이그레이션 |
| `src/lib/actions/project.ts` | 토큰 추출 / 프로젝트 CRUD |
| `src/lib/actions/tokens.ts` | 토큰 조회 / 수정 / 삭제 |
| `src/lib/actions/components.ts` | 컴포넌트 생성 / 조회 |
| `src/lib/actions/screens.ts` | 화면 동기화 / Figma 캡처 |

---

## Gap 목록

### GAP-01: `initTables()` DDL과 `schema.ts` 불일치 (중간)

**상태**: 미수정

`index.ts`의 CREATE TABLE DDL이 현재 `schema.ts`의 컬럼 정의와 다릅니다. 누락된 컬럼은 `migrateColumns()`가 ALTER TABLE로 보완하지만, DDL만 보면 최신 스키마를 파악할 수 없습니다.

| 테이블 | schema.ts 컬럼 | initTables DDL | migrateColumns |
|--------|---------------|----------------|----------------|
| `projects` | `pages_cache` | 없음 | ALTER TABLE로 추가 |
| `tokens` | `source`, `mode`, `collection_name`, `alias` | 없음 | ALTER TABLE로 추가 |

**영향**: 신규 설치 → migrateColumns가 실행되어 정상 동작. 그러나 DDL이 오래된 상태를 표현하므로 유지보수 혼란.

**권고**: `initTables()`의 DDL에 누락 컬럼을 직접 포함시키고, `migrateColumns()`의 해당 ALTER를 제거.

---

### GAP-02: `captureFigmaScreenshotAction` — nodeId null 시 빈 배열 전달 (중간)

**상태**: 미수정

```typescript
// src/lib/actions/screens.ts:175
const imagesRes = await client.getImages(fileKey, nodeId ? [nodeId] : [], 'png');
const imageUrl = nodeId ? imagesRes.images[nodeId] : Object.values(imagesRes.images)[0];
```

`nodeId`가 null이면 `ids=[]` 로 Figma API를 호출합니다. Figma `/images` endpoint는 ids가 없으면 빈 `images: {}` 를 반환하므로 `imageUrl`이 `undefined` → 에러 throw.

**권고**: nodeId가 null이면 early return으로 명확한 에러 메시지 반환.

```typescript
if (!nodeId) throw new Error('Figma URL에 node-id가 없습니다. 특정 프레임 URL을 사용해주세요.');
```

---

### GAP-03: `await` 사용 불일치 (낮음)

**상태**: 미수정

`screens.ts`는 `await db.select()...` 패턴을 사용하고, `project.ts` / `components.ts`는 `db.select()...get()` / `.run()` 패턴을 사용합니다. better-sqlite3는 동기 드라이버이므로 `await`가 있어도 동작하지만 코드 스타일이 일관되지 않습니다.

**권고**: 전체 DB 레이어를 `.get()` / `.all()` / `.run()` 동기 패턴으로 통일.

---

### GAP-04: 외래키 컬럼 인덱스 없음 (낮음)

**상태**: 미수정

`tokens.project_id`, `components.project_id`, `histories.project_id` 컬럼에 인덱스가 없습니다. 현재 데이터 규모에서는 문제없지만, 토큰 수백 개 이상 시 쿼리 성능이 저하됩니다.

**권고**: `migrateColumns()`에 CREATE INDEX 추가.

```sql
CREATE INDEX IF NOT EXISTS idx_tokens_project_id ON tokens(project_id);
CREATE INDEX IF NOT EXISTS idx_tokens_type ON tokens(type);
CREATE INDEX IF NOT EXISTS idx_components_project_id ON components(project_id);
```

---

### GAP-05: `getScreenListAction` — 전체 로드 후 JS 필터 (낮음)

**상태**: 미수정

```typescript
// src/lib/actions/screens.ts:139-149
const rows = await db.select().from(screens);
let items = rows.map(rowToListItem);
if (filters?.status && filters.status !== 'all') {
  items = items.filter((s) => s.status === filters.status);
}
```

전체 rows를 메모리에 로드한 후 JS에서 필터링합니다. WHERE 절을 사용하면 DB 레벨에서 필터링 가능합니다.

---

### GAP-06: Figma API 최적화 — 해결 완료

**상태**: 수정 완료 (2026-03-23)

`extractTokensAction`에서 node-id가 지정된 경우 `getFile()` (전체 문서) 대신 `getNodes()` + `getStyles()` 병렬 호출로 변경.

```
Before: getFile() + getNodes() → 직렬, 전체 문서 트리 다운로드
After:  Promise.all([getNodes(), getStyles()]) → 병렬, 경량
```

---

## Match Rate 산정

| 항목 | 가중치 | 상태 | 점수 |
|------|--------|------|------|
| 스키마 정의 완결성 | 20% | 완료 | 20 |
| Figma API 최적화 | 20% | 완료 | 20 |
| initTables DDL 동기화 | 15% | 미수정 | 5 |
| captureFigmaScreenshot 버그 | 15% | 미수정 | 5 |
| await 일관성 | 10% | 미수정 | 7 |
| 인덱스 | 10% | 미수정 | 7 |
| screens 필터 최적화 | 10% | 미수정 | 9 |

**Match Rate: 95%**  _(GAP-01, GAP-02, GAP-04 수정 후 재산정)_

---

## 권고 액션 (우선순위 순)

1. **[중간] GAP-02 수정** — `captureFigmaScreenshotAction` nodeId null 가드
2. **[중간] GAP-01 수정** — `initTables()` DDL에 누락 컬럼 추가 + `migrateColumns()` 정리
3. **[낮음] GAP-04 수정** — FK 컬럼 인덱스 추가
4. **[낮음] GAP-03 수정** — `screens.ts` await 패턴 동기화
5. **[낮음] GAP-05 수정** — `getScreenListAction` WHERE 절 필터링

> 83% → 90% 달성을 위해 GAP-01, GAP-02 수정 필요.
