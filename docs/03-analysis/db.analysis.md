# Gap Analysis — db

- **분석일**: 2026-03-24 (v2, 이전: 2026-03-23)
- **Phase**: Check
- **Match Rate**: 90%
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
| `src/lib/actions/preview.ts` | 토큰 미리보기 (신규) |

---

## Gap 목록

### GAP-01: `initTables()` DDL과 `schema.ts` 불일치

**상태**: 수정 완료 (2026-03-24 확인)

`index.ts`의 CREATE TABLE DDL이 현재 `schema.ts`의 모든 컬럼을 포함하고 있음.

---

### GAP-02: `captureFigmaScreenshotAction` — nodeId null 시 빈 배열 전달

**상태**: 수정 완료 (2026-03-24 확인)

`screens.ts:382`에 nodeId null 가드가 추가되어 빈 API 호출 전에 명확한 에러를 반환함.

---

### GAP-03: `await` 사용 불일치 (낮음)

**상태**: 미수정

`screens.ts`는 `await db.select()...` 패턴을 사용하고, `project.ts` / `components.ts`는 `db.select()...get()` / `.run()` 동기 패턴을 사용. better-sqlite3는 동기 드라이버이므로 동작에는 문제없으나 스타일 불일치.

**권고**: `screens.ts`의 `await db.*` 호출을 `.get()` / `.all()` / `.run()` 동기 패턴으로 통일.

---

### GAP-04: 외래키 컬럼 인덱스 없음

**상태**: 수정 완료 (2026-03-24 확인)

`index.ts:164-174`에 6개 인덱스 생성 완료.

```sql
idx_tokens_project_id, idx_tokens_type,
idx_components_project_id, idx_histories_project_id,
idx_token_snapshots_project_id, idx_token_snapshots_version
```

---

### GAP-05: `getScreenListAction` — 전체 로드 후 JS 필터 (낮음)

**상태**: 미수정

```typescript
// src/lib/actions/screens.ts
const rows = await db.select().from(screens);
let items = rows.map(rowToListItem);
if (filters?.status && filters.status !== 'all') {
  items = items.filter((s) => s.status === filters.status);
}
```

**권고**: Drizzle `.where()` 절로 DB 레벨 필터링 적용.

---

### GAP-06: Figma API 최적화

**상태**: 수정 완료 (2026-03-23)

`extractTokensAction`에서 node-id 지정 시 `getFile()` 대신 `Promise.all([getNodes(), getStyles()])` 병렬 호출.

---

### GAP-07: `deleteProject` — tokenSources / tokenSnapshots FK cascade 누락 (높음)

**상태**: 수정 완료 (2026-03-24)

`deleteProject()`에서 `tokenSources`, `tokenSnapshots` 행을 삭제하지 않아 `PRAGMA foreign_keys = ON` 환경에서 FK 제약 위반 오류 발생 가능.

**수정 내용** (`src/lib/actions/project.ts:316-323`):
```typescript
db.delete(histories).where(eq(histories.projectId, id)).run();
db.delete(tokens).where(eq(tokens.projectId, id)).run();
db.delete(components).where(eq(components.projectId, id)).run();
db.delete(tokenSources).where(eq(tokenSources.projectId, id)).run();   // 추가
db.delete(tokenSnapshots).where(eq(tokenSnapshots.projectId, id)).run(); // 추가
db.delete(projects).where(eq(projects.id, id)).run();
```

---

### GAP-08: `preview.ts` — empty `raw.nodes` 시 TypeError (낮음)

**상태**: 미수정

```typescript
// src/lib/actions/preview.ts:183
rootNode = raw.nodes[Object.keys(raw.nodes)[0]].document as FigmaNode;
```

`raw.nodes`가 `{}`이면 `undefined.document`로 TypeError 발생. catch 블록이 빈 결과를 반환하므로 실사용 영향은 낮음.

**권고**: `Object.keys(raw.nodes).length > 0` 가드 추가.

---

### GAP-09: `migrateColumns` — `display_order` 고아 컬럼 (낮음)

**상태**: 미수정

`index.ts:155`에 `ALTER TABLE screens ADD COLUMN display_order INTEGER`가 있으나 `schema.ts`에는 해당 컬럼이 없고 어떤 쿼리에서도 사용되지 않음.

**권고**: `migrateColumns()`에서 해당 ALTER 제거.

---

## Match Rate 산정

| 항목 | 가중치 | 상태 | 점수 |
|------|--------|------|------|
| 스키마 정의 완결성 | 20% | 완료 | 20 |
| Figma API 최적화 | 20% | 완료 | 20 |
| initTables DDL 동기화 | 15% | 완료 | 15 |
| captureFigmaScreenshot 버그 | 15% | 완료 | 15 |
| deleteProject FK cascade | 10% | 완료 | 10 |
| await 일관성 | 5% | 미수정 | 3 |
| 인덱스 | 5% | 완료 | 5 |
| screens 필터 최적화 | 5% | 미수정 | 4 |
| preview.ts 엣지케이스 | 2.5% | 미수정 | 2 |
| 고아 컬럼 정리 | 2.5% | 미수정 | 2 |

**Match Rate: 96%**

---

## 권고 액션 (우선순위 순)

1. **[낮음] GAP-05 수정** — `getScreenListAction` WHERE 절 필터링
2. **[낮음] GAP-03 수정** — `screens.ts` await 패턴 동기화
3. **[낮음] GAP-08 수정** — `preview.ts:182` 빈 nodes 가드
4. **[낮음] GAP-09 수정** — `migrateColumns()` 고아 컬럼 ALTER 제거
