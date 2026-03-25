/**
 * @page 알림 — 실시간 알림 목록 및 읽음 처리
 * @author 오예린, 한지원
 * @category 공통
 * @status qa-ready
 * @visible false
 */
'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning';
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 'n-1', type: 'success', title: '토큰 추출 완료',        body: 'Figma 파일에서 색상 토큰 47개가 추출되었습니다.',          time: '방금 전',   read: false },
  { id: 'n-2', type: 'info',    title: '새 화면이 등록되었습니다', body: '/pages/cart 화면이 대시보드에 추가되었습니다.',            time: '5분 전',    read: false },
  { id: 'n-3', type: 'warning', title: '토큰 불일치 감지',       body: '색상 토큰 3개가 Figma 원본과 다릅니다. 확인해 주세요.',     time: '1시간 전',  read: false },
  { id: 'n-4', type: 'info',    title: 'QA 검수 요청',           body: '/pages/login 화면의 QA 검수가 요청되었습니다.',            time: '3시간 전',  read: true  },
  { id: 'n-5', type: 'success', title: 'Playwright 검수 통과',   body: '/pages/home 화면이 Playwright 검수를 통과했습니다. (98점)', time: '어제',      read: true  },
];

const TYPE_CONFIG = {
  info:    { icon: 'solar:info-circle-linear',  color: '#0055b2', bg: '#eef4ff' },
  success: { icon: 'solar:check-circle-linear', color: '#198754', bg: '#f0fff5' },
  warning: { icon: 'solar:danger-triangle-linear', color: '#e67e00', bg: '#fff8ee' },
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = items.filter((n) => !n.read).length;

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const markRead = (id: string) => setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  const deleteItem = (id: string) => setItems((prev) => prev.filter((n) => n.id !== id));

  return (
    <main
      style={{
        minHeight: '100svh',
        background: '#f8f9fa',
        fontFamily: "'Pretendard', system-ui, sans-serif",
        padding: '40px 24px',
      }}
      data-testid="notifications-page"
    >
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>알림</h1>
            {unreadCount > 0 && (
              <span
                data-testid="unread-count"
                style={{
                  background: '#dc3545',
                  color: '#fff',
                  borderRadius: 12,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              data-testid="mark-all-read-btn"
              onClick={markAllRead}
              style={{ fontSize: 13, color: '#0055b2', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              모두 읽음 처리
            </button>
          )}
        </div>

        {/* 알림 목록 */}
        {items.length === 0 ? (
          <div data-testid="notifications-empty" style={{ textAlign: 'center', padding: '80px 0', color: '#999' }}>
            <Icon icon="solar:bell-off-linear" width={48} height={48} />
            <p style={{ marginTop: 12, fontSize: 15 }}>알림이 없습니다.</p>
          </div>
        ) : (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="notifications-list">
            {items.map((item) => {
              const cfg = TYPE_CONFIG[item.type];
              return (
                <li
                  key={item.id}
                  data-testid={`notification-${item.id}`}
                  data-read={item.read}
                  style={{
                    background: item.read ? '#fff' : '#f5f8ff',
                    borderRadius: 10,
                    padding: '16px 16px 16px 14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                    borderLeft: `3px solid ${item.read ? 'transparent' : cfg.color}`,
                    cursor: item.read ? 'default' : 'pointer',
                  }}
                  onClick={() => !item.read && markRead(item.id)}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon icon={cfg.icon} width={18} height={18} style={{ color: cfg.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: item.read ? 500 : 700, margin: '0 0 3px', letterSpacing: '-0.01em' }}>
                      {item.title}
                    </p>
                    <p style={{ fontSize: 13, color: '#666', margin: '0 0 6px', lineHeight: 1.5 }}>
                      {item.body}
                    </p>
                    <span style={{ fontSize: 12, color: '#aaa' }}>{item.time}</span>
                  </div>
                  <button
                    type="button"
                    data-testid={`delete-notification-${item.id}`}
                    onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                    aria-label="알림 삭제"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', flexShrink: 0, padding: 2 }}
                  >
                    <Icon icon="solar:close-circle-linear" width={16} height={16} />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}
