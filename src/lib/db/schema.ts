import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  figmaUrl: text('figma_url'),
  figmaKey: text('figma_key'),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const tokens = sqliteTable('tokens', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  version: integer('version').notNull().default(1),
  type: text('type', { enum: ['color', 'typography', 'spacing', 'radius'] }).notNull(),
  name: text('name').notNull(),
  value: text('value').notNull(),
  raw: text('raw'),
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
