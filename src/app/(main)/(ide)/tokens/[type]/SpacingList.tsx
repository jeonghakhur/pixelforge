'use client';

import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import type { TokenRow } from '@/lib/actions/tokens';
import { deleteTokenAction } from '@/lib/actions/tokens';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/stores/useUIStore';
import styles from './token-views.module.scss';

/* ── 유틸 ─────────────────────────────────────────── */

function extractPxValue(token: TokenRow): number {
  const num = parseFloat(token.value);
  if (!isNaN(num)) return num;
  if (token.raw) {
    const m = token.raw.match(/[\d.]+/);
    if (m) return parseFloat(m[0]);
  }
  return 0;
}

function displayName(fullName: string): string {
  const slash = fullName.lastIndexOf('/');
  return slash >= 0 ? fullName.slice(slash + 1) : fullName;
}

function extractAliasRef(value: string): string | null {
  const m = value.match(/^var\(--(.+)\)$/);
  return m ? m[1] : null;
}

/** primitive name → CSS var key — mirrors toVarName(name, 'spacing') logic.
 *  "Spacing/0 (0px)"    → "spacing-0"
 *  "Spacing/0.5 (2px)"  → "spacing-0.5"
 *  "spacing/spacing-4"  → "spacing-4"
 */
function primitiveVarKey(name: string): string {
  let slug = name
    .replace(/\([^)]*\)/g, '')
    .replace(/[·․\u2024\u00B7\u2027]/g, '-')
    .replace(/\./g, '-')
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  while (slug.startsWith('spacing-')) slug = slug.slice('spacing-'.length);
  return `spacing-${slug}`;
}

/* ── 참조 primitive 필터 ─────────────────────────── */

function filterReferencedPrimitives(
  semanticTokens: TokenRow[],
  allPrimitives: TokenRow[],
): TokenRow[] {
  const refs = new Set<string>();
  for (const t of semanticTokens) {
    const ref = extractAliasRef(t.value);
    if (ref) refs.add(ref);
  }
  if (refs.size === 0) return [];
  return allPrimitives
    .filter((p) => refs.has(primitiveVarKey(p.name)))
    .sort((a, b) => extractPxValue(a) - extractPxValue(b));
}

function buildPrimitiveMap(tokens: TokenRow[]): Map<string, TokenRow> {
  const map = new Map<string, TokenRow>();
  for (const t of tokens) {
    if (!t.value.startsWith('var(--')) {
      map.set(primitiveVarKey(t.name), t);
    }
  }
  return map;
}

/* ── 컴포넌트 ─────────────────────────────────────── */

interface SpacingListProps {
  tokens: TokenRow[];
  /** 외부에서 주입하는 전체 spacing primitive (width/container 페이지용) */
  primitives?: TokenRow[];
}

