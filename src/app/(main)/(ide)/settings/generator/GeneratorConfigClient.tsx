'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import Button from '@/components/common/Button';
import Card from '@/components/common/Card';
import { saveGeneratorConfigValue } from '@/lib/actions/generator-config';
import type { GeneratorConfig } from '@/lib/generator-config-cache';
import styles from './page.module.scss';

// ── Key-Value 에디터 ────────────────────────────────────────────────────

function KvEditor({ label, description, data, onChange, onSave, saving }: {
  label: string;
  description: string;
  data: Record<string, string>;
  onChange: (data: Record<string, string>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const entries = Object.entries(data);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const handleRemove = (key: string) => {
    const next = { ...data };
    delete next[key];
    onChange(next);
  };

  const handleAdd = () => {
    if (!newKey.trim() || !newVal.trim()) return;
    onChange({ ...data, [newKey.trim()]: newVal.trim() });
    setNewKey('');
    setNewVal('');
  };

  return (
    <Card className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{label}</span>
        <span className={styles.cardDesc}>{description}</span>
      </div>
      <table className={styles.kvTable}>
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td><code>{k}</code></td>
              <td><code>{v}</code></td>
              <td>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => handleRemove(k)}
                  aria-label={`Remove ${k}`}
                >
                  <Icon icon="solar:close-circle-linear" width={14} height={14} />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td>
              <input
                type="text"
                className={styles.kvInput}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="key"
              />
            </td>
            <td>
              <input
                type="text"
                className={styles.kvInput}
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                placeholder="value"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </td>
            <td>
              <button type="button" className={styles.addBtn} onClick={handleAdd} aria-label="Add entry">
                <Icon icon="solar:add-circle-linear" width={14} height={14} />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div className={styles.cardActions}>
        <button
          type="button"
          onClick={() => {
            // eslint-disable-next-line no-console
            console.log('[KvEditor] Save clicked for:', label);
            onSave();
          }}
          disabled={saving}
          className="btn btn-primary btn-sm"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Card>
  );
}

// ── Tag 에디터 ──────────────────────────────────────────────────────────

function TagEditor({ label, description, data, onChange, onSave, saving }: {
  label: string;
  description: string;
  data: string[];
  onChange: (data: string[]) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [newTag, setNewTag] = useState('');

  const handleAdd = () => {
    if (!newTag.trim() || data.includes(newTag.trim())) return;
    onChange([...data, newTag.trim()]);
    setNewTag('');
  };

  return (
    <Card className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{label}</span>
        <span className={styles.cardDesc}>{description}</span>
      </div>
      <div className={styles.tagList}>
        {data.map((tag) => (
          <span key={tag} className={styles.tag}>
            <code>{tag}</code>
            <button
              type="button"
              className={styles.tagRemove}
              onClick={() => onChange(data.filter((t) => t !== tag))}
              aria-label={`Remove ${tag}`}
            >
              <Icon icon="solar:close-circle-linear" width={12} height={12} />
            </button>
          </span>
        ))}
        <div className={styles.tagInput}>
          <input
            type="text"
            className={styles.kvInput}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add..."
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button type="button" className={styles.addBtn} onClick={handleAdd} aria-label="Add tag">
            <Icon icon="solar:add-circle-linear" width={14} height={14} />
          </button>
        </div>
      </div>
      <div className={styles.cardActions}>
        <button
          type="button"
          onClick={() => {
            // eslint-disable-next-line no-console
            console.log('[TagEditor] Save clicked for:', label);
            onSave();
          }}
          disabled={saving}
          className="btn btn-primary btn-sm"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Card>
  );
}

// ── Main ────────────────────────────────────────────────────────────────

export default function GeneratorConfigClient({ initialConfig }: { initialConfig: GeneratorConfig }) {
  const [config, setConfig] = useState<GeneratorConfig>(initialConfig);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const save = async (key: keyof GeneratorConfig, value: unknown) => {
    // eslint-disable-next-line no-console
    console.log('[GeneratorConfig] save called:', key, JSON.stringify(value).slice(0, 100));
    setSaving(key);
    try {
      const result = await saveGeneratorConfigValue(key, value);
      // eslint-disable-next-line no-console
      console.log('[GeneratorConfig] save result:', result);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[GeneratorConfig] save error:', err);
    }
    setSaving(null);
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>Generator Config</span>
        <h1 className={styles.title}>Generator Settings</h1>
        <p className={styles.description}>
          CSS 변수 매핑, 색상 약어, 토큰 타입 규칙을 설정합니다. 변경 후 토큰을 재추출하면 반영됩니다.
        </p>
      </div>

      <div className={styles.sections}>
        <KvEditor
          label="Semantic Map"
          description="Figma primitive 색상을 프로젝트 시맨틱 토큰으로 변환"
          data={config.semanticMap}
          onChange={(d) => setConfig({ ...config, semanticMap: d })}
          onSave={() => save('semanticMap', config.semanticMap)}
          saving={saving === 'semanticMap'}
        />
        {saved === 'semanticMap' && <p className={styles.savedMsg}>Saved</p>}

        <KvEditor
          label="Color Abbreviations"
          description="색상 그룹 이름의 약어 매핑 (slug 중복 제거용)"
          data={config.colorAbbrev}
          onChange={(d) => setConfig({ ...config, colorAbbrev: d })}
          onSave={() => save('colorAbbrev', config.colorAbbrev)}
          saving={saving === 'colorAbbrev'}
        />
        {saved === 'colorAbbrev' && <p className={styles.savedMsg}>Saved</p>}

        <TagEditor
          label="Style Type (Direct Name)"
          description="Figma 변수명을 그대로 CSS 변수명으로 사용할 토큰 타입"
          data={config.styleTypePassthrough}
          onChange={(d) => setConfig({ ...config, styleTypePassthrough: d })}
          onSave={() => save('styleTypePassthrough', config.styleTypePassthrough)}
          saving={saving === 'styleTypePassthrough'}
        />
        {saved === 'styleTypePassthrough' && <p className={styles.savedMsg}>Saved</p>}

        <TagEditor
          label="Palette Keywords"
          description="Primitive 색상 판별 키워드 (숫자 외 추가)"
          data={config.paletteKeywords}
          onChange={(d) => setConfig({ ...config, paletteKeywords: d })}
          onSave={() => save('paletteKeywords', config.paletteKeywords)}
          saving={saving === 'paletteKeywords'}
        />
        {saved === 'paletteKeywords' && <p className={styles.savedMsg}>Saved</p>}
      </div>
    </div>
  );
}
