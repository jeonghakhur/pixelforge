'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import * as GeneratedIcons from '@/generated/icons';
import styles from './page.module.scss';

interface Props {
  componentName: string;
  figmaName: string;
  section: string;
  svg: string;
  variants?: string[];
}

type IconComponents = typeof GeneratedIcons;

const COLOR_PRESETS = [
  { label: 'primary',   value: 'var(--text-primary)' },
  { label: 'secondary', value: 'var(--text-secondary)' },
  { label: 'muted',     value: 'var(--text-muted)' },
  { label: 'accent',    value: 'var(--accent)' },
  { label: 'danger',    value: 'var(--danger, #ef4444)' },
  { label: 'success',   value: '#4ade80' },
  { label: 'white',     value: '#ffffff' },
  { label: 'black',     value: '#000000' },
] as const;

interface IconPropDef {
  name: string;
  type: string;
  default: string;
  description: string;
}

const ICON_PROPS: IconPropDef[] = [
  { name: 'width',     type: 'number',     default: '24',        description: '아이콘 너비 (px)' },
  { name: 'height',    type: 'number',     default: '24',        description: '아이콘 높이 (px)' },
  { name: 'variant',   type: 'string',     default: '"default"', description: '아이콘 스타일 variant (default / gray / solid 등)' },
  { name: 'color',     type: 'string',     default: 'undefined', description: 'CSS color 값 — style.color 적용 (fill="currentColor" 상속)' },
  { name: 'className', type: 'string',     default: 'undefined', description: '추가 CSS 클래스' },
];

function buildSnippet(componentName: string, color: string, size: number, variant: string, availableVariants?: string[]): string {
  const colorAttr = color ? `\n  color="${color}"` : '';
  const sizeAttr = size !== 24 ? `\n  width={${size}} height={${size}}` : '';
  const variantAttr = availableVariants && availableVariants.length > 1 && variant !== availableVariants[0]
    ? `\n  variant="${variant}"` : '';
  if (!colorAttr && !sizeAttr && !variantAttr) {
    return `<Icon${componentName} />`;
  }
  return `<Icon${componentName}${variantAttr}${colorAttr}${sizeAttr}\n/>`;
}

function IconRenderer({ componentName, color, size, variant }: { componentName: string; color: string; size: number; variant: string }) {
  const key = `Icon${componentName}` as keyof IconComponents;
  const Comp = GeneratedIcons[key] as React.ComponentType<{ width: number; height: number; color?: string; variant?: string }> | undefined;
  if (!Comp) return <div className={styles.iconPlaceholder} />;
  return <Comp width={size} height={size} color={color || undefined} variant={variant} />;
}

function CopyButton({ text, icon = 'solar:copy-linear' }: { text: string; icon?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      type="button"
      className={`${styles.copyBtn} ${copied ? styles.copyBtnSuccess : ''}`}
      onClick={handleCopy}
      aria-label="복사"
    >
      <Icon
        icon={copied ? 'solar:check-circle-linear' : icon}
        width={15}
        height={15}
      />
    </button>
  );
}

