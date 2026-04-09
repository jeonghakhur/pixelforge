import { readFileSync } from 'fs';
import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { runPipeline } from '@/lib/component-generator';

const raw = JSON.parse(readFileSync('/Users/jeonghak/Downloads/SizeXlargeStateRestBlockTrue.node.json', 'utf8')) as Record<string, unknown>;
const payload = (raw.data ?? raw) as Record<string, unknown>;

const result = runPipeline(payload);
console.log('\nsuccess:', result.success, '| type:', result.resolvedType, '| error:', result.error ?? 'none');

if (result.output) {
  console.log('name:', result.output.name);

  console.log('\n--- TSX ---');
  console.log(result.output.tsx.slice(0, 600));
  console.log('\n--- CSS (first 600) ---');
  console.log(result.output.css.slice(0, 600));

  // DB에 저장
  const db = new Database('.pixelforge/db.sqlite');
  const project = db.prepare('SELECT id FROM projects ORDER BY rowid DESC LIMIT 1').get() as { id: string } | undefined;
  if (!project) { console.log('no project'); process.exit(1); }

  const rawStr = JSON.stringify(payload);
  const hash = createHash('sha256').update(rawStr).digest('hex');
  const existing = db.prepare("SELECT id, version FROM components WHERE name = ?").get(result.output.name) as { id: string; version: number } | undefined;

  if (existing) {
    db.prepare(`UPDATE components SET tsx=?, scss=?, node_payload=?, detected_type=?, radix_props=?, content_hash=?, version=?, updated_at=? WHERE id=?`)
      .run(result.output.tsx, result.output.css, rawStr, result.resolvedType, JSON.stringify((payload.radixProps as Record<string, string>) ?? {}), hash, existing.version + 1, Date.now(), existing.id);
    console.log('\n✅ Updated:', result.output.name, 'v' + (existing.version + 1));
  } else {
    const id = Math.random().toString(36).slice(2);
    const orders = db.prepare('SELECT menu_order FROM components WHERE project_id = ?').all(project.id) as { menu_order: number }[];
    const nextOrder = orders.length > 0 ? Math.max(...orders.map(r => r.menu_order)) + 1 : 0;
    db.prepare(`INSERT INTO components (id, project_id, name, category, tsx, scss, node_payload, detected_type, radix_props, content_hash, version, menu_order, is_visible) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`)
      .run(id, project.id, result.output.name, result.output.category, result.output.tsx, result.output.css, rawStr, result.resolvedType, JSON.stringify((payload.radixProps as Record<string, string>) ?? {}), hash, 1, nextOrder);
    console.log('\n✅ Inserted:', result.output.name, 'id:', id);
  }
}
