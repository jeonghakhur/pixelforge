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

/** alias 필드(var(--spacing-8) 형태)에서 참조하는 primitive 이름을 찾아 반환 */
function resolveAliasLabel(
  alias: string | null,
  primitiveMap: Map<string, TokenRow>,
): string | null {
  if (!alias) return null;
  // value가 var(--spacing-X) 형태 → X를 추출해서 primitive 매핑
  const varMatch = alias.match(/^VariableID:(.+)$/);
  if (varMatch) {
    // alias 가 VariableID 형태인 경우는 primitive와 직접 매핑 불가 → value 기반 매핑
    return null;
  }
  return null;
}

/** value 문자열(var(--spacing-8) 등)에서 primitive 참조명 추출 */
function extractAliasRef(value: string): string | null {
  const m = value.match(/^var\(--(.+)\)$/);
  return m ? m[1] : null;
}

/* ── 그룹핑 ───────────────────────────────────────── */

interface SpacingCollection {
  name: string;
  label: string;
  description: string;
  tokens: TokenRow[];
}

const COLLECTION_ORDER: Record<string, number> = {
  '_Primitives': 0,
  '3. Spacing': 1,
  '4. Widths': 2,
  '5. Containers': 3,
};

const COLLECTION_LABELS: Record<string, string> = {
  '_Primitives': 'Primitives',
  '3. Spacing': 'Spacing',
  '4. Widths': 'Widths',
  '5. Containers': 'Containers',
};

const COLLECTION_DESCRIPTIONS: Record<string, string> = {
  '_Primitives': '기본 수치 스페이싱 스케일입니다. 하나의 스페이싱 단위는 4px에 해당합니다.',
  '3. Spacing': '시맨틱 스페이싱 토큰은 Primitive 값을 참조하여 일관된 간격 시스템을 제공합니다.',
  '4. Widths': '컨텐츠 영역과 컴포넌트의 너비를 정의하는 토큰입니다.',
  '5. Containers': '컨테이너 패딩과 최대 너비 전용 변수입니다.',
};

function groupByCollection(tokens: TokenRow[]): SpacingCollection[] {
  const map = new Map<string, TokenRow[]>();

  for (const token of tokens) {
    const key = token.collectionName || '_Primitives';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(token);
  }

  return [...map.entries()]
    .sort(([a], [b]) => (COLLECTION_ORDER[a] ?? 99) - (COLLECTION_ORDER[b] ?? 99))
    .map(([name, list]) => ({
      name,
      label: COLLECTION_LABELS[name] ?? name,
      description: COLLECTION_DESCRIPTIONS[name] ?? '',
      tokens: [...list].sort((a, b) => extractPxValue(a) - extractPxValue(b)),
    }));
}

/* ── 컴포넌트 ─────────────────────────────────────── */

export default function SpacingList({ tokens: initial }: { tokens: TokenRow[] }) {
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const [tokens, setTokens] = useState<TokenRow[]>(initial);
  const [deleteTarget, setDeleteTarget] = useState<TokenRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const collections = useMemo(() => groupByCollection(tokens), [tokens]);

  /** primitive name → token 매핑 (alias 해석용) */
  const primitiveByVar = useMemo(() => {
    const map = new Map<string, TokenRow>();
    for (const token of tokens) {
      if ((token.collectionName || '_Primitives') === '_Primitives') {
        // var name: spacing-0, spacing-0-5, spacing-1 ...
        const name = displayName(token.name);
        // "0 (0px)" → "0", "0․5 (2px)" → "0-5"
        const clean = name.replace(/\s*\(.*\)/, '').replace(/[․.]/g, '-');
        map.set(`spacing-${clean}`, token);
      }
    }
    return map;
  }, [tokens]);

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
        {collections.map((collection) => {
          const isPrimitive = collection.name === '_Primitives';
          const maxVal = Math.max(...collection.tokens.map(extractPxValue), 1);

          return (
            <section key={collection.name} className={styles.spacingSection}>
              {/* 섹션 헤더 */}
              <div className={styles.spacingSectionHeader}>
                <div className={styles.spacingSectionHeaderLeft}>
                  <h3 className={styles.spacingSectionTitle}>{collection.label}</h3>
                  <span className={styles.spacingSectionCount}>{collection.tokens.length}</span>
                  {isPrimitive && (
                    <span className={styles.baseUnitBadge}>Base: 4px</span>
                  )}
                </div>
              </div>

              {collection.description && (
                <p className={styles.spacingSectionDesc}>{collection.description}</p>
              )}

              {/* 테이블 헤더 */}
              <div className={`${styles.spacingTableHeader} ${isPrimitive ? styles.spacingTablePrimitive : ''}`}>
                <span className={styles.spacingColName}>Name</span>
                {!isPrimitive && <span className={styles.spacingColAlias}>Reference</span>}
                <span className={styles.spacingColRem}>Rem</span>
                <span className={styles.spacingColPx}>Pixels</span>
                <span className={styles.spacingColBar}>Scale</span>
                <span className={styles.spacingColActions} />
              </div>

              {/* 토큰 행 */}
              <div className={`${styles.spacingTableBody} ${isPrimitive ? styles.spacingTablePrimitive : ''}`}>
                {collection.tokens.map((token) => {
                  const px = extractPxValue(token);
                  const rem = px / 16;
                  const remStr = rem % 1 === 0 ? `${rem}` : rem.toFixed(2).replace(/0+$/, '');
                  const barPct = maxVal > 0 ? (px / maxVal) * 100 : 0;
                  const aliasRef = extractAliasRef(token.value);
                  const resolvedPrimitive = aliasRef ? primitiveByVar.get(aliasRef) : null;
                  const resolvedPx = resolvedPrimitive ? extractPxValue(resolvedPrimitive) : null;
                  const isCopied = copiedId === token.id;

                  return (
                    <div key={token.id} className={`${styles.spacingTableRow} ${isPrimitive ? styles.spacingTablePrimitive : ''}`}>
                      <div className={styles.spacingColName}>
                        <span className={styles.spacingTokenName}>{displayName(token.name)}</span>
                      </div>

                      {!isPrimitive && (
                        <div className={styles.spacingColAlias}>
                          {aliasRef && (
                            <span className={styles.spacingAliasRef} title={`var(--${aliasRef})`}>
                              <Icon icon="solar:arrow-right-linear" width={10} height={10} className={styles.spacingAliasIcon} />
                              {aliasRef}
                              {resolvedPx !== null && (
                                <span className={styles.spacingAliasResolved}>({resolvedPx}px)</span>
                              )}
                            </span>
                          )}
                        </div>
                      )}

                      <span className={styles.spacingColRem}>{remStr}rem</span>
                      <span className={styles.spacingColPx}>{px}px</span>

                      <div className={styles.spacingColBar}>
                        <div className={styles.spacingTrack}>
                          <div
                            className={styles.spacingFill}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>

                      <div className={styles.spacingColActions}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => handleCopy(`var(--pf-${token.type}-${displayName(token.name).replace(/[^\w-]/g, '-').toLowerCase()})`, token.id)}
                          aria-label="CSS 변수 복사"
                        >
                          <Icon
                            icon={isCopied ? 'solar:check-circle-linear' : 'solar:copy-linear'}
                            width={13}
                            height={13}
                          />
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
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="토큰 삭제"
        message={`'${deleteTarget?.name}' 간격 토큰을 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        loading={deleting}
      />
    </>
  );
}
