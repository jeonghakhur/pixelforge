import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { GENERATOR_CONFIG_KEYS, GENERATOR_DEFAULTS, type GeneratorConfig } from '@/lib/generator-config-cache';
import GeneratorConfigClient from './GeneratorConfigClient';

function loadGeneratorConfig(): GeneratorConfig {
  const config = structuredClone(GENERATOR_DEFAULTS);
  for (const key of GENERATOR_CONFIG_KEYS) {
    const row = db.select().from(appSettings)
      .where(eq(appSettings.key, `generator.${key}`)).get();
    if (row) {
      try { (config as unknown as Record<string, unknown>)[key] = JSON.parse(row.value); }
      catch { /* use default */ }
    }
  }
  return config;
}

export default function GeneratorConfigPage() {
  const config = loadGeneratorConfig();

  return <GeneratorConfigClient initialConfig={config} />;
}
