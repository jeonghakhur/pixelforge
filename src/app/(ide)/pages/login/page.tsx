/**
 * @page 로그인 — 이메일 / 소셜 로그인 화면
 * @author 이서진
 * @category 인증
 * @status qa-done
 */
'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';

export default function LoginSamplePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    // 샘플: 실제 로그인 로직 없음
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <main
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8f9fa',
        fontFamily: "'Pretendard', system-ui, sans-serif",
      }}
      data-testid="login-page"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#fff',
          borderRadius: 12,
          padding: '40px 32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
        }}
      >
        {/* 로고 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <Icon icon="solar:figma-linear" width={24} height={24} style={{ color: '#0055b2' }} />
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>PixelForge</span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          로그인
        </h1>
        <p style={{ fontSize: 14, color: '#666', margin: '0 0 24px' }}>
          계속하려면 로그인해 주세요.
        </p>

        {/* 이메일 폼 */}
        <form onSubmit={handleSubmit} noValidate data-testid="login-form">
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="login-email" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              이메일
            </label>
            <input
              id="login-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              data-testid="login-email-input"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="login-password" style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              비밀번호
            </label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              data-testid="login-password-input"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ textAlign: 'right', marginBottom: 20 }}>
            <button
              type="button"
              data-testid="forgot-password-btn"
              style={{ fontSize: 13, color: '#0055b2', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              비밀번호를 잊으셨나요?
            </button>
          </div>

          {error && (
            <p
              role="alert"
              data-testid="login-error"
              style={{ fontSize: 13, color: '#dc3545', margin: '0 0 14px', padding: '10px 12px', background: '#fff5f5', borderRadius: 6 }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="login-submit-btn"
            style={{
              width: '100%',
              padding: '12px',
              background: '#0055b2',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 구분선 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
          <span style={{ fontSize: 12, color: '#999' }}>또는</span>
          <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
        </div>

        {/* 소셜 로그인 */}
        <button
          type="button"
          data-testid="login-google-btn"
          style={{
            width: '100%',
            padding: '11px',
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Icon icon="logos:google-icon" width={18} height={18} />
          Google로 계속하기
        </button>

        {/* 회원가입 링크 */}
        <p style={{ textAlign: 'center', fontSize: 13, color: '#666', marginTop: 24 }}>
          계정이 없으신가요?{' '}
          <button
            type="button"
            data-testid="goto-register-btn"
            style={{ color: '#0055b2', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
          >
            회원가입
          </button>
        </p>
      </div>
    </main>
  );
}
