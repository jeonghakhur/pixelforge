// JSON 분석 결과 패널 — PixelForgeJson 파일의 variables/styles를 시각화
'use client';

import { Icon } from '@iconify/react';
import type { PixelForgeJson } from '@/lib/actions/import-json';
import styles from './JsonAnalysisPanel.module.scss';

// ===========================
// 유틸리티
// ===========================
function toHex(v: number): string {
  return Math.round(v * 255).toString(16).padStart(2, '0');
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

// ===========================
// 파생 데이터
// ===========================
interface ColorVar {
  name: string;
  hex: string;
  mode: string;
  collectionName: string;
}

interface FloatVar {
  name: string;
  value: number;
  collectionName: string;
}

interface AliasVar {
  name: string;
  targetName: string | null;
  collectionName: string;
}

interface AnalyzedCollection {
  id: string;
  name: string;
  colors: ColorVar[];
  floats: FloatVar[];
  aliases: AliasVar[];
}

function analyzeVariables(data: PixelForgeJson): AnalyzedCollection[] {
  if (!data.variables) return [];

  const collectionMap = new Map(data.variables.collections.map((c) => [c.id, c]));
  const variableById = new Map(data.variables.variables.map((v) => [v.id, v]));

  const result: AnalyzedCollection[] = data.variables.collections.map((col) => ({
    id: col.id,
    name: col.name,
    colors: [],
    floats: [],
    aliases: [],
  }));

  const colIndex = new Map(result.map((r, i) => [r.id, i]));

  for (const variable of data.variables.variables) {
    const col = collectionMap.get(variable.collectionId);
    const idx = colIndex.get(variable.collectionId);
    if (!col || idx === undefined) continue;

    const entry = result[idx];
    const modes = col.modes;

    if (variable.resolvedType === 'COLOR') {
      for (const mode of modes) {
        const val = variable.valuesByMode[mode.modeId];
        if (!val) continue;
        if (typeof val === 'object' && val !== null && 'type' in val) {
          // VARIABLE_ALIAS
          const target = variableById.get((val as { type: string; id: string }).id);
          entry.aliases.push({
            name: variable.name,
            targetName: target?.name ?? null,
            collectionName: col.name,
          });
          break; // 한 번만 추가
        }
        const { r, g, b } = val as { r: number; g: number; b: number };
        entry.colors.push({
          name: variable.name,
          hex: rgbToHex(r, g, b),
          mode: mode.name,
          collectionName: col.name,
        });
      }
    } else if (variable.resolvedType === 'FLOAT') {
      const modeId = modes[0]?.modeId;
      if (!modeId) continue;
      const val = variable.valuesByMode[modeId];
      if (typeof val === 'number') {
        entry.floats.push({ name: variable.name, value: val, collectionName: col.name });
      }
    }
  }

  return result;
}

// ===========================
// 서브컴포넌트
// ===========================
function CollectionBlock({ col }: { col: AnalyzedCollection }) {
  const total = col.colors.length + col.floats.length + col.aliases.length;

  return (
    <div className={styles.collectionBlock}>
      <div className={styles.collectionHeader}>
        <Icon icon="solar:layers-minimalistic-linear" width={11} height={11} className={styles.collectionIcon} />
        <span className={styles.collectionName}>{col.name}</span>
        <span className={styles.collectionCount}>{total}</span>
      </div>

      {col.colors.length > 0 && (
        <div className={styles.varList}>
          {col.colors.map((c) => (
            <div key={`${c.mode}/${c.name}`} className={styles.varRow}>
              <span className={styles.varSwatch} style={{ background: c.hex }} title={c.hex} />
              <span className={styles.varName}>{c.name}</span>
              <span className={styles.varValue}>{c.hex}</span>
              {c.mode && <span className={styles.varMode}>{c.mode}</span>}
            </div>
          ))}
        </div>
      )}

      {col.floats.length > 0 && (
        <div className={styles.varList}>
          {col.floats.map((f) => (
            <div key={f.name} className={styles.varRow}>
              <span className={styles.varNumIcon}>
                <Icon icon="solar:hashtag-linear" width={10} height={10} />
              </span>
              <span className={styles.varName}>{f.name}</span>
              <span className={styles.varValue}>{f.value}px</span>
            </div>
          ))}
        </div>
      )}

      {col.aliases.length > 0 && (
        <div className={styles.varList}>
          {col.aliases.map((a) => (
            <div key={a.name} className={styles.varRow}>
              <span className={styles.varAliasIcon}>
                <Icon icon="solar:link-linear" width={10} height={10} />
              </span>
              <span className={styles.varName}>{a.name}</span>
              {a.targetName && (
                <span className={styles.varAlias}>→ {a.targetName}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===========================
// 메인 컴포넌트
// ===========================
interface Props {
  data: PixelForgeJson;
  importing: boolean;
  error: string | null;
  onImport: () => void;
  onReset: () => void;
  /** true면 푸터(생성 버튼 영역)를 숨김 — 부모가 확인 단계를 직접 제어할 때 사용 */
  hideFooter?: boolean;
}

export default function JsonAnalysisPanel({ data, importing, error, onImport, onReset, hideFooter = false }: Props) {
  const collections = analyzeVariables(data);

  const colorStyles = data.styles?.colors ?? [];
  const textStyles = data.styles?.texts ?? [];
  const radiusItems = data.radius ?? [];
  const spacingItems = data.spacing ?? [];

  // 임포트될 토큰 총 수 계산
  let totalColors = 0;
  if (data.variables) {
    for (const col of collections) totalColors += col.colors.length;
    if (totalColors === 0) totalColors = colorStyles.length;
  } else {
    totalColors = colorStyles.length;
  }
  const totalTypo = textStyles.length;
  const totalRadius = radiusItems.length;
  const totalSpacing = spacingItems.length;

  return (
    <div className={styles.panel}>
      {/* ── 헤더 */}
      <div className={styles.panelHeader}>
        <div className={styles.panelHeaderLeft}>
          <Icon icon="solar:file-text-linear" width={14} height={14} className={styles.panelFileIcon} />
          <div className={styles.panelMeta}>
            <span className={styles.panelFileName}>{data.meta.fileName}</span>
            <div className={styles.panelMetaRow}>
              {data.meta.extractedAt && (
                <span className={styles.panelMetaItem}>
                  <Icon icon="solar:clock-linear" width={10} height={10} />
                  {formatDate(data.meta.extractedAt)}
                </span>
              )}
              {data.meta.totalNodes != null && (
                <span className={styles.panelMetaItem}>
                  <Icon icon="solar:widget-3-linear" width={10} height={10} />
                  {data.meta.totalNodes.toLocaleString()} nodes
                </span>
              )}
            </div>
          </div>
        </div>
        <button type="button" className={styles.panelCloseBtn} onClick={onReset} aria-label="분석 닫기">
          <Icon icon="solar:close-linear" width={13} height={13} />
        </button>
      </div>

      <div className={styles.panelBody}>

        {/* ── Variables 섹션 */}
        {collections.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Variables</span>
              <span className={styles.sectionCount}>
                {data.variables?.variables.length ?? 0}
              </span>
            </div>
            <div className={styles.collectionList}>
              {collections.map((col) => (
                <CollectionBlock key={col.id} col={col} />
              ))}
            </div>
          </section>
        )}

        {/* ── 최상위 배열 토큰 섹션 (radius, spacing) */}
        {(radiusItems.length > 0 || spacingItems.length > 0) && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Tokens</span>
              <span className={styles.sectionCount}>{radiusItems.length + spacingItems.length}</span>
            </div>

            {radiusItems.length > 0 && (
              <div className={styles.styleGroup}>
                <span className={styles.styleGroupLabel}>
                  <Icon icon="solar:crop-minimalistic-linear" width={11} height={11} />
                  Radius {radiusItems.length}
                </span>
                <div className={styles.varList}>
                  {radiusItems.map((r) => {
                    const raw = Object.values(r.valuesByMode)[0];
                    const val = typeof raw === 'number' ? raw : null;
                    return (
                      <div key={r.id} className={styles.varRow}>
                        <span className={styles.varNumIcon}>
                          <Icon icon="solar:hashtag-linear" width={10} height={10} />
                        </span>
                        <span className={styles.varName}>{r.name}</span>
                        <span className={styles.varValue}>{val != null ? `${val}px` : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {spacingItems.length > 0 && (
              <div className={styles.styleGroup}>
                <span className={styles.styleGroupLabel}>
                  <Icon icon="solar:ruler-linear" width={11} height={11} />
                  Spacing {spacingItems.length}
                </span>
                <div className={styles.varList}>
                  {spacingItems.map((s) => {
                    const raw = Object.values(s.valuesByMode)[0];
                    const val = typeof raw === 'number' ? raw : null;
                    return (
                      <div key={s.id} className={styles.varRow}>
                        <span className={styles.varNumIcon}>
                          <Icon icon="solar:hashtag-linear" width={10} height={10} />
                        </span>
                        <span className={styles.varName}>{s.name}</span>
                        <span className={styles.varValue}>{val != null ? `${val}px` : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Styles 섹션 */}
        {(colorStyles.length > 0 || textStyles.length > 0) && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Styles</span>
              <span className={styles.sectionCount}>{colorStyles.length + textStyles.length}</span>
            </div>

            {colorStyles.length > 0 && (
              <div className={styles.styleGroup}>
                <span className={styles.styleGroupLabel}>
                  <Icon icon="solar:pallete-linear" width={11} height={11} />
                  Colors {colorStyles.length}
                </span>
                <div className={styles.swatchGrid}>
                  {colorStyles.map((s) => {
                    const paint = s.paints.find((p) => p.type === 'SOLID' && p.color);
                    const hex = paint?.color
                      ? rgbToHex(paint.color.r, paint.color.g, paint.color.b)
                      : '#888';
                    return (
                      <span
                        key={s.id}
                        className={styles.styleSwatch}
                        style={{ background: hex }}
                        title={`${s.name} ${hex}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {textStyles.length > 0 && (
              <div className={styles.styleGroup}>
                <span className={styles.styleGroupLabel}>
                  <Icon icon="solar:text-field-linear" width={11} height={11} />
                  Typography {textStyles.length}
                </span>
                <div className={styles.typoList}>
                  {textStyles.map((t) => (
                    <div key={t.id} className={styles.typoRow}>
                      <span className={styles.typoName}>{t.name}</span>
                      <span className={styles.typoMeta}>
                        {t.fontName.family} {t.fontSize}px / {t.fontName.style}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── 푸터 */}
      {!hideFooter && <div className={styles.panelFooter}>
        {error && <p className={styles.panelError} role="alert">{error}</p>}
        <div className={styles.panelFooterRow}>
          <div className={styles.importSummary}>
            {totalColors > 0 && (
              <span className={styles.importChip}>
                <Icon icon="solar:pallete-linear" width={11} height={11} />
                Colors {totalColors}
              </span>
            )}
            {totalTypo > 0 && (
              <span className={styles.importChip}>
                <Icon icon="solar:text-field-linear" width={11} height={11} />
                Typography {totalTypo}
              </span>
            )}
            {totalRadius > 0 && (
              <span className={styles.importChip}>
                <Icon icon="solar:crop-minimalistic-linear" width={11} height={11} />
                Radius {totalRadius}
              </span>
            )}
            {totalSpacing > 0 && (
              <span className={styles.importChip}>
                <Icon icon="solar:ruler-linear" width={11} height={11} />
                Spacing {totalSpacing}
              </span>
            )}
          </div>
          <button
            type="button"
            className={styles.importBtn}
            onClick={onImport}
            disabled={importing}
          >
            <Icon icon="solar:import-linear" width={14} height={14} />
            {importing ? '임포트 중...' : '모든 토큰 가져오기'}
          </button>
        </div>
      </div>}
    </div>
  );
}
