'use client';

import { useState, useRef, useCallback } from 'react';
import { Icon } from '@iconify/react';
import Modal from '@/components/common/Modal';
import { importIconsFromSvg, type SvgIconInput } from '@/lib/actions/icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (count: number) => void;
  existingSections: string[];
}

// icons-node-326.json 형식
interface RawIconEntry {
  name: string;
  kebab?: string;
  pascal?: string;
  svg: string;
  section?: string;
  variants?: unknown[];
}

interface RawIconJson {
  meta?: { extractedAt?: string; totalCount?: number; sections?: string[] };
  icons: RawIconEntry[];
}

interface ParsedItem {
  id: string;
  name: string;       // figmaName (저장 키)
  componentName: string; // pascal — Icon*.tsx 이름
  svg: string;
  section: string;
  error: string | null;
}

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toUpperCase());
}

function parseJsonFile(text: string): { items: ParsedItem[]; error: string | null } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { items: [], error: 'JSON 파싱 실패: 올바른 JSON 형식인지 확인해주세요.' }; }

  // 단일 아이콘 객체 { name, svg } 또는 배열 또는 { icons: [] } 래퍼 모두 허용
  let entries: RawIconEntry[] = [];

  if (Array.isArray(raw)) {
    entries = raw as RawIconEntry[];
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.icons)) {
      entries = obj.icons as RawIconEntry[];
    } else if (typeof obj.name === 'string' && typeof obj.svg === 'string') {
      entries = [obj as unknown as RawIconEntry];
    } else {
      return { items: [], error: '지원하지 않는 JSON 형식입니다. { icons: [] } 또는 배열 형식이어야 합니다.' };
    }
  } else {
    return { items: [], error: '지원하지 않는 JSON 형식입니다.' };
  }

  if (!entries.length) return { items: [], error: '아이콘 데이터가 비어 있습니다.' };

  let idSeq = 0;
  const items: ParsedItem[] = entries.map((e) => {
    const componentName = e.pascal ?? toPascalCase(e.name);
    const svgError = !e.svg?.trim() ? 'SVG 데이터가 없습니다.'
      : /<script/i.test(e.svg) ? '<script> 포함 SVG는 허용되지 않습니다.'
      : null;
    return {
      id: String(++idSeq),
      name: e.name,
      componentName,
      svg: e.svg ?? '',
      section: e.section ?? '',
      error: svgError,
    };
  });

  return { items, error: null };
}

