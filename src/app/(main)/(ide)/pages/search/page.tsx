/**
 * @page 검색 — 상품 및 콘텐츠 통합 검색
 * @author 박도현, 이수진
 * @category 탐색
 * @status wip
 */
'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';

const RECENT_KEYWORDS = ['반팔티', '린넨 팬츠', '여름 원피스', '샌들'];

const MOCK_RESULTS = [
  { id: '1', name: '코튼 오버핏 반팔 티셔츠', price: 29900, tag: '베스트' },
  { id: '2', name: '린넨 와이드 팬츠', price: 49900, tag: '신상' },
  { id: '3', name: '플로럴 미디 원피스', price: 65000, tag: null },
  { id: '4', name: '스트랩 플랫 샌들', price: 38000, tag: '세일' },
  { id: '5', name: '스트라이프 반팔 셔츠', price: 42000, tag: null },
  { id: '6', name: '카고 하프 팬츠', price: 35000, tag: '베스트' },
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const results = submitted
    ? MOCK_RESULTS.filter((r) => r.name.includes(submitted))
    : [];

  const handleSearch = () => {
    if (query.trim()) setSubmitted(query.trim());
  };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-body)', color: 'var(--text-primary)', padding: '24px 20px' }}>
      {/* 검색 바 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: '0 14px',
        }}>
          <Icon icon="solar:magnifer-linear" width={16} height={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="찾고 싶은 상품을 검색해보세요"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 14,
              color: 'var(--text-primary)',
              padding: '12px 0',
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          style={{
            padding: '0 20px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          검색
        </button>
      </div>

      {/* 최근 검색어 */}
      {!submitted && (
        <section style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>최근 검색어</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {RECENT_KEYWORDS.map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => { setQuery(kw); setSubmitted(kw); }}
                style={{
                  padding: '6px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 20,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {kw}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 검색 결과 */}
      {submitted && (
        <section>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            <strong style={{ color: 'var(--text-primary)' }}>&ldquo;{submitted}&rdquo;</strong> 검색 결과 {results.length}건
          </p>
          {results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <Icon icon="solar:magnifer-linear" width={32} height={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ fontSize: 14 }}>검색 결과가 없습니다</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {results.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 12,
                    padding: '16px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    height: 120,
                    background: 'var(--glass-bg)',
                    borderRadius: 8,
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon icon="solar:t-shirt-linear" width={32} height={32} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, flex: 1 }}>{item.name}</p>
                    {item.tag && (
                      <span style={{
                        fontSize: 10,
                        color: 'var(--accent)',
                        background: 'var(--accent-subtle)',
                        border: '1px solid rgba(var(--accent-rgb), 0.2)',
                        borderRadius: 4,
                        padding: '2px 6px',
                        flexShrink: 0,
                      }}>
                        {item.tag}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '6px 0 0' }}>
                    {item.price.toLocaleString()}원
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