export default function SpacingList({ tokens: initial, primitives: externalPrimitives }: SpacingListProps) {
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const [tokens, setTokens] = useState<TokenRow[]>(initial);
  const [deleteTarget, setDeleteTarget] = useState<TokenRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // primitive: 직접 수치를 가진 토큰 (alias 아님)
  const ownPrimitives = useMemo(
    () => tokens
      .filter((t) => !t.value.startsWith('var(--'))
      .sort((a, b) => extractPxValue(a) - extractPxValue(b)),
    [tokens],
  );

  // 시맨틱 토큰: alias(var) 참조를 가진 토큰
  const semanticTokens = useMemo(
    () => tokens
      .filter((t) => t.value.startsWith('var(--'))
      .sort((a, b) => extractPxValue(a) - extractPxValue(b)),
    [tokens],
  );

  // 외부 primitive가 있으면(width/container) → 참조되는 것만 필터
  // 없으면(spacing) → 자체 _Primitives 사용
  const displayPrimitives = useMemo(() => {
    if (externalPrimitives && externalPrimitives.length > 0) {
      return filterReferencedPrimitives(semanticTokens, externalPrimitives);
    }
    return ownPrimitives;
  }, [externalPrimitives, semanticTokens, ownPrimitives]);

  // primitive map (alias 해석용) — 자체 + 외부 합산
  const primitiveMap = useMemo(() => {
    const all = [...ownPrimitives, ...(externalPrimitives ?? [])];
    return buildPrimitiveMap(all);
  }, [ownPrimitives, externalPrimitives]);

  // Scale 바 공통 max — 표시되는 모든 토큰의 실제 px 기준
  const globalMaxPx = useMemo(() => {
    const allPx = [
      ...displayPrimitives.map(extractPxValue),
      ...semanticTokens.map((t) => {
        const ref = extractAliasRef(t.value);
        const prim = ref ? primitiveMap.get(ref) : null;
        return prim ? extractPxValue(prim) : extractPxValue(t);
      }),
    ];
    return Math.max(...allPx, 1);
  }, [displayPrimitives, semanticTokens, primitiveMap]);

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

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <>
      <div className={styles.spacingCollections}>
        {/* ── Primitives (상단) ── */}
        {displayPrimitives.length > 0 && (
          <section className={styles.spacingSection}>
            <div className={styles.spacingSectionHeader}>
              <div className={styles.spacingSectionHeaderLeft}>
                <h3 className={styles.spacingSectionTitle}>Primitives</h3>
                <span className={styles.spacingSectionCount}>{displayPrimitives.length}</span>
              </div>
            </div>

            <div className={`${styles.spacingTableHeader} ${styles.spacingTablePrimitive}`}>
              <span>Name</span>
              <span>Rem</span>
              <span>Pixels</span>
              <span>Scale</span>
              <span />
            </div>

            <div className={`${styles.spacingTableBody} ${styles.spacingTablePrimitive}`}>
              {displayPrimitives.map((token) => {
                const px = extractPxValue(token);
                const rem = px / 16;
                const remStr = rem % 1 === 0 ? `${rem}` : rem.toFixed(2).replace(/0+$/, '');
                const barPct = (px / globalMaxPx) * 100;
                const isCopied = copiedId === token.id;

                return (
                  <div key={token.id} className={`${styles.spacingTableRow} ${styles.spacingTablePrimitive}`}>
                    <div className={styles.spacingColName}>
                      <span className={styles.spacingTokenName}>{displayName(token.name)}</span>
                    </div>
                    <span className={styles.spacingColRem}>{remStr}rem</span>
                    <span className={styles.spacingColPx}>{px}px</span>
                    <div className={styles.spacingColBar}>
                      <div className={styles.spacingTrack}>
                        <div className={styles.spacingFill} style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                    <div className={styles.spacingColActions}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => handleCopy(`var(--${primitiveVarKey(token.name)})`, token.id)}
                        aria-label="CSS 변수 복사"
                      >
                        <Icon icon={isCopied ? 'solar:check-circle-linear' : 'solar:copy-linear'} width={13} height={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Semantic Tokens (하단) ── */}
        {semanticTokens.length > 0 && (
          <section className={styles.spacingSection}>
            <div className={styles.spacingSectionHeader}>
              <div className={styles.spacingSectionHeaderLeft}>
                <h3 className={styles.spacingSectionTitle}>Tokens</h3>
                <span className={styles.spacingSectionCount}>{semanticTokens.length}</span>
              </div>
            </div>

            <div className={styles.spacingTableHeader}>
              <span>Name</span>
              <span>Reference</span>
              <span>Rem</span>
              <span>Pixels</span>
              <span>Scale</span>
              <span />
            </div>

            <div className={styles.spacingTableBody}>
              {semanticTokens.map((token) => {
                const aliasRef = extractAliasRef(token.value);
                const prim = aliasRef ? primitiveMap.get(aliasRef) : null;
                const px = prim ? extractPxValue(prim) : extractPxValue(token);
                const rem = px / 16;
                const remStr = rem % 1 === 0 ? `${rem}` : rem.toFixed(2).replace(/0+$/, '');
                const barPct = (px / globalMaxPx) * 100;
                const isCopied = copiedId === token.id;

                return (
                  <div key={token.id} className={styles.spacingTableRow}>
                    <div className={styles.spacingColName}>
                      <span className={styles.spacingTokenName}>{displayName(token.name)}</span>
                    </div>
                    <div className={styles.spacingColAlias}>
                      {aliasRef && (
                        <span className={styles.spacingAliasRef} title={`var(--${aliasRef})`}>
                          <Icon icon="solar:arrow-right-linear" width={10} height={10} className={styles.spacingAliasIcon} />
                          {aliasRef}
                          {prim && (
                            <span className={styles.spacingAliasResolved}>({extractPxValue(prim)}px)</span>
                          )}
                        </span>
                      )}
                    </div>
                    <span className={styles.spacingColRem}>{remStr}rem</span>
                    <span className={styles.spacingColPx}>{px}px</span>
                    <div className={styles.spacingColBar}>
                      <div className={styles.spacingTrack}>
                        <div className={styles.spacingFill} style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                    <div className={styles.spacingColActions}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => handleCopy(`var(--pf-${token.name.replace(/[^\w-]/g, '-').toLowerCase()})`, token.id)}
                        aria-label="CSS 변수 복사"
                      >
                        <Icon icon={isCopied ? 'solar:check-circle-linear' : 'solar:copy-linear'} width={13} height={13} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                        onClick={() => setDeleteTarget(token)}
                        aria-label="삭제"
                      >
                        <Icon icon="solar:trash-bin-2-linear" width={13} height={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="토큰 삭제"
        message={`'${deleteTarget?.name}' 토큰을 삭제합니다.`}
        confirmLabel="삭제"
        loading={deleting}
      />
    </>
  );
}
