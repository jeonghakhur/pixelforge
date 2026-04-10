'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { updatePropsOverrides, regenerateComponentFiles } from '@/lib/actions/components';
import type { ComponentOverrides, PropsOverride } from '@/lib/component-generator/props-override';
import styles from './PropsEditor.module.scss';

// ── TSX에서 모든 props 파싱 ─────────────────────────────────────────────

interface EditorPropDef {
  name: string;
  kind: 'union' | 'boolean' | 'node' | 'string';
  values?: string[];  // union 전용
  defaultValue?: string | boolean;
}

function parseEditorProps(tsx: string): EditorPropDef[] {
  if (!tsx) return [];

  // 1. export type 선언 수집: ButtonHierarchy → ['Primary', 'Secondary']
  const typeDecls = new Map<string, string[]>();
  const typeRe = /export type (\w+) = ([^;]+);/g;
  let m;
  while ((m = typeRe.exec(tsx)) !== null) {
    typeDecls.set(
      m[1],
      m[2].split('|').map(s => s.trim().replace(/'/g, '').replace(/"/g, '')),
    );
  }

  // 2. interface 본문 추출
  const interfaceMatch = tsx.match(/export interface \w+Props[^{]*\{([\s\S]*?)\n\}/);
  if (!interfaceMatch) return [];

  const props: EditorPropDef[] = [];
  const SKIP = new Set(['children', 'className', 'disabled']);
  const seen = new Set<string>(); // 중복 prop 방어

  for (const line of interfaceMatch[1].split('\n')) {
    const pm = line.match(/^\s*(\w+)\??\s*:\s*([^;]+);/);
    if (!pm) continue;
    const propName = pm[1];
    const typeName = pm[2].trim();
    if (SKIP.has(propName) || seen.has(propName)) continue;
    seen.add(propName);

    if (typeDecls.has(typeName)) {
      props.push({ name: propName, kind: 'union', values: typeDecls.get(typeName) });
    } else if (typeName === 'ReactNode') {
      props.push({ name: propName, kind: 'node' });
    } else if (typeName === 'boolean') {
      props.push({ name: propName, kind: 'boolean' });
    } else if (typeName === 'string') {
      props.push({ name: propName, kind: 'string' });
    }
  }

  // 3. destructuring에서 defaultValue 추출
  const blockMatch = tsx.match(/\(\s*\{([\s\S]*?)\},\s*\n\s*ref/);
  if (blockMatch) {
    const defaults = new Map<string, string>();
    for (const l of blockMatch[1].split('\n')) {
      const dm = l.match(/^\s*(\w+)\s*=\s*(.+?),?\s*$/);
      if (dm) defaults.set(dm[1], dm[2].replace(/'/g, '').replace(/"/g, ''));
    }
    for (const p of props) {
      const def = defaults.get(p.name);
      if (def !== undefined) {
        p.defaultValue = p.kind === 'boolean' ? def === 'true' : def;
      }
    }
  }

  return props;
}

// ── Props ─────────────────────────────────────────────────────────────────

interface PropsEditorProps {
  componentId: string;
  componentName: string;
  tsx: string;
  initialOverrides: ComponentOverrides | null;
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export default function PropsEditor({
  componentId,
  componentName,
  tsx,
  initialOverrides,
}: PropsEditorProps) {
  const router = useRouter();

  const baseProps = useMemo(() => {
    const fromTsx = parseEditorProps(tsx);

    // 재생성 후 tsx에서 사라진 prop도 PropsEditor에 계속 표시
    // (initialOverrides의 removed:true 항목에서 복원 → 체크박스로 되살릴 수 있도록)
    const removedInOverrides = (initialOverrides?.props ?? []).filter(o => o.removed);
    const ghostProps: EditorPropDef[] = removedInOverrides
      .filter(o => !fromTsx.some(p => p.name === o.sourceName))
      .map(o => ({
        name: o.sourceName,
        kind: (o.kind ?? 'boolean') as EditorPropDef['kind'],
        defaultValue: o.defaultValue,
      }));

    return [...fromTsx, ...ghostProps];
  }, [tsx, initialOverrides]);

  const [overrides, setOverrides] = useState<ComponentOverrides>(
    initialOverrides ?? { name: undefined, props: [] },
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 컴포넌트명 (override > original)
  const displayName = overrides.name ?? componentName;

  // baseProps와 overrides를 병합하여 화면에 표시 (union 제외)
  const displayProps = baseProps
    .filter(base => base.kind !== 'union')
    .map(base => {
      const override = overrides.props.find(o => o.sourceName === base.name);
      return {
        sourceName: base.name,
        name: override?.name ?? base.name,
        removed: override?.removed ?? false,
        defaultValue: override?.defaultValue ?? base.defaultValue,
        kind: base.kind,
        values: base.values,
      };
    });

  function getOrCreateOverride(sourceName: string): PropsOverride {
    const base = baseProps.find(p => p.name === sourceName);
    const existing = overrides.props.find(o => o.sourceName === sourceName);
    return existing ?? {
      sourceName,
      name: sourceName,
      removed: false,
      kind: base?.kind,
    };
  }

  function updatePropOverride(sourceName: string, patch: Partial<PropsOverride>) {
    const current = getOrCreateOverride(sourceName);
    const updated = { ...current, ...patch };
    const newProps = overrides.props.filter(o => o.sourceName !== sourceName);

    // 변경 없으면 제거 (기본값 복원)
    const base = baseProps.find(p => p.name === sourceName);
    const isDefault =
      updated.name === sourceName &&
      !updated.removed &&
      (updated.defaultValue === undefined || updated.defaultValue === base?.defaultValue) &&
      updated.tsType === undefined;

    setOverrides(prev => ({
      ...prev,
      props: isDefault ? newProps : [...newProps, updated],
    }));
    setDirty(true);
    setSaveError(null);
  }

  // 저장 + 재생성을 한 번에 처리 → 코드뷰 즉시 반영
  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    const saveResult = await updatePropsOverrides(componentId, overrides);
    if (saveResult.error) {
      setSaveError(saveResult.error);
      setSaving(false);
      return;
    }

    const regenResult = await regenerateComponentFiles(componentId);
    setSaving(false);

    if (regenResult.error) {
      setSaveError(regenResult.error);
      return;
    }

    setDirty(false);

    if (regenResult.newName) {
      router.replace(`/components/${encodeURIComponent(regenResult.newName)}`);
    } else {
      router.refresh();
    }
  }

  if (displayProps.length === 0) return null;

  return (
    <div className={styles.editor}>
      {/* ── 헤더 ── */}
      <div className={styles.editorHeader}>
        <div className={styles.editorTitle}>
          <Icon icon="solar:settings-linear" width={14} height={14} />
          Props Editor
        </div>
        <div className={styles.editorActions}>
          {(overrides.name || overrides.props.length > 0) && (
            <button
              type="button"
              className={styles.resetBtn}
              onClick={() => {
                setOverrides({ name: undefined, props: [] });
                setDirty(true);
                setSaveError(null);
              }}
              disabled={saving}
            >
              <Icon icon="solar:restart-linear" width={13} height={13} />
              초기화
            </button>
          )}
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? (
              <Icon icon="solar:loading-linear" width={13} height={13} className={styles.spin} />
            ) : (
              <Icon icon="solar:floppy-disk-linear" width={13} height={13} />
            )}
            {saving ? '저장 중…' : '저장 및 적용'}
          </button>
        </div>
      </div>

      {/* ── 에러 메시지 ── */}
      {saveError && (
        <div className={styles.errorBar}>
          <Icon icon="solar:danger-triangle-linear" width={14} height={14} />
          {saveError}
        </div>
      )}

      {/* ── 컴포넌트명 ── */}
      <div className={styles.nameRow}>
        <label className={styles.nameLabel} htmlFor="pe-comp-name">컴포넌트명</label>
        <input
          id="pe-comp-name"
          type="text"
          className={styles.nameInput}
          value={displayName}
          onChange={e => {
            const val = e.target.value;
            setOverrides(prev => ({ ...prev, name: val || undefined }));
            setDirty(true);
          }}
          placeholder={componentName}
          spellCheck={false}
        />
        {overrides.name && overrides.name !== componentName && (
          <span className={styles.nameChangedBadge}>이름 변경됨</span>
        )}
      </div>

      {/* ── Props 목록 ── */}
      <div className={styles.propsTable}>
        <div className={styles.propsHeader}>
          <span>포함</span>
          <span>타입</span>
          <span>이름</span>
          <span>기본값</span>
        </div>

        {displayProps.map(p => (
          <div
            key={p.sourceName}
            className={`${styles.propRow} ${p.removed ? styles.propRemoved : ''}`}
          >
            {/* 포함 체크박스 */}
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={!p.removed}
                onChange={e =>
                  updatePropOverride(p.sourceName, { removed: !e.target.checked, name: p.name })
                }
              />
            </label>

            {/* 타입 배지 */}
            <span className={`${styles.kindBadge} ${styles[`kind_${p.kind}`]}`}>
              {p.kind === 'node' ? 'node' : p.kind === 'boolean' ? 'bool' : p.kind}
            </span>

            {/* 이름 입력 — 변경 시 원본 이름을 배지로 표시 */}
            <div className={styles.nameCell}>
              <input
                type="text"
                className={`${styles.nameFieldInput} ${p.removed ? styles.fieldDisabled : ''}`}
                value={p.name}
                disabled={p.removed}
                onChange={e =>
                  updatePropOverride(p.sourceName, { name: e.target.value, removed: p.removed })
                }
                onBlur={e => {
                  if (!e.target.value) {
                    updatePropOverride(p.sourceName, { name: p.sourceName, removed: p.removed })
                  }
                }}
                spellCheck={false}
              />
              {p.name !== p.sourceName && (
                <span className={styles.sourceNameBadge}>{p.sourceName}</span>
              )}
            </div>

            {/* 기본값 */}
            {p.kind === 'boolean' ? (
              <select
                className={`${styles.defaultSelect} ${p.removed ? styles.fieldDisabled : ''}`}
                value={String(p.defaultValue ?? 'false')}
                disabled={p.removed}
                onChange={e =>
                  updatePropOverride(p.sourceName, { defaultValue: e.target.value === 'true', name: p.name })
                }
              >
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            ) : (
              <input
                type="text"
                className={`${styles.defaultInput} ${p.removed ? styles.fieldDisabled : ''}`}
                value={String(p.defaultValue ?? '')}
                disabled={p.removed}
                placeholder="—"
                onChange={e =>
                  updatePropOverride(p.sourceName, { defaultValue: e.target.value || undefined, name: p.name })
                }
                spellCheck={false}
              />
            )}
          </div>
        ))}
      </div>

      {dirty && (
        <p className={styles.dirtyNote}>
          <Icon icon="solar:info-circle-linear" width={13} height={13} />
          [저장 및 적용]을 누르면 코드가 즉시 재생성됩니다
        </p>
      )}
    </div>
  );
}
