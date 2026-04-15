'use client';

import { useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import Modal from '@/components/common/Modal';
import { importComponentFromJson, generateTextComponentAction, type ComponentRow } from '@/lib/actions/components';

type Tab = 'json' | 'token';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (component: ComponentRow) => void;
}

export default function AddComponentModal({ isOpen, onClose, onCreated }: Props) {
  const [tab, setTab] = useState<Tab>('json');
  const [jsonText, setJsonText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setJsonText('');
    setError(null);
    onClose();
  };

  const handleJsonConfirm = async () => {
    if (!jsonText.trim()) {
      setError('JSON을 붙여넣거나 파일을 선택해주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await importComponentFromJson(jsonText);
      if (result.error) { setError(result.error); return; }
      if (result.component) { onCreated(result.component); handleClose(); }
    } catch {
      setError('처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateText = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await generateTextComponentAction();
      if (result.error) { setError(result.error); return; }
      if (result.component) { onCreated(result.component); handleClose(); }
    } catch {
      setError('Text 컴포넌트 생성 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const loadFile = (file: File) => {
    if (!file.name.endsWith('.json')) { setError('.json 파일만 가져올 수 있습니다.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) { setJsonText(text); setError(null); }
    };
    reader.readAsText(file);
  };

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

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '7px 0',
    fontSize: '0.8125rem',
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    cursor: 'pointer',
    transition: 'color 120ms ease, border-color 120ms ease',
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="컴포넌트 추가"
      size="md"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={submitting}>
            취소
          </button>
          {tab === 'json' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleJsonConfirm}
              disabled={submitting || !jsonText.trim()}
            >
              {submitting
                ? <><Icon icon="solar:refresh-linear" width={14} height={14} className="spin-icon" /> 처리 중...</>
                : <><Icon icon="solar:check-circle-linear" width={14} height={14} /> 확인</>}
            </button>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2px' }}>
          <button type="button" style={tabStyle(tab === 'json')} onClick={() => { setTab('json'); setError(null); }}>
            JSON 임포트
          </button>
          <button type="button" style={tabStyle(tab === 'token')} onClick={() => { setTab('token'); setError(null); }}>
            토큰 기반 생성
          </button>
        </div>

        {/* 오류 알림 */}
        {error && (
          <div className="alert alert-danger" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon icon="solar:danger-circle-linear" width={15} height={15} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* JSON 탭 */}
        {tab === 'json' && (
          <>
            {/* 파일 선택 */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              style={{
                border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border-color)'}`,
                borderRadius: '8px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: isDragging ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                transition: 'all 150ms ease',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                <Icon icon="solar:file-download-linear" width={16} height={16} />
                JSON 파일을 드래그하거나
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '3px 12px', fontSize: '0.8125rem' }}
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
              >
                <Icon icon="solar:folder-open-linear" width={13} height={13} />
                {' '}파일 선택
              </button>
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>

            {/* 붙여넣기 */}
            <div>
              <label className="form-label" style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon icon="solar:clipboard-text-linear" width={13} height={13} />
                JSON 붙여넣기
              </label>
              <textarea
                className="form-control"
                rows={9}
                placeholder={'{\n  "name": "Button",\n  "detectedType": "button",\n  ...\n}'}
                value={jsonText}
                onChange={(e) => { setJsonText(e.target.value); setError(null); }}
                disabled={submitting}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'vertical' }}
              />
            </div>
          </>
        )}

        {/* 토큰 기반 생성 탭 */}
        {tab === 'token' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Text 카드 */}
            <div style={{
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              background: 'var(--bg-elevated)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon icon="solar:text-bold-linear" width={15} height={15} />
                  Text
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  DB Typography 토큰(Font size / Line height)을 읽어<br />
                  size · weight · color · as · srOnly props를 가진<br />
                  Text 컴포넌트를 자동 생성합니다.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flexShrink: 0, padding: '6px 14px', fontSize: '0.8125rem' }}
                onClick={handleGenerateText}
                disabled={submitting}
              >
                {submitting
                  ? <><Icon icon="solar:refresh-linear" width={13} height={13} className="spin-icon" /> 생성 중...</>
                  : <><Icon icon="solar:magic-stick-3-linear" width={13} height={13} /> 생성</>}
              </button>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              Typography 토큰이 없는 경우 먼저 Figma 변수를 동기화해주세요.
            </p>
          </div>
        )}

      </div>
    </Modal>
  );
}
