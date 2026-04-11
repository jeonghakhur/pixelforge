import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as schema from './schema';

function getDbPath(): string {
  const pixelforgDir = path.join(process.cwd(), '.pixelforge');
  if (!fs.existsSync(pixelforgDir)) {
    fs.mkdirSync(pixelforgDir, { recursive: true });
  }
  return path.join(pixelforgDir, 'db.sqlite');
}

const sqlite = new Database(getDbPath());
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

/** 테이블이 없으면 자동 생성 */
function initTables(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      figma_url TEXT,
      figma_key TEXT,
      description TEXT,
      pages_cache TEXT,
      figma_version TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      version INTEGER NOT NULL DEFAULT 1,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      raw TEXT,
      source TEXT DEFAULT 'node-scan',
      mode TEXT,
      collection_name TEXT,
      alias TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS components (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('action', 'form', 'navigation', 'feedback')),
      scss TEXT,
      tsx TEXT,
      description TEXT,
      menu_order INTEGER NOT NULL DEFAULT 0,
      is_visible INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS histories (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      action TEXT NOT NULL CHECK(action IN ('extract_tokens', 'generate_component', 'export')),
      summary TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS token_sources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      type TEXT NOT NULL,
      figma_url TEXT NOT NULL,
      figma_key TEXT NOT NULL,
      figma_version TEXT,
      last_extracted_at INTEGER,
      token_count INTEGER NOT NULL DEFAULT 0,
      content_hash TEXT,
      ui_screenshot TEXT,
      figma_screenshot TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(project_id, type)
    );

    CREATE TABLE IF NOT EXISTS token_snapshots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      version INTEGER NOT NULL,
      source TEXT NOT NULL,
      figma_version TEXT,
      token_counts TEXT NOT NULL,
      tokens_data TEXT NOT NULL,
      diff_summary TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS screens (
      id TEXT PRIMARY KEY,
      route TEXT NOT NULL UNIQUE,
      file_path TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      authors TEXT,
      category TEXT,
      status TEXT NOT NULL DEFAULT 'wip' CHECK(status IN ('wip', 'dev-done', 'qa-ready', 'qa-done')),
      since_date TEXT,
      updated_date TEXT,
      figma_url TEXT,
      figma_screenshot TEXT,
      impl_screenshot TEXT,
      visible INTEGER NOT NULL DEFAULT 1,
      reviewed_by TEXT,
      reviewed_at INTEGER,
      playwright_status TEXT NOT NULL DEFAULT 'pending' CHECK(playwright_status IN ('pending', 'pass', 'fail', 'skip')),
      playwright_score INTEGER,
      playwright_report TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS sync_payloads (
      id           TEXT PRIMARY KEY,
      project_id   TEXT NOT NULL REFERENCES projects(id),
      type         TEXT NOT NULL CHECK(type IN ('tokens','icons','images','themes','components')),
      version      INTEGER NOT NULL DEFAULT 1,
      content_hash TEXT NOT NULL,
      data         TEXT NOT NULL,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_sync_payloads_project_type
      ON sync_payloads(project_id, type, version);

    CREATE TABLE IF NOT EXISTS api_keys (
      id           TEXT PRIMARY KEY,
      key_hash     TEXT NOT NULL UNIQUE,
      name         TEXT NOT NULL,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      last_used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS component_files (
      id           TEXT PRIMARY KEY,
      component_id TEXT NOT NULL REFERENCES components(id),
      style_mode   TEXT NOT NULL CHECK(style_mode IN ('css-modules','styled','html')),
      file_type    TEXT NOT NULL CHECK(file_type IN ('tsx','css','html')),
      file_name    TEXT NOT NULL,
      content      TEXT NOT NULL,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_component_files_component_id
      ON component_files(component_id);

    CREATE TABLE IF NOT EXISTS component_node_snapshots (
      id              TEXT PRIMARY KEY,
      component_id    TEXT NOT NULL REFERENCES components(id),
      figma_node_data TEXT NOT NULL,
      figma_version   TEXT,
      trigger         TEXT NOT NULL DEFAULT 'generate' CHECK(trigger IN ('generate','update')),
      created_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_component_node_snapshots_component_id
      ON component_node_snapshots(component_id);
  `);
}

initTables();

/**
 * 기존 DB에 새 컬럼/인덱스 추가 (이미 존재하면 무시)
 * - initTables DDL에 이미 포함된 컬럼은 신규 설치 시 자동 생성됨
 * - 이 함수는 기존 DB(이전 버전)를 위한 마이그레이션 전용
 */
function migrateColumns(): void {
  // 이전 버전 DB에 누락될 수 있는 컬럼 (initTables DDL에 이미 포함됨)
  const alters = [
    `ALTER TABLE projects ADD COLUMN pages_cache TEXT;`,
    `ALTER TABLE projects ADD COLUMN figma_version TEXT;`,
    `ALTER TABLE tokens ADD COLUMN source TEXT DEFAULT 'node-scan';`,
    `ALTER TABLE tokens ADD COLUMN mode TEXT;`,
    `ALTER TABLE tokens ADD COLUMN collection_name TEXT;`,
    `ALTER TABLE tokens ADD COLUMN alias TEXT;`,
    `ALTER TABLE screens ADD COLUMN visible INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE screens ADD COLUMN reviewed_by TEXT;`,
    `ALTER TABLE screens ADD COLUMN reviewed_at INTEGER;`,
    `ALTER TABLE token_sources ADD COLUMN figma_screenshot TEXT;`,
    `ALTER TABLE screens ADD COLUMN display_order INTEGER;`,
    `ALTER TABLE screens ADD COLUMN display_order_key TEXT;`,
    `ALTER TABLE token_sources ADD COLUMN content_hash TEXT;`,
    // component-generator 컬럼 추가
    `ALTER TABLE components ADD COLUMN node_payload TEXT;`,
    `ALTER TABLE components ADD COLUMN detected_type TEXT;`,
    `ALTER TABLE components ADD COLUMN radix_props TEXT;`,
    `ALTER TABLE components ADD COLUMN content_hash TEXT;`,
    `ALTER TABLE components ADD COLUMN version INTEGER NOT NULL DEFAULT 1;`,
    `ALTER TABLE components ADD COLUMN figma_node_id TEXT;`,
    `ALTER TABLE components ADD COLUMN figma_file_key TEXT;`,
    `ALTER TABLE tokens ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;`,
    // component-props-editor 컬럼 추가
    `ALTER TABLE components ADD COLUMN props_overrides TEXT;`,
  ];
  for (const sql of alters) {
    try { sqlite.exec(sql); } catch { /* already exists — skip */ }
  }

  // FK 컬럼 인덱스
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_tokens_project_id ON tokens(project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_tokens_type ON tokens(type);`,
    `CREATE INDEX IF NOT EXISTS idx_components_project_id ON components(project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_histories_project_id ON histories(project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_token_snapshots_project_id ON token_snapshots(project_id);`,
    `CREATE INDEX IF NOT EXISTS idx_token_snapshots_version ON token_snapshots(project_id, version);`,
  ];
  for (const sql of indexes) {
    try { sqlite.exec(sql); } catch { /* skip */ }
  }
}
migrateColumns();

/** tokens.type의 CHECK 제약을 제거해 동적 토큰 타입을 지원 */
function migrateTokenTypeConstraint(): void {
  const row = sqlite.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='tokens'`,
  ).get() as { sql: string } | undefined;

  if (!row?.sql.includes('CHECK(type IN')) return; // 이미 마이그레이션 완료

  sqlite.exec(`
    BEGIN;
    ALTER TABLE tokens RENAME TO _tokens_old;
    CREATE TABLE tokens (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      version INTEGER NOT NULL DEFAULT 1,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      raw TEXT,
      source TEXT DEFAULT 'node-scan',
      mode TEXT,
      collection_name TEXT,
      alias TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    INSERT INTO tokens
      SELECT id, project_id, version, type, name, value, raw,
             COALESCE(source, 'node-scan'), mode, collection_name, alias, created_at
      FROM _tokens_old;
    DROP TABLE _tokens_old;
    COMMIT;
  `);
}
migrateTokenTypeConstraint();

// ── app_settings 테이블 마이그레이션 ──────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ── token_type_configs 테이블 마이그레이션 ────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS token_type_configs (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id),
    type        TEXT NOT NULL,
    label       TEXT NOT NULL,
    icon        TEXT NOT NULL,
    menu_order  INTEGER NOT NULL DEFAULT 0,
    is_visible  INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(project_id, type)
  );
  CREATE INDEX IF NOT EXISTS idx_token_type_configs_project_id
    ON token_type_configs(project_id);
`);

// ── sync_payloads CHECK constraint에 'tokens' 추가 ──
function migrateSyncPayloadsType(): void {
  const row = sqlite.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='sync_payloads'`,
  ).get() as { sql: string } | undefined;

  if (!row || row.sql.includes("'tokens'")) return; // 이미 포함됨

  sqlite.pragma('foreign_keys = OFF');
  sqlite.exec(`
    BEGIN;
    DROP TABLE IF EXISTS sync_payloads_new;
    CREATE TABLE sync_payloads_new (
      id           TEXT PRIMARY KEY,
      project_id   TEXT NOT NULL REFERENCES projects(id),
      type         TEXT NOT NULL CHECK(type IN ('tokens','icons','images','themes','components')),
      version      INTEGER NOT NULL DEFAULT 1,
      content_hash TEXT NOT NULL,
      data         TEXT NOT NULL,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );
    INSERT INTO sync_payloads_new SELECT * FROM sync_payloads;
    DROP TABLE sync_payloads;
    ALTER TABLE sync_payloads_new RENAME TO sync_payloads;
    COMMIT;
  `);
  sqlite.pragma('foreign_keys = ON');
}
migrateSyncPayloadsType();

export const db = drizzle(sqlite, { schema });
export { schema, sqlite };
