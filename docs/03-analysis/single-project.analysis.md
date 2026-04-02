# single-project Gap Analysis

**Date**: 2026-04-02
**Match Rate**: 100% (수정 후)

## 결과

| 체크포인트 | 상태 |
|-----------|:----:|
| appSettings Drizzle 스키마 | Pass |
| app_settings DDL | Pass |
| getActiveProject() 구현 | Pass |
| setActiveProject() 구현 | Pass |
| orderBy(updatedAt) 8곳 교체 | Pass |
| route.ts setActiveProject 호출 | Pass |
| getProjectInfo() 교체 | Pass (수정됨) |

## 수정 사항

- `getProjectInfo()` (tokens.ts:272) — `db.select().limit(1)` → `getActiveProject()` 교체
