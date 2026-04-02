import { db } from '@/lib/db';
import { projects, appSettings } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

/** app_settings.active_project_id → projectId 반환. 없으면 updated_at 최신 프로젝트 fallback. */
export function getActiveProjectId(): string | null {
  const setting = db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, 'active_project_id'))
    .get();

  if (setting?.value) {
    const project = db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, setting.value))
      .get();
    if (project) return project.id;
  }

  const fallback = db
    .select({ id: projects.id })
    .from(projects)
    .orderBy(desc(projects.updatedAt))
    .limit(1)
    .get();

  return fallback?.id ?? null;
}
