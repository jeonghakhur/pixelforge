/**
 * @page 프로필 — 사용자 정보 조회 및 수정
 * @author 정민준
 * @category 마이페이지
 * @status dev-done
 */
'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';

const SAMPLE_USER = {
  name: '박도현',
  email: 'dohyeon.park@example.com',
  role: '프로덕트 디자이너',
  team: '디자인 시스템 팀',
  joinedAt: '2025년 11월 14일',
  avatarInitial: '박',
};

export default function ProfilePage() {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(SAMPLE_USER.name);
  const [role, setRole] = useState(SAMPLE_USER.role);

  const handleSave = () => setEditing(false);

  return (
    <main
      style={{
        minHeight: '100svh',
        background: '#f8f9fa',
        fontFamily: "'Pretendard', system-ui, sans-serif",
        padding: '40px 24px',
      }}
      data-testid="profile-page"
    >
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 24 }}>
          내 프로필
        </h1>

        {/* 아바타 + 기본 정보 */}
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            marginBottom: 16,
          }}
          data-testid="profile-card"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
            <div
              data-testid="profile-avatar"
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#0055b2',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {SAMPLE_USER.avatarInitial}
            </div>
            <div>
              <p data-testid="profile-name" style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px', letterSpacing: '-0.01em' }}>
                {name}
              </p>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>{SAMPLE_USER.email}</p>
            </div>
            <button
              type="button"
              data-testid="profile-edit-btn"
              onClick={() => setEditing((v) => !v)}
              style={{
                marginLeft: 'auto',
                padding: '8px 16px',
                background: editing ? '#f0f0f0' : '#0055b2',
                color: editing ? '#333' : '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon icon={editing ? 'solar:close-circle-linear' : 'solar:pen-linear'} width={14} height={14} />
              {editing ? '취소' : '수정'}
            </button>
          </div>

          {/* 정보 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ width: 80, fontSize: 13, color: '#999', flexShrink: 0 }}>이름</span>
              {editing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="profile-name-input"
                  style={{ flex: 1, padding: '6px 10px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 14 }}
                />
              ) : (
                <span data-testid="profile-name-display" style={{ fontSize: 14, fontWeight: 500 }}>{name}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ width: 80, fontSize: 13, color: '#999', flexShrink: 0 }}>직무</span>
              {editing ? (
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  data-testid="profile-role-input"
                  style={{ flex: 1, padding: '6px 10px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 14 }}
                />
              ) : (
                <span style={{ fontSize: 14, fontWeight: 500 }}>{role}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ width: 80, fontSize: 13, color: '#999', flexShrink: 0 }}>팀</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{SAMPLE_USER.team}</span>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ width: 80, fontSize: 13, color: '#999', flexShrink: 0 }}>가입일</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{SAMPLE_USER.joinedAt}</span>
            </div>
          </div>

          {editing && (
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                data-testid="profile-save-btn"
                onClick={handleSave}
                style={{
                  padding: '10px 24px',
                  background: '#0055b2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                저장
              </button>
            </div>
          )}
        </div>

        {/* 계정 설정 */}
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
          data-testid="profile-settings"
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', letterSpacing: '-0.01em' }}>계정 설정</h2>
          {[
            { icon: 'solar:lock-password-linear', label: '비밀번호 변경', testId: 'change-password-btn' },
            { icon: 'solar:bell-linear',          label: '알림 설정',     testId: 'notification-settings-btn' },
            { icon: 'solar:logout-linear',        label: '로그아웃',      testId: 'logout-btn' },
          ].map(({ icon, label, testId }) => (
            <button
              key={testId}
              type="button"
              data-testid={testId}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 0',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid #f0f0f0',
                cursor: 'pointer',
                fontSize: 14,
                color: label === '로그아웃' ? '#dc3545' : '#333',
                textAlign: 'left',
              }}
            >
              <Icon icon={icon} width={18} height={18} />
              {label}
              <Icon icon="solar:arrow-right-linear" width={14} height={14} style={{ marginLeft: 'auto', color: '#ccc' }} />
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
