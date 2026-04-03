'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { deleteComponent } from '@/lib/actions/components';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import styles from './page.module.scss';

interface Props {
  id: string;
  name: string;
  category: string;
  detectedType: string | null;
  tsx: string | null;
  css: string | null;
  radixProps: string | null;
  version: number;
}

type CodeTab = 'tsx' | 'css';

interface PropDef { name: string; type: string; default: string; description: string }

const PROPS_BY_TYPE: Record<string, PropDef[]> = {
  button: [
    { name: 'variant', type: "'Primary'|'Secondary'|'Default'|'Outline'|'Invisible'", default: "'Primary'", description: '버튼의 시각적 스타일 (Figma variant 이름 기준)' },
    { name: 'size',    type: "'xsmall'|'small'|'medium'|'large'|'xlarge'", default: "'medium'", description: '패딩과 폰트 크기 스케일' },
    { name: 'disabled', type: 'boolean', default: 'false', description: '비활성화 — aria-disabled + data-disabled 동시 적용' },
    { name: 'children', type: 'ReactNode', default: '—', description: '버튼 내부 콘텐츠' },
  ],
};

const USAGE_BY_TYPE: Record<string, { dos: string[]; donts: string[] }> = {
  button: {
    dos: [
      "한 화면 영역에서 주요 액션은 solid 또는 soft variant 하나만 사용하고, 나머지 보조 액션은 ghost나 outline으로 계층을 구분하세요.",
      "레이블은 동사로 시작하는 구체적인 표현을 사용하세요. '저장', '변경 적용', '계정 삭제'처럼 결과를 명확히 전달해야 합니다.",
      "모달이나 폼에서 주요 액션 버튼은 우하단에 배치해 시선 흐름에 맞게 두세요.",
      "파괴적 액션(삭제, 탈퇴 등)은 destructive 스타일을 사용하고 확인 다이얼로그와 함께 제공하세요.",
      "버튼 간 간격은 최소 8px 이상 확보해 실수 클릭을 방지하세요.",
    ],
    donts: [
      "'확인', '클릭', '여기'처럼 행동을 설명하지 않는 모호한 레이블은 사용하지 마세요.",
      "같은 영역에 solid 버튼을 두 개 이상 배치하지 마세요. 시각적 충돌로 사용자가 주요 액션을 파악하기 어렵습니다.",
      "disabled 상태를 기본 상태로 두고 조건 충족 시 활성화하는 패턴에서, disabled 이유를 툴팁 없이 방치하지 마세요.",
      "아이콘만 있는 버튼에는 반드시 aria-label을 제공하세요. 스크린 리더 사용자는 아이콘의 의미를 알 수 없습니다.",
      "로딩 중인 버튼을 그냥 숨기거나 제거하지 마세요. 로딩 스피너와 함께 disabled 처리해 진행 상태를 알려야 합니다.",
    ],
  },
};

// ── Syntax Highlighter ───────────────────────────────────────────────────────
function useHighlightedCode(code: string, lang: 'tsx' | 'css') {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    if (!code) { setHtml(''); return; }

    let cancelled = false;
    (async () => {
      const { codeToHtml } = await import('shiki');
      const result = await codeToHtml(code, {
        lang: lang === 'tsx' ? 'tsx' : 'css',
        theme: 'one-dark-pro',
      });
      if (!cancelled) setHtml(result);
    })();

    return () => { cancelled = true; };
  }, [code, lang]);

  return html;
}

