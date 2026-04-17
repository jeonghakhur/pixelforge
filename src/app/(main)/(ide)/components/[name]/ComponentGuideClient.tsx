'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from '@iconify/react';
// ── 프로젝트 커스텀 아이콘 (src/components/icon/Icon.tsx) ─────────────────────
// "icon:star" 패턴 입력 시 인라인 프리뷰에 사용.
// ⚠️ 아이콘 파일 경로가 바뀌면 이 import 경로만 수정하면 됩니다.
import { Icon as ProjectIcon, type IconName } from '@/components/icon/Icon';
import { deleteComponentAndRedirect } from '@/lib/actions/components'
import { useUIStore } from '@/stores/useUIStore';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import PropsEditor from './PropsEditor';
import type { ComponentOverrides } from '@/lib/component-generator/props-override';
import styles from './page.module.scss';

interface Props {
  id: string;
  name: string;
  /** Figma 원본 경로 (예: "Buttons/Button") — 파일 시스템 경로 매핑용 */
  figmaPath: string | null;
  category: string;
  detectedType: string | null;
  tsx: string | null;
  css: string | null;
  radixProps: string | null;
  version: number;
  missingVars?: string[];
  propsOverrides?: string | null;
}

type CodeTab = 'tsx' | 'css';

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

interface NodePropDef {
  kind: 'node';
  name: string;           // prop 이름 (leftIcon, rightIcon 등)
}

interface StringPropDef {
  kind: 'string';
  name: string;           // prop 이름 (src, displayName 등)
  defaultValue: string;
}