export default function AddIconModal({ isOpen, onClose, onCreated, existingSections }: Props) {
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [sectionInput, setSectionInput] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setItems([]);
    setGlobalError(null);
    setFileName('');
    setSectionInput('');
    setFilterSection('');
    onClose();
  };

  const loadFile = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) { setGlobalError('.json 파일만 가져올 수 있습니다.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? '';
      const { items: parsed, error } = parseJsonFile(text);
      if (error) { setGlobalError(error); return; }
      setGlobalError(null);
      setFileName(file.name);
      setItems(parsed);
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const updateItem = (id: string, patch: Partial<ParsedItem>) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const applySection = () => {
    const s = sectionInput.trim();
    if (!s) return;
    setItems((prev) => prev.map((item) => ({ ...item, section: s })));
  };

  const allSections = [...new Set([
    ...existingSections,
    ...items.map((i) => i.section).filter(Boolean),
  ])];

  const visibleItems = filterSection
    ? items.filter((i) => i.section === filterSection)
    : items;

  const validCount = items.filter((i) => !i.error && i.componentName.trim()).length;

  const handleConfirm = async () => {
    const valid = items.filter((i) => !i.error && i.componentName.trim());
    if (!valid.length) { setGlobalError('추가할 유효한 아이콘이 없습니다.'); return; }

    setSubmitting(true);
    setGlobalError(null);
    try {
      const inputs: SvgIconInput[] = valid.map((i) => ({
        name: i.name,
        svg: i.svg,
        section: i.section.trim() || undefined,
      }));
      const result = await importIconsFromSvg(inputs);
      if (result.error) { setGlobalError(result.error); return; }
      onCreated(result.added);
      handleClose();
    } catch {
      setGlobalError('처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="아이콘 JSON 임포트"
      size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {items.length > 0 && `총 ${items.length}개 중 ${validCount}개 유효`}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={submitting}>
              취소
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={submitting || validCount === 0}
            >
              {submitting
                ? <><Icon icon="solar:refresh-linear" width={14} height={14} className="spin-icon" /> 생성 중...</>
                : <><Icon icon="solar:magic-stick-3-linear" width={14} height={14} /> {validCount}개 생성</>}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {globalError && (
          <div className="alert alert-danger" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon icon="solar:danger-circle-linear" width={15} height={15} style={{ flexShrink: 0 }} />
            {globalError}
          </div>
        )}

        {/* 드롭존 */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          style={{
            border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border-color)'}`,
            borderRadius: '8px',
            padding: items.length ? '12px 18px' : '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: isDragging ? 'rgba(99,102,241,0.06)' : 'var(--bg-elevated)',
            transition: 'all 150ms ease',
            cursor: 'pointer',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            <Icon icon="solar:file-download-linear" width={16} height={16} />
            {fileName
              ? <><strong style={{ color: 'var(--text-primary)' }}>{fileName}</strong> — 다른 파일로 교체하려면 클릭</>
              : 'JSON 파일을 드래그하거나 클릭해서 선택'}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '3px 12px', fontSize: '0.8125rem', flexShrink: 0 }}
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          >
            <Icon icon="solar:folder-open-linear" width={13} height={13} /> 파일 선택
          </button>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>

        {/* 섹션 컨트롤 */}
        {items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', flexShrink: 0 }}>섹션 일괄 적용</span>
              <input
                type="text"
                className="form-control"
                placeholder="예: Arrows"
                value={sectionInput}
                onChange={(e) => setSectionInput(e.target.value)}
                style={{ fontSize: '0.8125rem', flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px 12px', fontSize: '0.8125rem', flexShrink: 0 }}
                onClick={applySection}
                disabled={!sectionInput.trim()}
              >
                전체 적용
              </button>
            </div>
            {/* 섹션 필터 */}
            {allSections.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>필터:</span>
                <button
                  type="button"
                  style={chipStyle(!filterSection)}
                  onClick={() => setFilterSection('')}
                >
                  전체 ({items.length})
                </button>
                {allSections.map((s) => (
                  <button
                    key={s}
                    type="button"
                    style={chipStyle(filterSection === s)}
                    onClick={() => { setFilterSection((prev) => prev === s ? '' : s); setSectionInput(s); }}
                  >
                    {s} ({items.filter((i) => i.section === s).length})
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 아이콘 목록 */}
        {visibleItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
            {visibleItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr 120px auto',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${item.error ? 'rgba(239,68,68,0.4)' : 'var(--border-color)'}`,
                  borderRadius: '6px',
                }}
              >
                {/* 아이콘 미리보기 - SVG 인라인 렌더링 */}
                <div style={{
                  width: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-surface)',
                  borderRadius: '6px',
                  flexShrink: 0,
                  color: 'var(--text-primary)',
                }}
                  dangerouslySetInnerHTML={item.error ? undefined : { __html: resizeSvg(item.svg, 20) }}
                >
                  {item.error && <Icon icon="solar:danger-circle-linear" width={18} height={18} style={{ color: '#ef4444' }} />}
                </div>

                {/* 컴포넌트명 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>Icon</span>
                    <input
                      type="text"
                      className="form-control"
                      value={item.componentName}
                      onChange={(e) => updateItem(item.id, { componentName: e.target.value })}
                      style={{ fontSize: '0.8125rem', padding: '2px 6px', flex: 1 }}
                      disabled={!!item.error}
                    />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: item.error ? '#ef4444' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.error ?? item.name}
                  </span>
                </div>

                {/* 섹션 */}
                <input
                  type="text"
                  className="form-control"
                  value={item.section}
                  onChange={(e) => updateItem(item.id, { section: e.target.value })}
                  placeholder="섹션"
                  style={{ fontSize: '0.8125rem', padding: '2px 6px' }}
                  disabled={!!item.error}
                />

                {/* 제거 */}
                <button
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 26, height: 26,
                    background: 'none',
                    border: '1px solid var(--border-color)',
                    borderRadius: '5px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  onClick={() => removeItem(item.id)}
                  aria-label="제거"
                >
                  <Icon icon="solar:close-circle-linear" width={13} height={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '2px 10px',
    fontSize: '0.75rem',
    background: active ? 'var(--accent)' : 'var(--bg-surface)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-color)'}`,
    borderRadius: '12px',
    color: active ? '#fff' : 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 120ms ease',
  };
}

function resizeSvg(svg: string, size: number): string {
  return svg
    .replace(/width="[^"]*"/, `width="${size}"`)
    .replace(/height="[^"]*"/, `height="${size}"`);
}