export default function IconDetailClient({ componentName, figmaName, section, svg, variants }: Props) {
  const router = useRouter();
  const [color, setColor] = useState('');
  const [size, setSize] = useState(48);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [svgOpen, setSvgOpen] = useState(false);
  const [hexInput, setHexInput] = useState('');
  const [variant, setVariant] = useState(variants?.[0] ?? 'default');

  const importStmt = `import { Icon${componentName} } from '@/generated/icons';`;
  const snippet = buildSnippet(componentName, color, size, variant, variants);

  const handlePresetClick = (value: string) => {
    setColor(value);
    setHexInput('');
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    const hex = val.startsWith('#') ? val : `#${val}`;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      setColor(hex);
    }
  };

  return (
    <>
      {/* 뒤로가기 */}
      <button type="button" className={styles.backBtn} onClick={() => router.back()}>
        <Icon icon="solar:arrow-left-linear" width={14} height={14} />
        Icons
      </button>

      {/* 헤더 */}
      <div className={styles.header}>
        <span className={styles.eyebrow}>{section}</span>
        <h1 className={styles.title}>Icon{componentName}</h1>
        <p className={styles.figmaName}>{figmaName}</p>
      </div>

      {/* 프리뷰 카드 */}
      <div className={styles.previewCard} data-theme={theme}>
        <div className={styles.previewTopBar}>
          <div className={styles.themeToggle}>
            <button
              type="button"
              className={`${styles.themeBtn} ${theme === 'dark' ? styles.themeBtnActive : ''}`}
              onClick={() => setTheme('dark')}
            >
              Dark
            </button>
            <button
              type="button"
              className={`${styles.themeBtn} ${theme === 'light' ? styles.themeBtnActive : ''}`}
              onClick={() => setTheme('light')}
            >
              Light
            </button>
          </div>
          <span className={styles.sizeDisplay}>{size}px</span>
        </div>

        <div className={styles.previewArea}>
          <IconRenderer componentName={componentName} color={color} size={size} variant={variant} />
        </div>

        <div className={styles.controls}>
          {/* Variant */}
          {variants && variants.length > 1 && (
            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>Variant</span>
              <div className={styles.variantRow}>
                {variants.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`${styles.variantBtn} ${variant === v ? styles.variantBtnActive : ''}`}
                    onClick={() => setVariant(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 색상 */}
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Color</span>
            <div className={styles.colorRow}>
              <div className={styles.colorPresets}>
                <button
                  type="button"
                  className={`${styles.colorPresetBtn} ${!color ? styles.colorPresetBtnActive : ''}`}
                  style={{ background: 'var(--text-primary)' }}
                  onClick={() => { setColor(''); setHexInput(''); }}
                  title="inherit"
                  aria-label="기본 색상"
                />
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className={`${styles.colorPresetBtn} ${color === p.value ? styles.colorPresetBtnActive : ''}`}
                    style={{ background: p.value }}
                    onClick={() => handlePresetClick(p.value)}
                    title={p.label}
                    aria-label={p.label}
                  />
                ))}
              </div>
              <input
                type="text"
                className={styles.colorInput}
                placeholder="#hex"
                value={hexInput}
                onChange={handleHexChange}
                maxLength={7}
                aria-label="HEX 색상 입력"
              />
            </div>
          </div>

          {/* 크기 */}
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Size</span>
            <div className={styles.sizeControl}>
              <span className={styles.sizeMin}>16</span>
              <input
                type="range"
                className={styles.sizeSlider}
                min={16}
                max={64}
                step={4}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                aria-label="아이콘 크기"
              />
              <span className={styles.sizeMax}>64</span>
            </div>
          </div>
        </div>
      </div>

      {/* Import 구문 */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Import</span>
          <CopyButton text={importStmt} />
        </div>
        <pre className={styles.codeBlock}><code>{importStmt}</code></pre>
      </div>

      {/* TSX 스니펫 */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Usage</span>
          <CopyButton text={snippet} />
        </div>
        <pre className={styles.codeBlock}><code>{snippet}</code></pre>
      </div>

      {/* Props 테이블 */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Props</span>
        </div>
        <table className={styles.propsTable}>
          <thead>
            <tr>
              <th className={styles.propsTableHead}>Name</th>
              <th className={styles.propsTableHead}>Type</th>
              <th className={styles.propsTableHead}>Default</th>
              <th className={styles.propsTableHead}>Description</th>
            </tr>
          </thead>
          <tbody>
            {ICON_PROPS.map((prop) => (
              <tr key={prop.name} className={styles.propsTableRow}>
                <td className={styles.propName}>{prop.name}</td>
                <td className={styles.propType}>{prop.type}</td>
                <td className={styles.propDefault}>{prop.default}</td>
                <td className={styles.propDesc}>{prop.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SVG 원본 */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <button
            type="button"
            className={styles.svgToggle}
            onClick={() => setSvgOpen((p) => !p)}
          >
            <Icon
              icon={svgOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
              width={14}
              height={14}
            />
            <span className={styles.sectionTitle}>SVG Source</span>
          </button>
          {svgOpen && <CopyButton text={svg} icon="solar:copy-linear" />}
        </div>
        {svgOpen && (
          <pre className={`${styles.codeBlock} ${styles.codeBlockSvg}`}><code>{svg}</code></pre>
        )}
      </div>
    </>
  );
}
