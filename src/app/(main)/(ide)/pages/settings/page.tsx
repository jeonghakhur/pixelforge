/**
 * @page 설정 — 계정, 알림, 개인정보 설정
 * @author 한지원
 * @category 마이페이지
 * @status qa-ready
 */
'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}

function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border-color)' }}>
      <div>
        <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{label}</p>
        {description && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: checked ? 'var(--accent)' : 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          cursor: 'pointer',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

const MENU_ITEMS = [
  { icon: 'solar:user-circle-linear', label: '계정 정보' },
  { icon: 'solar:bell-linear', label: '알림 설정' },
  { icon: 'solar:lock-password-linear', label: '보안' },
  { icon: 'solar:shield-user-linear', label: '개인정보 처리방침' },
  { icon: 'solar:info-circle-linear', label: '앱 정보' },
];

export default function SettingsPage() {
  const [activeMenu, setActiveMenu] = useState('알림 설정');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [orderAlert, setOrderAlert] = useState(true);
  const [marketingAlert, setMarketingAlert] = useState(false);
  const [reviewAlert, setReviewAlert] = useState(true);
  const [nightMode, setNightMode] = useState(false);

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-body)', color: 'var(--text-primary)', display: 'flex' }}>
      {/* 사이드 메뉴 */}
      <nav style={{
        width: 200,
        borderRight: '1px solid var(--border-color)',
        padding: '24px 0',
        flexShrink: 0,
      }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', padding: '0 20px', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>설정</p>
        {MENU_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setActiveMenu(item.label)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              background: activeMenu === item.label ? 'var(--accent-subtle)' : 'none',
              border: 'none',
              color: activeMenu === item.label ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: 14,
              cursor: 'pointer',
              textAlign: 'left',
              borderRadius: 0,
            }}
          >
            <Icon icon={item.icon} width={16} height={16} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, padding: '24px 32px', maxWidth: 560 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>{activeMenu}</h2>

        {activeMenu === '알림 설정' && (
          <>
            <Toggle
              checked={pushEnabled}
              onChange={setPushEnabled}
              label="푸시 알림"
              description="앱 알림을 허용합니다"
            />
            <Toggle
              checked={orderAlert}
              onChange={setOrderAlert}
              label="주문·배송 알림"
              description="주문 확인, 배송 출발, 도착 알림"
            />
            <Toggle
              checked={reviewAlert}
              onChange={setReviewAlert}
              label="리뷰 알림"
              description="구매한 상품의 리뷰 요청 알림"
            />
            <Toggle
              checked={marketingAlert}
              onChange={setMarketingAlert}
              label="마케팅 알림"
              description="할인·프로모션·이벤트 정보"
            />
            <Toggle
              checked={nightMode}
              onChange={setNightMode}
              label="야간 알림 차단"
              description="오후 10시 ~ 오전 8시 알림 차단"
            />
          </>
        )}

        {activeMenu === '계정 정보' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: '이름', value: '김하늘' },
              { label: '이메일', value: 'haneul@example.com' },
              { label: '전화번호', value: '010-****-5678' },
            ].map((field) => (
              <div key={field.label}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{field.label}</p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{field.value}</span>
                  <Icon icon="solar:pen-2-linear" width={14} height={14} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
                </div>
              </div>
            ))}
            <button
              type="button"
              style={{
                marginTop: 8,
                padding: '12px',
                background: 'none',
                border: '1px solid var(--danger)',
                borderRadius: 8,
                color: 'var(--danger)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              회원 탈퇴
            </button>
          </div>
        )}

        {activeMenu !== '알림 설정' && activeMenu !== '계정 정보' && (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>준비 중입니다.</p>
        )}
      </div>
    </main>
  );
}
