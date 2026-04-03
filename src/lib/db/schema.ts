import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';

export const syncPayloads = sqliteTable('sync_payloads', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  type: text('type', { enum: ['tokens', 'icons', 'images', 'themes', 'components'] }).notNull(),
  version: integer('version').notNull().default(1),
  contentHash: text('content_hash').notNull(),
  data: text('data').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  keyHash: text('key_hash').notNull().unique(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
});

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
  figmaNodeId: text('figma_node_id'),
  figmaFileKey: text('figma_file_key'),
  name: text('name').notNull(),
  category: text('category', { enum: ['action', 'form', 'navigation', 'feedback'] }).notNull(),
  scss: text('scss'),
  tsx: text('tsx'),
  description: text('description'),
  defaultStyleMode: text('default_style_mode').notNull().default('css-modules'),
  menuOrder: integer('menu_order').notNull().default(0),
  isVisible: integer('is_visible', { mode: 'boolean' }).notNull().default(true),
  /** 플러그인이 전송한 원본 payload JSON */
  nodePayload: text('node_payload'),
  /** 플러그인이 감지한 컴포넌트 타입 (button, table, tabs, dialog, ...) */
  detectedType: text('detected_type'),
  /** Radix 기반 props 제안 JSON (예: { variant: "ghost", size: "2" }) */
  radixProps: text('radix_props'),
  /** payload 변경 감지용 SHA-256 hash */
  contentHash: text('content_hash'),
  /** sync 버전 (동일 노드 재전송 시 증가) */
  version: integer('version').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const componentFiles = sqliteTable('component_files', {
  id: text('id').primaryKey(),
  componentId: text('component_id').notNull().references(() => components.id),
  styleMode: text('style_mode', { enum: ['css-modules', 'styled', 'html'] }).notNull(),
  fileType: text('file_type', { enum: ['tsx', 'css', 'html'] }).notNull(),
  fileName: text('file_name').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const componentNodeSnapshots = sqliteTable('component_node_snapshots', {
  id: text('id').primaryKey(),
  componentId: text('component_id').notNull().references(() => components.id),
  figmaNodeData: text('figma_node_data').notNull(),
  figmaVersion: text('figma_version'),
  trigger: text('trigger', { enum: ['generate', 'update'] }).notNull().default('generate'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
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

  // 노출 순위 키 (예: "1", "2", "2-1", "2-2" — null = 미지정)
  displayOrderKey: text('display_order_key'),

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
  /** 추출된 토큰 데이터의 SHA-256 해시 — 변경 여부 감지용 */
  contentHash: text('content_hash'),
  uiScreenshot: text('ui_screenshot'),
  figmaScreenshot: text('figma_screenshot'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [unique().on(t.projectId, t.type)]);

// ===========================
// 토큰 스냅샷 (버전 관리)
// ===========================
export const tokenSnapshots = sqliteTable('token_snapshots', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  /** 자동 증가 버전 번호 */
  version: integer('version').notNull(),
  /** 추출 방식 */
  source: text('source', { enum: ['variables', 'styles-api', 'section-scan', 'node-scan'] }).notNull(),
  /** Figma 파일 버전 (변경 추적용) */
  figmaVersion: text('figma_version'),
  /** 타입별 토큰 수 JSON: { color: 106, typography: 55, ... } */
  tokenCounts: text('token_counts').notNull(),
  /** 전체 토큰 데이터 JSON: Array<{ type, name, value, raw, mode, collectionName, alias }> */
  tokensData: text('tokens_data').notNull(),
  /** 이전 스냅샷 대비 변경 요약 JSON: { added: [...], removed: [...], changed: [...] } */
  diffSummary: text('diff_summary'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ===========================
// 토큰 타입 메뉴 설정 (프로젝트별, DB 자동 생성)
// ===========================
export const tokenTypeConfigs = sqliteTable('token_type_configs', {
  id:        text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  type:      text('type').notNull(),
  label:     text('label').notNull(),
  icon:      text('icon').notNull(),
  menuOrder: integer('menu_order').notNull().default(0),
  isVisible: integer('is_visible', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [unique().on(t.projectId, t.type)]);

// ===========================
// 앱 전역 설정
// ===========================
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
