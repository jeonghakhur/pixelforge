'use server';

import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { GeneratorConfig } from '@/lib/generator-config-cache';
import {
  GENERATOR_CONFIG_KEYS,
  GENERATOR_DEFAULTS,
  invalidateGeneratorConfigCache,
} from '@/lib/generator-config-cache';

// ── 조회 (전체) ──────────────────────────────────────────────────────────

export async function getGeneratorConfig(): Promise<GeneratorConfig> {
  const config = { ...GENERATOR_DEFAULTS };
  for (const key of GENERATOR_CONFIG_KEYS) {
    const row = db.select().from(appSettings)
      .where(eq(appSettings.key, `generator.${key}`)).get();
    if (row) {
      try { (config as Record<string, unknown>)[key] = JSON.parse(row.value); }
      catch { /* use default */ }
    }
  }
  return config;
}

// ── 저장 ─────────────────────────────────────────────────────────────────

export async function saveGeneratorConfigValue(
  key: keyof GeneratorConfig,
  value: unknown,
): Promise<{ error?: string }> {
  const dbKey = `generator.${key}`;
  const json = JSON.stringify(value);
  const existing = db.select().from(appSettings)
    .where(eq(appSettings.key, dbKey)).get();
  if (existing) {
    db.update(appSettings).set({ value: json })
      .where(eq(appSettings.key, dbKey)).run();
  } else {
    db.insert(appSettings).values({ key: dbKey, value: json }).run();
  }
  invalidateGeneratorConfigCache();
  return {};
}
