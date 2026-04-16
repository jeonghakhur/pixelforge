'use client';

import { useState, useCallback } from 'react';
import { Icon } from '@iconify/react';
import type { TokenRow } from '@/lib/actions/tokens';
import { deleteTokenAction } from '@/lib/actions/tokens';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useUIStore } from '@/stores/useUIStore';
import styles from './token-views.module.scss';

// ── 파싱 유틸 ───────────────────────────────────────────────────────

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return rgb;
  const hex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${hex(parseInt(m[1]))}${hex(parseInt(m[2]))}${hex(parseInt(m[3]))}`;
}

interface ParsedGradient {
  angle: string;
  fromHex: string;
  toHex: string;
}

function parseLinearGradient(value: string): ParsedGradient | null {
  const m = value.match(
    /linear-gradient\(\s*([^,]+),\s*(rgba?\([^)]+\))\s*[\d.]+%,\s*(rgba?\([^)]+\))\s*[\d.]+%\s*\)/,
  );
  if (!m) return null;
  return {
    angle: m[1].trim(),
    fromHex: rgbToHex(m[2]),
    toHex: rgbToHex(m[3]),
  };
}

/** "Gradient/Neutral/600 -> 500 (90deg)" → { from: "600", to: "500" } */
function parseStopNames(name: string): { from: string; to: string } | null {
  const lastPart = name.split('/').pop() ?? name;
  const m = lastPart.match(/^(.+?)\s*->\s*(.+?)\s*\(/);
  if (!m) return null;
  return { from: m[1].trim(), to: m[2].trim() };
}

/**
 * css-generator.ts toVarName 중 gradient 분기 재현 (클라이언트 전용)
 * "Gradient/Neutral/800 -> 600 (45deg)" → "--neutral-800-600-45deg"
 */
function toGradientVarName(fullName: string): string {
  const segments = fullName.split('/');
  if (segments.length > 1 && /^gradient$/i.test(segments[0])) segments.shift();
  const cleaned = segments
    .join('-')
    .replace(/[·․]/g, '-')
    .replace(/[>()<>.]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const needsPrefix = /^\d/.test(cleaned);
  return needsPrefix ? `--gradient-${cleaned}` : `--${cleaned}`;
}

function groupTokens(tokens: TokenRow[]): [string, TokenRow[]][] {
  const map = new Map<string, TokenRow[]>();
  for (const token of tokens) {
    const parts = token.name.split('/');
    // "Gradient/Neutral/…" → group = "Neutral"
    // "Gradient/Linear/…"  → group = "Linear"
    const group = parts.length >= 3 ? parts[1] : (parts.length === 2 ? parts[1] : 'Other');
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(token);
  }
  return Array.from(map.entries());
}

// ── 카드 컴포넌트 ────────────────────────────────────────────────────

interface GradientCardProps {
  token: TokenRow;
  onDelete: (token: TokenRow) => void;
}

function GradientCard({ token, onDelete }: GradientCardProps) {
  const parsed = parseLinearGradient(token.value);
  const stops = parseStopNames(token.name);
  const varName = toGradientVarName(token.name);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(varName).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [varName]);

  return (
    <div className={styles.gradientCard}>
      {/* 프리뷰 */}
      <div
        className={styles.gradientPreview}
        style={{ background: token.value }}
        title={token.value}
      />

      {/* 메타 */}
      <div className={styles.gradientMeta}>
        <span
          className={styles.gradientName}
          onClick={handleCopy}
          title={copied ? '복사됨!' : '클릭하여 복사'}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleCopy()}
        >
          {copied ? '복사됨!' : varName}
        </span>
        {parsed && stops ? (
          <>
            <div className={styles.gradientStopRow}>
              <span className={styles.gradientStopLabel}>{stops.from}</span>
              <span className={styles.gradientStopLabel}>{stops.to}</span>
            </div>
            <div className={styles.gradientColorRow}>
              <span className={styles.gradientHex}>{parsed.fromHex}</span>
              <span className={styles.gradientAngle}>{parsed.angle}</span>
              <span className={styles.gradientHex}>{parsed.toHex}</span>
            </div>
          </>
        ) : parsed ? (
          <span className={styles.gradientAngle}>{parsed.angle}</span>
        ) : null}
      </div>

      {/* 삭제 버튼 */}
      <button
        type="button"
        className={`${styles.actionBtn} ${styles.actionBtnDelete} ${styles.gradientDeleteBtn}`}
        onClick={() => onDelete(token)}
        aria-label="삭제"
      >
        <Icon icon="solar:trash-bin-2-linear" width={13} height={13} />
      </button>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────

export default function GradientList({ tokens: initial }: { tokens: TokenRow[] }) {
  const invalidateTokens = useUIStore((s) => s.invalidateTokens);
  const [tokens, setTokens] = useState<TokenRow[]>(initial);
  const [deleteTarget, setDeleteTarget] = useState<TokenRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const groups = groupTokens(tokens);

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
              <span className={styles.colorGroupLabel}>{group}</span>
              <span className={styles.colorGroupCount}>{groupTokens.length}</span>
            </div>
            <div className={styles.gradientGrid}>
              {groupTokens.map((token) => (
                <GradientCard
                  key={token.id}
                  token={token}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="토큰 삭제"
        message={`'${deleteTarget?.name}' 그라디언트 토큰을 삭제합니다.`}
        confirmLabel="삭제"
        loading={deleting}
      />
    </>
  );
}
