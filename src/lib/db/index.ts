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

export const db = drizzle(sqlite, { schema });
export { schema };