type SandboxPropDef = UnionPropDef | BooleanPropDef | NodePropDef | StringPropDef;

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
  // forwardRef 패턴: ({ props }, ref) =>
  // 일반 함수 패턴: ({ props }: TypeProps)
  const blockMatch =
    tsx.match(/\(\s*\{([\s\S]*?)\},\s*\n\s*ref/) ??
    tsx.match(/\(\s*\{([\s\S]*?)\}\s*:\s*\w+Props\s*\)/);
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

  // disabled, children, className, ...props는 제외
  // 'type'은 제외하지 않음 — AvatarImage 등에서 variant prop으로 사용됨
  // (Button의 type='button'은 union/boolean이 아니므로 자동으로 필터됨)
  const SKIP = new Set(['disabled', 'children', 'className']);

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

  // interface에서 destructured에 없는 props 추가 파싱
  // (boolean, 인라인 union, ReactNode, string — 기본값 없는 prop 포함)
  const seenNames = new Set(props.map(p => p.name));
  const interfaceMatch = tsx.match(/export interface \w+Props[^{]*\{([\s\S]*?)\n\}/);
  if (interfaceMatch) {
    for (const line of interfaceMatch[1].split('\n')) {
      const pm = line.match(/^\s*(\w+)\??\s*:\s*([^;]+);/);
      if (!pm) continue;
      const propName = pm[1];
      const typeName = pm[2].trim();
      if (SKIP.has(propName) || seenNames.has(propName)) continue;

      const dataAttr = parseDataAttrMapping(tsx, propName);

      const namedUnionVals = unionTypes.get(propName);
      if (namedUnionVals && namedUnionVals.length > 0) {
        // named union 타입: TextTag, ButtonVariant 등 (as?: TextTag 같은 alias prop 포함)
        seenNames.add(propName);
        props.push({ kind: 'union', name: propName, values: namedUnionVals, defaultValue: namedUnionVals[0], dataAttr });
      } else if (typeName === 'boolean') {
        seenNames.add(propName);
        props.push({ kind: 'boolean', name: propName, defaultValue: false, dataAttr });
      } else if (/^'[^']+'(\s*\|\s*'[^']+')+$/.test(typeName)) {
        // 인라인 유니온 리터럴: 'left' | 'center' | 'right'
        const values = typeName.split('|').map(s => s.trim().replace(/'/g, '').replace(/"/g, ''));
        seenNames.add(propName);
        props.push({ kind: 'union', name: propName, values, defaultValue: values[0], dataAttr });
      } else if (typeName === 'ReactNode') {
        seenNames.add(propName);
        props.push({ kind: 'node', name: propName });
      } else if (typeName === 'string') {
        seenNames.add(propName);
        props.push({ kind: 'string', name: propName, defaultValue: '' });
      }
    }
  }

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

/** TSX의 forwardRef<HTML*Element> 또는 HTMLAttributes<HTML*Element> 에서 HTML 태그를 추출 */
function parseElementType(tsx: string): string {
  const TAG_MAP: Record<string, string> = {
    div: 'div', button: 'button', input: 'input',
    anchor: 'a', span: 'span', heading: 'h2',
  };

  // forwardRef 패턴: forwardRef<HTMLButtonElement, ...>
  const fwdMatch = tsx.match(/forwardRef<HTML(\w+)Element/);
  if (fwdMatch) return TAG_MAP[fwdMatch[1].toLowerCase()] ?? 'div';

  // 일반 함수 패턴: HTMLAttributes<HTMLElement> → 'p' (Text 기본 태그)
  if (tsx.includes('HTMLAttributes<HTMLElement>')) return 'p';

  return 'div';
}

/**
 * CSS에서 inner structure 클래스(.iconSlot, .textWrapper)를 감지하여
 * iframe HTML 내부 구조를 생성한다.
 */
interface InnerHtmlOptions {
  iconOnly: boolean;
  showLeading: boolean;
  showTrailing: boolean;
}

function buildInnerHtml(css: string, text: string, opts: InnerHtmlOptions): string {
  const hasIconSlot = css.includes('.iconSlot');
  const hasTextWrapper = css.includes('.textWrapper');
  const iconPlaceholder = '<span class="iconSlot"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5" opacity="0.6"/></svg></span>';

  if (opts.iconOnly && hasIconSlot) {
    return iconPlaceholder;
  }

  if (hasIconSlot || hasTextWrapper) {
    const parts: string[] = [];
    if (hasIconSlot && opts.showLeading) parts.push(iconPlaceholder);
    parts.push(hasTextWrapper ? `<span class="textWrapper">${text}</span>` : text);
    if (hasIconSlot && opts.showTrailing) parts.push(iconPlaceholder);
    return parts.join('');
  }

  return text;
}

function ComponentSandbox({ name, figmaPath, css, tsx }: {
  name: string;
  figmaPath: string | null;
  css: string | null;
  tsx: string | null;
}) {
  const element = parseElementType(tsx ?? '');

  // TSX에서 모든 props를 동적 파싱
  const sandboxProps = parseSandboxProps(tsx ?? '');

  const unionProps  = sandboxProps.filter((p): p is UnionPropDef => p.kind === 'union');
  const boolProps   = sandboxProps.filter((p): p is BooleanPropDef => p.kind === 'boolean');
  const nodeProps   = sandboxProps.filter((p): p is NodePropDef => p.kind === 'node');
  const stringProps = sandboxProps.filter((p): p is StringPropDef => p.kind === 'string');

  // state 관리: union props
  const initUnion: Record<string, string> = {};
  for (const p of unionProps) initUnion[p.name] = p.defaultValue;
  const [unionValues, setUnionValues] = useState(initUnion);

  // state 관리: boolean props
  const initBool: Record<string, boolean> = {};
  for (const p of boolProps) initBool[p.name] = p.defaultValue;
  const [boolValues, setBoolValues] = useState(initBool);

  // state 관리: node props (iconify 이름 또는 텍스트)
  const [nodeValues, setNodeValues] = useState<Record<string, string>>({});

  // state 관리: string props (src, displayName, role 등)
  const [stringValues, setStringValues] = useState<Record<string, string>>({});

  // state union에 disabled가 포함되면 별도 disabled prop 불필요
  const stateUnionProp = unionProps.find(p => p.name === 'state');
  const hasDisabledInState = stateUnionProp?.values.some(v => /^disabled$/i.test(v)) ?? false;

  // disabled는 인터랙티브 요소(button, input, select, textarea)이거나
  // CSS에 data-disabled 스타일이 정의된 컴포넌트에만 표시한다.
  // <p>, <span>, <h1~h6> 등 비인터랙티브 요소에 disabled는 유효하지 않은 HTML 속성.
  const supportsDisabled =
    /forwardRef<HTML(Button|Input|Select|TextArea)Element/.test(tsx ?? '') ||
    /\[data-disabled\]/.test(css ?? '');

  const [selDisabled, setDisabled] = useState(false);

  // children
  const hasChildren = tsx ? /children\??:\s*ReactNode/.test(tsx) : false;
  const [childrenText, setChildrenText] = useState(name);

  // 프리뷰 data 속성 동적 구성
  const dataAttrs: Record<string, string | undefined> = {};
  for (const p of unionProps) {
    const val = unionValues[p.name] ?? p.defaultValue;
    dataAttrs[`data-${p.dataAttr}`] = val.toLowerCase().replace(/\s+/g, '-');
  }
  for (const p of boolProps) {
    dataAttrs[`data-${p.dataAttr}`] = boolValues[p.name] ? '' : undefined;
  }
  if (supportsDisabled && !hasDisabledInState) {
    dataAttrs['data-disabled'] = selDisabled ? '' : undefined;
  }

  // 부모 앱의 테마 동기화
  const resolvedTheme = useUIStore((s) => s.resolvedTheme);

  // iframe 높이 자동 조정 — preview가 postMessage로 콘텐츠 높이를 전달
  const [iframeHeight, setIframeHeight] = useState(120);
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'preview-height' && typeof e.data.height === 'number') {
        setIframeHeight(Math.max(80, e.data.height));
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // 초기 URL (iframe 최초 로드용) — 이후 props 변경은 postMessage로 전달
  const initialPreviewUrl = useMemo(() => {
    const params = new URLSearchParams();
    for (const p of unionProps) params.set(p.name, p.defaultValue);
    for (const p of boolProps) params.set(p.name, String(p.defaultValue));
    if (hasChildren) params.set('children', name);
    params.set('theme', resolvedTheme);
    return `/preview/${encodeURIComponent(name)}?${params.toString()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // props/theme 변경 시 iframe에 postMessage
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const props: Record<string, unknown> = {};
    for (const p of unionProps) props[p.name] = unionValues[p.name] ?? p.defaultValue;
    for (const p of boolProps) props[p.name] = boolValues[p.name] ?? p.defaultValue;
    for (const p of stringProps) { if (stringValues[p.name]) props[p.name] = stringValues[p.name]; }
    if (supportsDisabled && !hasDisabledInState) props.disabled = selDisabled;

    const nodePayload: Record<string, string> = {};
    for (const p of nodeProps) nodePayload[p.name] = nodeValues[p.name] ?? '';

    iframe.contentWindow.postMessage({
      type: 'preview-props',
      props,
      nodeProps: nodePayload,
      children: hasChildren ? (childrenText || name) : undefined,
      theme: resolvedTheme,
    }, '*');
  }, [unionProps, unionValues, boolProps, boolValues, nodeProps, nodeValues, stringProps, stringValues, hasDisabledInState, selDisabled, hasChildren, childrenText, name, resolvedTheme]);

  return (
    <>
      {/* ── Preview (iframe + 실제 컴포넌트) ── */}
      <div className={styles.sandboxBg}>
        <div className={styles.sandboxCanvas}>
          {!css ? (
            <p className={styles.sandboxPlaceholder}>
              CSS가 없습니다 — 플러그인 데이터를 전송하면 실제 스타일이 표시됩니다.
            </p>
          ) : (
            <iframe
              ref={iframeRef}
              src={initialPreviewUrl}
              title={`${name} preview`}
              className={styles.sandboxIframe}
              style={{ height: iframeHeight }}
            />
          )}
        </div>
      </div>

      {/* ── Props Controls ── */}
      <div className={styles.tableWrapper}>
        <table className={styles.propsTable}>
          <thead>
            <tr>
              <th>Property</th>
              <th>Type</th>
              <th>Control</th>
            </tr>
          </thead>
          <tbody>
            {unionProps.map((p) => (
              <tr key={p.name}>
                <td className={styles.propName}>{p.name}</td>
                <td className={styles.propType}>
                  {p.values.map((v) => `'${v}'`).join(' | ')}
                </td>
                <td>
                  <select
                    value={unionValues[p.name] ?? p.defaultValue}
                    onChange={(e) => setUnionValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                    className={styles.propSelect}
                  >
                    {p.values.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}

            {nodeProps.map((p) => {
              const val = nodeValues[p.name] ?? '';
              const trimmed = val.trim();

              // ── 아이콘 패턴 판별 ─────────────────────────────────────────
              // "collection:iconName" 형식을 Iconify / 프로젝트 커스텀으로 분리
              //
              //  · isIconifyIcon  — "solar:star-bold", "mdi:home" 등
              //                     Iconify @iconify/react <Icon> 컴포넌트로 렌더
              //
              //  · isProjectIcon  — "icon:star", "icon:bell" 등
              //                     src/components/icon/Icon.tsx의 <ProjectIcon>으로 렌더
              //                     ⚠️ collection이 정확히 "icon"인 경우만 해당
              //
              // 두 패턴 모두 /^[\w-]+:[\w-]+$/ 에 해당하므로,
              // collection 앞부분을 꺼내 "icon"인지 아닌지로 분기한다.
              const colonIdx = trimmed.indexOf(':')
              const collection = colonIdx > 0 ? trimmed.slice(0, colonIdx) : ''
              const isIconifyIcon = collection !== 'icon' && /^[\w-]+:[\w-]+$/.test(trimmed)
              const isProjectIcon = collection === 'icon' && /^[\w-]+$/.test(trimmed.slice(colonIdx + 1))
              const isIcon = isIconifyIcon || isProjectIcon

              const isHtml = trimmed.includes('<');
              const isValid = isIcon || isHtml || !trimmed;
              const projectIconName = isProjectIcon ? trimmed.slice(colonIdx + 1) : ''

              return (
                <tr key={p.name}>
                  <td className={styles.propName}>{p.name}</td>
                  <td className={styles.propType}>ReactNode</td>
                  <td>
                    <div className={styles.nodeInputWrap}>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => setNodeValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                        className={`${styles.propInput} ${!isValid ? styles.propInputInvalid : ''}`}
                        placeholder="solar:star-bold, icon:star 또는 <span>텍스트</span>"
                        spellCheck={false}
                      />
                      {/* Iconify 외부 아이콘 인라인 프리뷰 (solar:, mdi: 등) */}
                      {isIconifyIcon && (
                        <span className={styles.iconPreview}>
                          <Icon icon={trimmed} width={16} height={16} />
                        </span>
                      )}
                      {/* 프로젝트 커스텀 아이콘 인라인 프리뷰 (icon:star 등) */}
                      {isProjectIcon && (
                        <span className={styles.iconPreview}>
                          <ProjectIcon
                            name={projectIconName as IconName}
                            style={{ width: 16, height: 16, display: 'block' }}
                          />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {stringProps.map((p) => (
              <tr key={p.name}>
                <td className={styles.propName}>{p.name}</td>
                <td className={styles.propType}>string</td>
                <td>
                  <input
                    type="text"
                    value={stringValues[p.name] ?? ''}
                    onChange={(e) => setStringValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                    className={styles.propInput}
                    placeholder={p.name}
                    spellCheck={false}
                  />
                </td>
              </tr>
            ))}

            {hasChildren && (
              <tr>
                <td className={styles.propName}>children</td>
                <td className={styles.propType}>ReactNode</td>
                <td>
                  <input
                    type="text"
                    value={childrenText}
                    onChange={(e) => setChildrenText(e.target.value)}
                    className={styles.propInput}
                    placeholder="버튼 텍스트"
                  />
                </td>
              </tr>
            )}

            {supportsDisabled && !hasDisabledInState && (
              <tr>
                <td className={styles.propName}>disabled</td>
                <td className={styles.propType}>boolean</td>
                <td>
                  <label className={styles.propToggle}>
                    <input
                      type="checkbox"
                      checked={selDisabled}
                      onChange={(e) => setDisabled(e.target.checked)}
                    />
                    <span>{selDisabled ? 'true' : 'false'}</span>
                  </label>
                </td>
              </tr>
            )}

            {boolProps.map((p) => (
              <tr key={p.name}>
                <td className={styles.propName}>{p.name}</td>
                <td className={styles.propType}>boolean</td>
                <td>
                  <label className={styles.propToggle}>
                    <input
                      type="checkbox"
                      checked={boolValues[p.name] ?? false}
                      onChange={(e) => setBoolValues((prev) => ({ ...prev, [p.name]: e.target.checked }))}
                    />
                    <span>{(boolValues[p.name] ?? false) ? 'true' : 'false'}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ComponentGuideClient({ id, name, figmaPath, category, detectedType, tsx, css, radixProps, version, missingVars = [], propsOverrides }: Props) {
  const CODE_HEIGHT_STEP = 200;
  const CODE_HEIGHT_MIN = 160;
  const CODE_HEIGHT_MAX = 1200;
  const CODE_HEIGHT_DEFAULT = 800;
  const codeBlockRef = useRef<HTMLDivElement>(null);

  const initialOverrides = useMemo<ComponentOverrides | null>(() => {
    if (!propsOverrides) return null;
    try { return JSON.parse(propsOverrides) as ComponentOverrides; } catch { return null; }
  }, [propsOverrides]);

  const invalidateComponents = useUIStore((s) => s.invalidateComponents);

  const [codeTab, setCodeTab] = useState<CodeTab>('tsx');
  const [codeOpen, setCodeOpen] = useState(true);
  const [codeHeight, setCodeHeight] = useState(CODE_HEIGHT_DEFAULT);
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    invalidateComponents();
    // server action에서 redirect → 재검증으로 인한 404 깜빡임 없이 이동
    await deleteComponentAndRedirect(id);
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

      {/* ── Diagnostics ── */}
      {missingVars.length > 0 && (
        <section className={styles.diagnostics}>
          <div className={styles.diagnosticsHeader}>
            <Icon icon="solar:danger-triangle-linear" width={16} height={16} />
            <span>CSS Variable Diagnostics — {missingVars.length} missing</span>
          </div>
          <ul className={styles.diagnosticsList}>
            {missingVars.map((v) => (
              <li key={v}>
                <code>{v}</code>
                <span>tokens.css에 정의되지 않음</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Interactive Sandbox ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionLabel}>Interactive Sandbox</h2>
        {(css || tsx) ? (
          <ComponentSandbox
            key={tsx ? `${tsx.length}:${tsx.charCodeAt(0)}` : 'empty'}
            name={name} figmaPath={figmaPath} css={css} tsx={tsx}
          />
        ) : (
          <div className={styles.sandboxBg}>
            <div className={styles.sandboxCanvas}>
              <p className={styles.sandboxPlaceholder}>
                컴포넌트 데이터가 없습니다 — 플러그인에서 데이터를 전송해주세요.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── Props Editor ── */}
      {tsx && (
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Props Editor</h2>
          <PropsEditor
            key={tsx ? `${tsx.length}:${tsx.charCodeAt(0)}` : 'empty'}
            componentId={id}
            componentName={name}
            tsx={tsx}
            initialOverrides={initialOverrides}
          />
        </section>
      )}

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

      {/* Props Table은 ComponentSandbox에 통합됨 */}

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
