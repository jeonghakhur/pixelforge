'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import Modal from '@/components/common/Modal';
import {
  createScreenAction,
  getAvailableRoutesAction,
  type ScreenListItem,
  type ScreenStatus,
  type AvailableRoute,
} from '@/lib/actions/screens';

interface AddScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (screen: ScreenListItem) => void;
}

const STATUS_OPTIONS: { value: ScreenStatus; label: string }[] = [
  { value: 'wip',      label: 'WIP'      },
  { value: 'dev-done', label: 'Dev Done' },
  { value: 'qa-ready', label: 'QA Ready' },
  { value: 'qa-done',  label: 'QA Done'  },
];

const EMPTY_FORM = {
  name: '',
  description: '',
  authors: '',
  category: '',
  status: 'wip' as ScreenStatus,
  figmaUrl: '',
  visible: true,
};

export default function AddScreenModal({ isOpen, onClose, onCreated }: AddScreenModalProps) {
  const [routes, setRoutes] = useState<AvailableRoute[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<AvailableRoute | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingRoutes(true);
    getAvailableRoutesAction()
      .then(setRoutes)
      .finally(() => setLoadingRoutes(false));
  }, [isOpen]);

  const handleRouteSelect = (route: AvailableRoute | null) => {
    setSelectedRoute(route);
    if (route) {
      setForm({
        name: route.suggestedName ?? '',
        description: route.suggestedDescription ?? '',
        authors: route.suggestedAuthors.join(', '),
        category: route.suggestedCategory ?? '',
        status: route.suggestedStatus,
        figmaUrl: '',
        visible: true,
      });
    }
  };

  const set = (key: keyof typeof EMPTY_FORM, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleClose = () => {
    setSelectedRoute(null);
    setForm(EMPTY_FORM);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoute) { setError('라우트를 선택해주세요.'); return; }
    if (!form.name.trim()) { setError('화면 이름을 입력해주세요.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const created = await createScreenAction({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        route: selectedRoute.route,
        filePath: selectedRoute.filePath,
        authors: form.authors.split(',').map((s) => s.trim()).filter(Boolean),
        category: form.category.trim() || undefined,
        status: form.status,
        figmaUrl: form.figmaUrl.trim() || undefined,
        visible: form.visible,
      });
      onCreated(created);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="화면 추가"
      size="md"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={submitting}>
            취소
          </button>
          <button
            type="submit"
            form="add-screen-form"
            className="btn btn-primary"
            disabled={submitting || !selectedRoute}
          >
            {submitting
              ? <><Icon icon="solar:refresh-linear" width={14} height={14} className="spin-icon" /> 등록 중...</>
              : <><Icon icon="solar:add-circle-linear" width={14} height={14} /> 화면 추가</>
            }
          </button>
        </div>
      }
    >
      <form id="add-screen-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="alert alert-danger" role="alert" style={{ marginBottom: '16px' }}>
            <Icon icon="solar:danger-circle-linear" width={15} height={15} />
            {' '}{error}
          </div>
        )}

        {/* 라우트 선택 */}
        <div className="form-group">
          <label htmlFor="screen-route" className="form-label">
            파일 (라우트) <span className="text-danger">*</span>
          </label>
          {loadingRoutes ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <Icon icon="solar:refresh-linear" width={14} height={14} className="spin-icon" />
              파일 목록 불러오는 중...
            </div>
          ) : routes.length === 0 ? (
            <div style={{
              padding: '12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <Icon icon="solar:info-circle-linear" width={15} height={15} />
              등록 가능한 파일이 없습니다. 모든 파일이 이미 등록되었거나
              <code style={{ fontSize: '0.75rem' }}>src/app/(ide)/pages/</code>에 파일이 없습니다.
            </div>
          ) : (
            <select
              id="screen-route"
              className="form-control"
              value={selectedRoute?.route ?? ''}
              onChange={(e) => {
                const found = routes.find((r) => r.route === e.target.value) ?? null;
                handleRouteSelect(found);
              }}
            >
              <option value="">파일을 선택하세요...</option>
              {routes.map((r) => (
                <option key={r.route} value={r.route}>
                  {r.route}
                  {r.suggestedName ? `  —  ${r.suggestedName}` : ''}
                </option>
              ))}
            </select>
          )}
          {selectedRoute && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              <Icon icon="solar:file-text-linear" width={11} height={11} style={{ marginRight: '4px' }} />
              {selectedRoute.filePath}
            </span>
          )}
        </div>

        {/* 라우트 선택 후 나머지 필드 표시 */}
        {selectedRoute && (
          <>
            <div className="form-group">
              <label htmlFor="screen-name" className="form-label">
                화면 이름 <span className="text-danger">*</span>
              </label>
              <input
                id="screen-name"
                type="text"
                className="form-control"
                placeholder="예: 로그인, 홈 대시보드"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="screen-desc" className="form-label">설명</label>
              <input
                id="screen-desc"
                type="text"
                className="form-control"
                placeholder="화면에 대한 간단한 설명"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label htmlFor="screen-status" className="form-label">상태</label>
                <select
                  id="screen-status"
                  className="form-control"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="screen-category" className="form-label">카테고리</label>
                <input
                  id="screen-category"
                  type="text"
                  className="form-control"
                  placeholder="예: 인증, 마이페이지"
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="screen-authors" className="form-label">담당자</label>
              <input
                id="screen-authors"
                type="text"
                className="form-control"
                placeholder="이서진, 박도현 (쉼표로 구분)"
                value={form.authors}
                onChange={(e) => set('authors', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="screen-figma" className="form-label">Figma URL</label>
              <input
                id="screen-figma"
                type="url"
                className="form-control"
                placeholder="https://figma.com/design/..."
                value={form.figmaUrl}
                onChange={(e) => set('figmaUrl', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.visible}
                  onChange={(e) => set('visible', e.target.checked)}
                  style={{ width: '15px', height: '15px', accentColor: 'var(--accent)' }}
                />
                노출 여부
              </label>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
