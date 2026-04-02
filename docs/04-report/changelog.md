# PixelForge Changelog

## [2026-04-02] - single-project Feature Complete

### Added
- `app_settings` SQLite table for explicit application settings storage
- `appSettings` Drizzle ORM schema definition
- `getActiveProject()` helper function with 2-tier fallback logic
- `setActiveProject(projectId)` async server action for explicit project activation
- `token_sources` upsert step in token pipeline for consistency

### Changed
- 8 implicit project queries in `tokens.ts` replaced with centralized `getActiveProject()` helper
- Plugin sync route now explicitly sets active project after pipeline completes
- Improved hash comparison to normalize tokens before hashing (prevents false-positive duplicates)

### Fixed
- Resolved data inconsistency issue where UI could display wrong project's tokens
- Fixed race condition where concurrent sync requests could create duplicate projects
- Eliminated guesswork `orderBy(updatedAt).limit(1)` pattern from all token actions

### Deployment Notes
- **Breaking Changes**: None (fully backward compatible)
- **Database Migration**: Automatic (DDL creates table if missing)
- **Fallback Available**: Works with existing DBs via graceful degradation
- **Build Status**: ✅ Clean (`npm run build`, `npm run lint`)
- **Test Result**: ✅ 100% Match Rate (all design gaps resolved)

### Technical Summary
- **Files Modified**: 4 (schema.ts, db/index.ts, tokens.ts, sync/tokens/route.ts)
- **New Tables**: 1 (app_settings)
- **Schema Changes**: 0 breaking changes (new table only)
- **Type Safety**: 100% TypeScript strict (zero `any` types)
- **Performance**: Single DB query + 1 optional fallback (no N+1)

### References
- **Completion Report**: [docs/04-report/features/single-project.report.md](./features/single-project.report.md)
- **Design Document**: [docs/02-design/features/single-project.design.md](../02-design/features/single-project.design.md)
