'use client';

import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import type { TokenRow } from '@/lib/actions/tokens';
import type { ResolvedColorToken } from '@/lib/tokens/resolve-alias';
import { deleteTokenAction } from '@/lib/actions/tokens';
import { toVarName, TYPE_PREFIX } from '@/lib/tokens/css-generator';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/stores/useUIStore';
import styles from './token-views.module.scss';

// ── 파서 ─────────────────────────────────────────────────

interface ParsedColor {
  hex: string;
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(value: string): ParsedColor | null {
  // JSON 포맷 { hex, rgba }
  try {
    const parsed = JSON.parse(value) as { hex?: string; rgba?: { r: number; g: number; b: number; a: number } };
    if (parsed.hex) {
      const hex = parsed.hex.slice(0, 7);
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { hex, r, g, b, a: parsed.rgba?.a ?? 1 };
    }
  } catch { /* fall through */ }

  // plain hex #rrggbb
  const hexMatch = value.match(/^#([0-9a-fA-F]{6})/);
  if (hexMatch) {
    const hex = `#${hexMatch[1]}`;
    const r = parseInt(hexMatch[1].slice(0, 2), 16);
    const g = parseInt(hexMatch[1].slice(2, 4), 16);
    const b = parseInt(hexMatch[1].slice(4, 6), 16);
    return { hex, r, g, b, a: 1 };
  }

  // rgba(r, g, b, a)
  const rgbaMatch = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]);
    const g = parseInt(rgbaMatch[2]);
    const b = parseInt(rgbaMatch[3]);
    const a = parseFloat(rgbaMatch[4] ?? '1');
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    return { hex, r, g, b, a };
  }

  return null;
}

