'use client';

import { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import type { TokenRow } from '@/lib/actions/tokens';
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

// ── 그룹핑 (Figma 원본 순서 유지) ───────────────────────

interface ColorFamily {
  key: string;       // family 키 (경로 앞 1~2 세그먼트)
  tokens: TokenRow[];
}

interface ColorCollection {
  name: string;
  families: ColorFamily[];
}

function groupTokens(tokens: TokenRow[]): ColorCollection[] {
  // 입력은 이미 sortOrder 기준으로 정렬됨 (DB 쿼리에서 ORDER BY sort_order)

  // 1. 컬렉션 순서 유지 (처음 등장 순)
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

    // 2. family 키 추출 (경로 앞 1~2 세그먼트) — 등장 순서 유지
    const familyOrder: string[] = [];
    const familyMap = new Map<string, TokenRow[]>();
    for (const token of list) {
      const segs = token.name.split('/');
      const familyKey = segs.length >= 3 ? `${segs[0]}/${segs[1]}` : segs[0];
      if (!familyMap.has(familyKey)) {
        familyOrder.push(familyKey);
        familyMap.set(familyKey, []);
      }
      familyMap.get(familyKey)!.push(token);
    }

    const families: ColorFamily[] = familyOrder.map((key) => ({
      key,
      tokens: familyMap.get(key)!,   // 이미 sortOrder 순
    }));

    return { name: collectionName, families };
  });
}

// ── 컴포넌트 ─────────────────────────────────────────────

export default function ColorGrid({ tokens: initial }: { tokens: TokenRow[] }) {
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const [tokens, setTokens] = useState<TokenRow[]>(initial);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TokenRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const collections = useMemo(() => groupTokens(tokens), [tokens]);

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
                {/* 패밀리 구분선 (첫 번째 제외) */}
                {familyIdx > 0 && <div className={styles.colorFamilyDivider} />}

                {/* 패밀리 레이블 (컬렉션 이름과 다를 때만 표시) */}
                {family.key !== collection.name && (
                  <div className={styles.colorFamilyLabel}>
                    <span>{family.key.split('/').pop()}</span>
                    <span className={styles.colorFamilyCount}>{family.tokens.length}</span>
                  </div>
                )}

                <div className={styles.colorCardGrid}>
                  {family.tokens.map((token) => {
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
                          </div>

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