// ── Sandbox ──────────────────────────────────────────────────────────────────
function ButtonSandbox({ radixProps }: { radixProps: string | null }) {
  let defaultVariant = 'Primary';
  let defaultSize = 'medium';
  try {
    const p = JSON.parse(radixProps ?? '{}');
    if (p.variant) defaultVariant = p.variant;
    if (p.size) defaultSize = p.size;
  } catch {}

  const variants = [
    { id: 'Primary',   label: 'Primary' },
    { id: 'Secondary', label: 'Secondary' },
    { id: 'Outline',   label: 'Outline' },
    { id: 'Invisible', label: 'Invisible' },
  ];

  return (
    <div className={styles.sandboxBg}>
      <div className={styles.sandboxCanvas}>
        <div className={styles.variantGrid}>
          {variants.map((v) => (
            <div key={v.id} className={styles.variantItem}>
              <button
                type="button"
                data-variant={v.id}
                data-size={defaultSize}
                className={`${styles.sandboxBtn} ${styles[`sandboxBtn_${v.id}`]} ${v.id === defaultVariant ? styles.sandboxBtnActive : ''}`}
              >
                {v.id.charAt(0).toUpperCase() + v.id.slice(1)}
              </button>
              <span className={styles.variantLabel}>{v.label}</span>
            </div>
          ))}
        </div>
        <div className={styles.statesRow}>
          <button type="button" className={styles.sandboxBtnDisabled} disabled aria-disabled>
            Disabled
          </button>
          <button type="button" className={styles.sandboxBtnDestructive}>
            <Icon icon="solar:danger-triangle-linear" width={13} height={13} />
            Destructive
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ComponentGuideClient({ id, name, category, detectedType, tsx, css, radixProps, version }: Props) {
  const router = useRouter();
  const [codeTab, setCodeTab] = useState<CodeTab>('tsx');
  const [codeOpen, setCodeOpen] = useState(true);
  const [codeHeight, setCodeHeight] = useState(320);
  const [copied, setCopied] = useState(false);

  const CODE_HEIGHT_STEP = 200;
  const CODE_HEIGHT_MIN = 160;
  const CODE_HEIGHT_MAX = 1200;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await deleteComponent(id);
    router.refresh();
    router.push('/components');
  };

  const currentCode = codeTab === 'tsx' ? (tsx ?? '') : (css ?? '');
  const highlightedHtml = useHighlightedCode(currentCode, codeTab === 'css' ? 'css' : 'tsx');
  const props = PROPS_BY_TYPE[detectedType ?? ''] ?? [];
  const usage = USAGE_BY_TYPE[detectedType ?? ''];

  const handleCopy = async () => {
    if (!currentCode) return;
    await navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.breadcrumbRow}>
          {detectedType && (
            <span className={styles.typeBadge}>{detectedType}</span>
          )}
          <span className={styles.breadcrumb}>
            Components / {category} / {name}
          </span>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={() => setDeleteOpen(true)}
            aria-label="컴포넌트 삭제"
          >
            <Icon icon="solar:trash-bin-minimalistic-linear" width={14} height={14} />
            삭제
          </button>
        </div>
        <h1 className={styles.title}>{name}</h1>
        <p className={styles.description}>
          Radix UI {detectedType} pattern — accessibility-first implementation
          with <strong>forwardRef</strong>, <code>aria-disabled</code>, and
          CSS <code>data-variant</code> targeting. v{version}
        </p>
      </header>

      {/* ── Interactive Sandbox ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Interactive Sandbox</h2>
        {detectedType === 'button' ? (
          <ButtonSandbox radixProps={radixProps} />
        ) : (
          <div className={styles.sandboxBg}>
            <div className={styles.sandboxCanvas}>
              <p className={styles.sandboxPlaceholder}>
                Sandbox preview not yet available for <code>{detectedType}</code>
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── Code Preview ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Code Preview</h2>
        <div className={styles.codeCollapse}>
          {/* Toggle bar */}
          <div className={styles.collapseToggle}>
            <div
              className={styles.collapseToggleLeft}
              role="button"
              tabIndex={0}
              onClick={() => setCodeOpen((v) => !v)}
              onKeyDown={(e) => e.key === 'Enter' && setCodeOpen((v) => !v)}
            >
              <Icon
                icon={codeTab === 'tsx' ? 'solar:code-square-linear' : 'solar:pen-2-linear'}
                width={14} height={14}
              />
              {name}.{codeTab}
            </div>
            <div className={styles.codeActions}>
              {(['tsx', 'css'] as CodeTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`${styles.codeTab} ${codeTab === tab ? styles.codeTabActive : ''}`}
                  onClick={() => { setCodeTab(tab); setCodeOpen(true); }}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
              <button type="button" className={styles.copyBtn} onClick={handleCopy} disabled={!currentCode}>
                <Icon icon={copied ? 'solar:check-circle-linear' : 'solar:copy-linear'} width={13} height={13} />
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
              <div className={styles.heightControls}>
                <button
                  type="button"
                  className={styles.heightBtn}
                  onClick={() => setCodeHeight((h) => Math.max(CODE_HEIGHT_MIN, h - CODE_HEIGHT_STEP))}
                  disabled={codeHeight <= CODE_HEIGHT_MIN}
                  aria-label="높이 줄이기"
                >
                  <Icon icon="solar:minus-square-linear" width={16} height={16} />
                </button>
                <button
                  type="button"
                  className={styles.heightBtn}
                  onClick={() => setCodeHeight((h) => Math.min(CODE_HEIGHT_MAX, h + CODE_HEIGHT_STEP))}
                  disabled={codeHeight >= CODE_HEIGHT_MAX}
                  aria-label="높이 늘이기"
                >
                  <Icon icon="solar:add-square-linear" width={16} height={16} />
                </button>
                <span className={styles.heightLabel}>{codeHeight}px</span>
              </div>
              <div
                role="button"
                tabIndex={0}
                className={`${styles.collapseChevron} ${codeOpen ? styles.open : ''}`}
                onClick={() => setCodeOpen((v) => !v)}
                onKeyDown={(e) => e.key === 'Enter' && setCodeOpen((v) => !v)}
              >
                <Icon icon="solar:alt-arrow-down-linear" width={14} height={14} />
              </div>
            </div>
          </div>

          {/* Collapsible body */}
          <div className={`${styles.collapseBody} ${codeOpen ? styles.open : ''}`} style={{ maxHeight: codeOpen ? `${codeHeight + 40}px` : '0' }}>
            <div className={styles.codeBlock} style={{ maxHeight: `${codeHeight}px` }}>
              {highlightedHtml ? (
                <div
                  className={styles.shikiWrap}
                  dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                />
              ) : (
                <pre className={styles.pre}>
                  <code>{currentCode || '// 아직 생성되지 않았습니다.'}</code>
                </pre>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Props Table ── */}
      {props.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Component API (Props)</h2>
          <div className={styles.tableWrapper}>
            <table className={styles.propsTable}>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Default</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {props.map((p) => (
                  <tr key={p.name}>
                    <td className={styles.propName}>{p.name}</td>
                    <td className={styles.propType}>{p.type}</td>
                    <td className={styles.propDefault}>{p.default}</td>
                    <td className={styles.propDesc}>{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Usage Guidelines ── */}
      {usage && (
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Usage Guidelines</h2>
          <div className={styles.guidelinesGrid}>
            <div className={styles.doCard}>
              <div className={styles.guideCardHeader}>
                <Icon icon="solar:check-circle-linear" width={18} height={18} className={styles.doIcon} />
                <span>Recommended (Do&apos;s)</span>
              </div>
              <ul className={styles.guideList}>
                {usage.dos.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={styles.dontCard}>
              <div className={styles.guideCardHeader}>
                <Icon icon="solar:close-circle-linear" width={18} height={18} className={styles.dontIcon} />
                <span>Prohibited (Don&apos;ts)</span>
              </div>
              <ul className={styles.guideList}>
                {usage.donts.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ── Delete Confirm Dialog ── */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="컴포넌트 삭제"
        message={`${name} 컴포넌트를 삭제합니다. 삭제된 데이터는 복구할 수 없습니다.`}
        confirmLabel="삭제"
        variant="danger"
        loading={deleting}
      />

    </div>
  );
}