function isLight(r: number, g: number, b: number): boolean {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

function toCssVar(type: string, name: string): string {
  const prefix = TYPE_PREFIX[type] ?? type;
  return toVarName(name, prefix);
}

// ── 그룹핑 ───────────────────────────────────────────────

interface ColorFamily {
  key: string;
  tokens: TokenRow[];
}

interface ColorCollection {
  name: string;
  families: ColorFamily[];
}

/** family 키에서 시맨틱 그룹 정렬 키 추출 */
function familySortKey(familyKey: string): number {
  const sub = familyKey.split('/').pop()?.toLowerCase() ?? '';
  const ORDER: Record<string, number> = {
    'base': 0, 'background': 100, 'text': 101, 'foreground': 102, 'border': 103,
    'effects': 104, 'utility': 200, 'components': 201, 'alpha': 202,
  };
  return ORDER[sub] ?? 50;
}

function groupTokens(tokens: TokenRow[]): ColorCollection[] {
  const collectionOrder: string[] = [];
  const collectionMap = new Map<string, TokenRow[]>();
  for (const token of tokens) {
    const key = token.collectionName
      || (token.name.includes('/') ? token.name.split('/')[0] : 'Uncategorized');
    if (!collectionMap.has(key)) {
      collectionOrder.push(key);
      collectionMap.set(key, []);
    }
    collectionMap.get(key)!.push(token);
  }

  return collectionOrder.map((collectionName) => {
    const list = collectionMap.get(collectionName)!;

    const familyMap = new Map<string, TokenRow[]>();
    for (const token of list) {
      const segs = token.name.split('/');
      const familyKey = segs.length >= 3 ? `${segs[0]}/${segs[1]}` : segs[0];
      if (!familyMap.has(familyKey)) {
        familyMap.set(familyKey, []);
      }
      familyMap.get(familyKey)!.push(token);
    }

    const families: ColorFamily[] = [...familyMap.entries()]
      .sort(([a], [b]) => familySortKey(a) - familySortKey(b))
      .map(([key, familyTokens]) => ({ key, tokens: familyTokens }));

    return { name: collectionName, families };
  });
}

// ── 컴포넌트 ─────────────────────────────────────────────

export default function ColorGrid({ tokens: initial, cssVarOrder = [] }: { tokens: ResolvedColorToken[]; cssVarOrder?: string[] }) {
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const [tokens, setTokens] = useState<ResolvedColorToken[]>(initial);
  const [modeFilter, setModeFilter] = useState<'all' | 'light' | 'dark'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TokenRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // tokens.css 변수 순서로 정렬 인덱스 구축
  const varOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    cssVarOrder.forEach((v, i) => map.set(v, i));
    return map;
  }, [cssVarOrder]);

  const sorted = useMemo(() => {
    if (varOrderMap.size === 0) return tokens;
    return [...tokens].sort((a, b) => {
      const varA = toCssVar(a.type, a.name);
      const varB = toCssVar(b.type, b.name);
      const idxA = varOrderMap.get(varA) ?? 99999;
      const idxB = varOrderMap.get(varB) ?? 99999;
      return idxA - idxB;
    });
  }, [tokens, varOrderMap]);

  const filtered = useMemo(() => {
    if (modeFilter === 'all') return sorted;
    return sorted.filter((t) => {
      if (!t.mode) return modeFilter === 'light';
      return t.mode.toLowerCase().includes(modeFilter);
    });
  }, [sorted, modeFilter]);

  const collections = useMemo(() => groupTokens(filtered), [filtered]);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteTokenAction(deleteTarget.id);
    setDeleting(false);
    if (!error) {
      setTokens((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      invalidateTokens();
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <div className={styles.colorModeFilter}>
        {(['all', 'light', 'dark'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`${styles.colorModeBtn} ${modeFilter === mode ? styles.colorModeBtnActive : ''}`}
            onClick={() => setModeFilter(mode)}
          >
            {mode === 'all' ? 'All' : mode === 'light' ? 'Light' : 'Dark'}
            {mode !== 'all' && (
              <span className={styles.colorModeCount}>
                {tokens.filter((t) =>
                  mode === 'light' ? !t.mode || t.mode.toLowerCase().includes('light') : t.mode?.toLowerCase().includes('dark'),
                ).length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className={styles.colorGroups}>
        {collections.map((collection) => (
          <section key={collection.name} className={styles.colorGroupSection}>
            <div className={styles.colorGroupHeader}>
              <div className={styles.colorGroupHeaderLeft}>
                <span className={styles.colorGroupLabel}>{collection.name}</span>
                <span className={styles.colorGroupCount}>
                  {collection.families.reduce((s, f) => s + f.tokens.length, 0)}
                </span>
              </div>
            </div>

            {collection.families.map((family, familyIdx) => (
              <div key={family.key} className={styles.colorFamily}>
                {familyIdx > 0 && <div className={styles.colorFamilyDivider} />}

                {family.key !== collection.name && (
                  <div className={styles.colorFamilyLabel}>
                    <span>{family.key.split('/').pop()}</span>
                    <span className={styles.colorFamilyCount}>{family.tokens.length}</span>
                  </div>
                )}

                <div className={styles.colorCardGrid}>
                  {family.tokens.map((token) => {
                    const resolved = (token as ResolvedColorToken).resolvedHex;
                    const aliasTarget = (token as ResolvedColorToken).aliasTarget;
                    const color = parseColor(resolved ?? token.value);
                    if (!color) return null;
                    const isCopied = copiedId === token.id;
                    const cssVar = toCssVar(token.type, token.name);
                    const light = isLight(color.r, color.g, color.b);
                    const hasAlpha = color.a < 1;
                    const hexUpper = color.hex.toUpperCase();
                    const rgb = `${color.r}, ${color.g}, ${color.b}`;
                    const rgbaStr = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
                    const displayHex = hasAlpha
                      ? `${hexUpper} ${Math.round(color.a * 100)}%`
                      : hexUpper;

                    return (
                      <div key={token.id} className={styles.colorCard}>
                        {/* 스와치 */}
                        <div
                          className={styles.colorCardSwatch}
                          style={{ backgroundColor: `var(${cssVar}, ${hasAlpha ? rgbaStr : color.hex})` }}
                        >
                          {token.mode && (
                            <span
                              className={styles.colorCardMode}
                              style={{ color: light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)' }}
                            >
                              {token.mode}
                            </span>
                          )}
                          <button
                            type="button"
                            className={`${styles.colorCardDeleteBtn} ${light ? styles.colorCardDeleteBtnLight : ''}`}
                            onClick={() => setDeleteTarget(token)}
                            aria-label="삭제"
                          >
                            <Icon icon="solar:trash-bin-2-linear" width={12} height={12} />
                          </button>
                        </div>

                        {/* 정보 */}
                        <div className={styles.colorCardBody}>
                          <div className={styles.colorCardVarRow}>
                            <span className={styles.colorCardVar} title={cssVar}>
                              {cssVar}
                            </span>
                            <button
                              type="button"
                              className={styles.colorCardCopyBtn}
                              onClick={() => handleCopy(cssVar, token.id)}
                              aria-label={`${cssVar} 복사`}
                            >
                              <Icon
                                icon={isCopied ? 'solar:check-circle-linear' : 'solar:copy-linear'}
                                width={12}
                                height={12}
                              />
                            </button>
                          </div>

                          {aliasTarget && (
                            <div className={styles.colorCardAliasRow}>
                              <span className={styles.colorCardAliasIcon}>
                                <Icon icon="solar:arrow-right-linear" width={10} height={10} />
                              </span>
                              <span className={styles.colorCardAliasRef} title={aliasTarget}>
                                {aliasTarget.replace(/^--/, '')}
                              </span>
                            </div>
                          )}

                          <div className={styles.colorCardDivider} />

                          <div className={styles.colorCardRow}>
                            <span className={styles.colorCardRowLabel}>HEX</span>
                            <span className={styles.colorCardRowValue}>{displayHex}</span>
                          </div>
                          <div className={styles.colorCardRow}>
                            <span className={styles.colorCardRowLabel}>{hasAlpha ? 'RGBA' : 'RGB'}</span>
                            <span className={styles.colorCardRowValue}>{hasAlpha ? `${rgb}, ${color.a}` : rgb}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="토큰 삭제"
        message={`'${deleteTarget?.name}' 색상 토큰을 삭제합니다.`}
        confirmLabel="삭제"
        loading={deleting}
      />
    </>
  );
}
