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
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      version INTEGER NOT NULL DEFAULT 1,
      type TEXT NOT NULL CHECK(type IN ('color', 'typography', 'spacing', 'radius')),
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      raw TEXT,
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

    CREATE TABLE IF NOT EXISTS histories (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      action TEXT NOT NULL CHECK(action IN ('extract_tokens', 'generate_component', 'export')),
      summary TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

initTables();

export const db = drizzle(sqlite, { schema });
export { schema };
