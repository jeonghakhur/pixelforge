import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  figmaUrl: text('figma_url'),
  figmaKey: text('figma_key'),
  description: text('description'),
  pagesCache: text('pages_cache'),
  /** Figma 파일 버전 — 파일 캐시 유효성 검사용 */
  figmaVersion: text('figma_version'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const tokens = sqliteTable('tokens', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  version: integer('version').notNull().default(1),
  type: text('type').notNull(),
  name: text('name').notNull(),
  value: text('value').notNull(),
  raw: text('raw'),
  source: text('source', { enum: ['variables', 'styles-api', 'section-scan', 'node-scan'] }).default('node-scan'),
  mode: text('mode'),
  collectionName: text('collection_name'),
  alias: text('alias'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const components = sqliteTable('components', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  category: text('category', { enum: ['action', 'form', 'navigation', 'feedback'] }).notNull(),
  scss: text('scss'),
  tsx: text('tsx'),
  description: text('description'),
  menuOrder: integer('menu_order').notNull().default(0),
  isVisible: integer('is_visible', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const histories = sqliteTable('histories', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  action: text('action', { enum: ['extract_tokens', 'generate_component', 'export'] }).notNull(),
  summary: text('summary').notNull(),
  metadata: text('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const screens = sqliteTable('screens', {
  id: text('id').primaryKey(),

  // 파일 정보
  route: text('route').notNull().unique(),
  filePath: text('file_path').notNull(),

  // @page 파싱 결과
  name: text('name').notNull(),
  description: text('description'),
  authors: text('authors'),                    // JSON string: '["김디자인","이개발"]'
  category: text('category'),

  // 작업 이력
  status: text('status', {
    enum: ['wip', 'dev-done', 'qa-ready', 'qa-done'],
  }).notNull().default('wip'),
  sinceDate: text('since_date'),
  updatedDate: text('updated_date'),

  // Figma 연동
  figmaUrl: text('figma_url'),
  figmaScreenshot: text('figma_screenshot'),   // 'public/screens/{id}-figma.png'

  // 구현 스크린샷
  implScreenshot: text('impl_screenshot'),     // 'public/screens/{id}-impl.png'

  // 노출 여부 (관리자가 대시보드에서 수정 가능)
  visible: integer('visible', { mode: 'boolean' }).notNull().default(true),

  // 검수 이력
  reviewedBy: text('reviewed_by'),   // 마지막으로 상태를 변경한 사용자 이메일
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),

  // Playwright 검수
  playwrightStatus: text('playwright_status', {
    enum: ['pending', 'pass', 'fail', 'skip'],
  }).notNull().default('pending'),
  playwrightScore: integer('playwright_score'),
  playwrightReport: text('playwright_report'), // JSON string

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const tokenSources = sqliteTable('token_sources', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  type: text('type').notNull(),
  figmaUrl: text('figma_url').notNull(),
  figmaKey: text('figma_key').notNull(),
  figmaVersion: text('figma_version'),
  lastExtractedAt: integer('last_extracted_at', { mode: 'timestamp' }),
  tokenCount: integer('token_count').notNull().default(0),
  uiScreenshot: text('ui_screenshot'),
  figmaScreenshot: text('figma_screenshot'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [unique().on(t.projectId, t.type)]);
