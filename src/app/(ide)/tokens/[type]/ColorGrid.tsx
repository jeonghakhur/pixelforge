'use client';

import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import type { TokenRow } from '@/lib/actions/tokens';
import { deleteTokenAction } from '@/lib/actions/tokens';
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

// CSS 변수명: --color-{name-with-dashes}
function toCssVar(type: string, name: string): string {
  return `--${type}-${name.replace(/[/ ]+/g, '-').toLowerCase()}`;
}

// ── 그룹핑 ───────────────────────────────────────────────

function groupTokens(tokens: TokenRow[]): [string, TokenRow[]][] {
  const map = new Map<string, TokenRow[]>();
  for (const token of tokens) {
    // collectionName 우선, 없으면 첫 세그먼트, 없으면 'Uncategorized'
    const key = token.collectionName
      || (token.name.includes('/') ? token.name.split('/')[0] : 'Uncategorized');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(token);
  }
  // 그룹 내 토큰을 이름 기준 알파벳 정렬
  return Array.from(map.entries()).map(([key, list]) => [
    key,
    [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
  ]);
}

// ── 컴포넌트 ─────────────────────────────────────────────

export default function ColorGrid({ tokens: initial }: { tokens: TokenRow[] }) {
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const [tokens, setTokens] = useState<TokenRow[]>(initial);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TokenRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const groups = useMemo(() => groupTokens(tokens), [tokens]);

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
      <div className={styles.colorGroups}>
        {groups.map(([group, groupTokens]) => (
          <section key={group} className={styles.colorGroupSection}>
            <div className={styles.colorGroupHeader}>
              <div className={styles.colorGroupHeaderLeft}>
                <span className={styles.colorGroupLabel}>{group}</span>
                <span className={styles.colorGroupCount}>{groupTokens.length}</span>
              </div>
            </div>

            <div className={styles.colorCardGrid}>
              {groupTokens.map((token) => {
                const color = parseColor(token.value);
                if (!color) return null;
                const isCopied = copiedId === token.id;
                const cssVar = toCssVar(token.type, token.name);
                const light = isLight(color.r, color.g, color.b);
                const hexUpper = color.hex.toUpperCase();
                const rgb = `${color.r}, ${color.g}, ${color.b}`;

                return (
                  <div key={token.id} className={styles.colorCard}>
                    {/* 스와치 */}
                    <div
                      className={styles.colorCardSwatch}
                      style={{ backgroundColor: color.hex }}
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
                      <div className={styles.colorCardNameRow}>
                        <span className={styles.colorCardName} title={token.name}>
                          {token.name}
                        </span>
                        <button
                          type="button"
                          className={styles.colorCardCopyBtn}
                          onClick={() => handleCopy(cssVar, token.id)}
                          aria-label={`${cssVar} 복사`}
                          title={`CSS 변수명 복사: ${cssVar}`}
                        >
                          <Icon
                            icon={isCopied ? 'solar:check-circle-linear' : 'solar:copy-linear'}
                            width={14}
                            height={14}
                          />
                        </button>
                      </div>

                      <div className={styles.colorCardDivider} />

                      <div className={styles.colorCardRow}>
                        <span className={styles.colorCardRowLabel}>HEX</span>
                        <span className={styles.colorCardRowValue}>{hexUpper}</span>
                      </div>
                      <div className={styles.colorCardRow}>
                        <span className={styles.colorCardRowLabel}>RGB</span>
                        <span className={styles.colorCardRowValue}>{rgb}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
