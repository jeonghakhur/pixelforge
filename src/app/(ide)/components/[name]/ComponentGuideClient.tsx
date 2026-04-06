'use client';

import { useState, useEffect, useRef } from 'react';
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
  tokensCss: string | null;
}

type CodeTab = 'tsx' | 'css';

interface PropDef { name: string; type: string; default: string; description: string }

// ── TSX 파싱 헬퍼 — 생성된 코드에서 실제 타입 추출 ──────────────────────────

function parseUnionType(tsx: string, keyword: 'Variant' | 'Size'): string[] {
  const re = new RegExp(`export type \\w+${keyword} = ([^;]+);`);
  const match = tsx.match(re);
  if (!match) return [];
  return match[1].split('|').map((s) => s.trim().replace(/'/g, '').replace(/"/g, ''));
}

function parseDefaultProp(tsx: string, prop: string): string {
  const re = new RegExp(`${prop}\\s*=\\s*'([^']+)'`);
  const match = tsx.match(re);
  return match ? `'${match[1]}'` : '—';
}

function parseHasBlockProp(tsx: string): boolean {
  return /block\?\s*:\s*boolean/.test(tsx);
}

// ── 동적 props 파서 ─────────────────────────────────────────────────────────
// 생성된 TSX에서 union type props와 boolean props를 자동 추출

interface UnionPropDef {
  kind: 'union';
  name: string;           // prop 이름 (hierarchy, size 등)
  values: string[];       // union 값 목록
  defaultValue: string;   // 기본값
  dataAttr: string;       // data-* 속성명
}

interface BooleanPropDef {
  kind: 'boolean';
  name: string;           // prop 이름 (iconOnly, loading 등)
  defaultValue: boolean;
  dataAttr: string;       // data-* 속성명
}

type SandboxPropDef = UnionPropDef | BooleanPropDef;

/** TSX에서 export type → interface prop 매핑으로 union type props 추출 */
function parseAllUnionTypes(tsx: string): Map<string, string[]> {
  const map = new Map<string, string[]>();

  // 1. 모든 export type 선언 수집: ButtonCTAHierarchy → ['Primary', ...]
  const typeDecls: Record<string, string[]> = {};
  const typeRe = /export type (\w+) = ([^;]+);/g;
  let m;
  while ((m = typeRe.exec(tsx)) !== null) {
    typeDecls[m[1]] = m[2].split('|').map((s) => s.trim().replace(/'/g, '').replace(/"/g, ''));
  }

  // 2. interface에서 prop → type 매핑: hierarchy?: ButtonCTAHierarchy
  const propRe = /(\w+)\??\s*:\s*(\w+);/g;
  while ((m = propRe.exec(tsx)) !== null) {
    const propName = m[1];
    const typeName = m[2];
    if (typeDecls[typeName]) {
      map.set(propName, typeDecls[typeName]);
    }
  }

  return map;
}

/** TSX destructuring에서 prop = defaultValue 패턴 추출 */
function parseDestructuredProps(tsx: string): Array<{ name: string; default: string }> {
  // ({\n  hierarchy = 'Primary',\n  size = 'xs',\n  iconOnly = false, ... }) 패턴
  const blockMatch = tsx.match(/\(\s*\{([\s\S]*?)\},\s*\n\s*ref/);
  if (!blockMatch) return [];

  const results: Array<{ name: string; default: string }> = [];
  const lines = blockMatch[1].split('\n');
  for (const line of lines) {
    const propMatch = line.match(/^\s*(\w+)\s*=\s*(.+?),?\s*$/);
    if (propMatch) {
      results.push({ name: propMatch[1], default: propMatch[2].replace(/'/g, '').replace(/"/g, '') });
    }
  }
  return results;
}

/** TSX에서 data-xxx={prop...} 매핑 추출 */
function parseDataAttrMapping(tsx: string, propName: string): string {
  // data-hierarchy={hierarchy...} → 'hierarchy'
  // data-icon-only={iconOnly...} → 'icon-only'
  const re = new RegExp(`data-([a-z][a-z0-9-]*)=\\{${propName}`);
  const m = tsx.match(re);
  return m ? m[1] : propName.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/** TSX에서 Sandbox에 필요한 모든 props를 동적 추출 */
function parseSandboxProps(tsx: string): SandboxPropDef[] {
  if (!tsx) return [];

  const unionTypes = parseAllUnionTypes(tsx);
  const destructured = parseDestructuredProps(tsx);
  const props: SandboxPropDef[] = [];

  // disabled, children, className, type, ...props는 제외
  const SKIP = new Set(['disabled', 'children', 'className', 'type']);

  for (const { name, default: defaultVal } of destructured) {
    if (SKIP.has(name)) continue;

    const dataAttr = parseDataAttrMapping(tsx, name);

    // union type prop인지 확인 (interface prop → type 매핑)
    const unionValues = unionTypes.get(name);

    if (unionValues && unionValues.length > 0) {
      props.push({
        kind: 'union',
        name,
        values: unionValues,
        defaultValue: defaultVal,
        dataAttr,
      });
    } else if (defaultVal === 'false' || defaultVal === 'true') {
      props.push({
        kind: 'boolean',
        name,
        defaultValue: defaultVal === 'true',
        dataAttr,
      });
    }
  }

  return props;
}

function buildPropsFromTsx(tsx: string, detectedType: string): PropDef[] {
  if (detectedType !== 'button' || !tsx) return [];

  const variants = parseUnionType(tsx, 'Variant');
  const sizes    = parseUnionType(tsx, 'Size');
  const hasBlock = parseHasBlockProp(tsx);

  const variantType = variants.length > 0
    ? variants.map((v) => `'${v}'`).join(' | ')
    : "'Primary'|'Secondary'|'Default'|'Outline'|'Invisible'";
  const sizeType = sizes.length > 0
    ? sizes.map((s) => `'${s}'`).join(' | ')
    : "'xsmall'|'small'|'medium'|'large'|'xlarge'";

  const props: PropDef[] = [
    { name: 'variant',  type: variantType, default: parseDefaultProp(tsx, 'variant'), description: '버튼의 시각적 스타일 (Figma variant 이름 기준)' },
    { name: 'size',     type: sizeType,    default: parseDefaultProp(tsx, 'size'),    description: '패딩과 폰트 크기 스케일' },
  ];
  if (hasBlock) {
    props.push({ name: 'block', type: 'boolean', default: 'false', description: '전체 너비 (width: 100%) 레이아웃' });
  }
  props.push(
    { name: 'disabled',  type: 'boolean',   default: 'false', description: '비활성화 — aria-disabled + data-disabled 동시 적용' },
    { name: 'children',  type: 'ReactNode', default: '—',     description: '버튼 내부 콘텐츠' },
  );
  return props;
}

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

function ButtonSandbox({ name, css, tokensCss, tsx }: {
  name: string;
  css: string | null;
  tokensCss: string | null;
  tsx: string | null;
}) {
  // TSX에서 모든 props를 동적 파싱
  const sandboxProps = parseSandboxProps(tsx ?? '');

  // union props → 개별 state
  const unionProps = sandboxProps.filter((p): p is UnionPropDef => p.kind === 'union');
  const boolProps  = sandboxProps.filter((p): p is BooleanPropDef => p.kind === 'boolean');

  // state 관리: union props
  const initUnion: Record<string, string> = {};
  for (const p of unionProps) initUnion[p.name] = p.defaultValue;
  const [unionValues, setUnionValues] = useState(initUnion);

  // state 관리: boolean props
  const initBool: Record<string, boolean> = {};
  for (const p of boolProps) initBool[p.name] = p.defaultValue;
  const [boolValues, setBoolValues] = useState(initBool);

  // disabled는 항상 지원 (TSX destructuring에서 default 없이 나오므로 별도 관리)
  const [selDisabled, setDisabled] = useState(false);

  // children: TSX에 children prop이 있으면 텍스트 입력 지원
  const hasChildren = tsx ? /children\??:\s*ReactNode/.test(tsx) : false;
  const [childrenText, setChildrenText] = useState(name);

  // sandbox 스코프 격리
  const scope = `sb-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const scopedTokens = tokensCss ? tokensCss.replace(/:root\s*\{/g, `.${scope} {`) : '';
  const scopedCss    = css       ? css.replace(/\.root/g, `.${scope} .root`)        : '';
  const injectedCss  = scopedTokens + scopedCss;

  // 프리뷰 버튼의 data 속성 동적 구성
  const dataAttrs: Record<string, string | undefined> = {};
  for (const p of unionProps) {
    const val = unionValues[p.name] ?? p.defaultValue;
    // TSX에서 .toLowerCase().replace(/\s+/g, '-') 변환하는 경우 반영
    dataAttrs[`data-${p.dataAttr}`] = val.toLowerCase().replace(/\s+/g, '-');
  }
  for (const p of boolProps) {
    dataAttrs[`data-${p.dataAttr}`] = boolValues[p.name] ? '' : undefined;
  }
  dataAttrs['data-disabled'] = selDisabled ? '' : undefined;

  return (
    <div className={styles.sandboxBg}>
      {injectedCss && (
        // eslint-disable-next-line react/no-danger
        <style dangerouslySetInnerHTML={{ __html: injectedCss }} />
      )}

      <div className={styles.sandboxLayout}>
        {/* ── 컨트롤 패널 ── */}
        <div className={styles.sandboxControls}>
          {unionProps.map((p) => (
            <div key={p.name} className={styles.controlGroup}>
              <span className={styles.controlLabel}>{p.name}</span>
              <div className={styles.controlPills}>
                {p.values.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`${styles.pill} ${unionValues[p.name] === v ? styles.pillActive : ''}`}
                    onClick={() => setUnionValues((prev) => ({ ...prev, [p.name]: v }))}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {hasChildren && (
            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>children</span>
              <input
                type="text"
                value={childrenText}
                onChange={(e) => setChildrenText(e.target.value)}
                className={styles.controlInput}
                placeholder="버튼 텍스트"
              />
            </div>
          )}

          {(boolProps.length > 0 || true /* disabled 항상 표시 */) && (
            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>state</span>
              <div className={styles.controlToggles}>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={selDisabled}
                    onChange={(e) => setDisabled(e.target.checked)}
                  />
                  <span>disabled</span>
                </label>
                {boolProps.map((p) => (
                  <label key={p.name} className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={boolValues[p.name] ?? false}
                      onChange={(e) => setBoolValues((prev) => ({ ...prev, [p.name]: e.target.checked }))}
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 프리뷰 ── */}
        <div className={`${styles.sandboxCanvas} ${scope}`}>
          {!css ? (
            <p className={styles.sandboxPlaceholder}>
              CSS가 없습니다 — 플러그인 데이터를 전송하면 실제 스타일이 표시됩니다.
            </p>
          ) : (
            <button
              type="button"
              {...dataAttrs}
              aria-disabled={selDisabled || undefined}
              className={`${scope} root`}
            >
              {childrenText || name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ComponentGuideClient({ id, name, category, detectedType, tsx, css, radixProps, version, tokensCss }: Props) {
  const router = useRouter();
  const CODE_HEIGHT_STEP = 200;
  const CODE_HEIGHT_MIN = 160;
  const CODE_HEIGHT_MAX = 1200;
  const CODE_HEIGHT_DEFAULT = 800;
  const codeBlockRef = useRef<HTMLDivElement>(null);

  const [codeTab, setCodeTab] = useState<CodeTab>('tsx');
  const [codeOpen, setCodeOpen] = useState(true);
  const [codeHeight, setCodeHeight] = useState(CODE_HEIGHT_DEFAULT);
  const [copied, setCopied] = useState(false);
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

  // 코드 내용이 바뀔 때 실제 높이를 측정해 자동 조정
  // 내용이 800px보다 짧으면 실제 높이로, 길면 800px로 cap
  useEffect(() => {
    const el = codeBlockRef.current;
    if (!el) return;
    const contentHeight = el.scrollHeight;
    setCodeHeight(Math.min(CODE_HEIGHT_DEFAULT, contentHeight));
  }, [highlightedHtml, currentCode]);
  const props = buildPropsFromTsx(tsx ?? '', detectedType ?? '');
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
          <ButtonSandbox name={name} css={css} tokensCss={tokensCss} tsx={tsx} />
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
            <div ref={codeBlockRef} className={styles.codeBlock} style={{ maxHeight: `${codeHeight}px` }}>
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
