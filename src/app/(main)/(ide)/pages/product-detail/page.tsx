/**
 * @page 상품 상세 — 상품 정보, 이미지, 옵션 선택 및 구매
 * @author 이수진, 김하늘
 * @category 쇼핑
 * @status dev-done
 */
'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL'];
const COLOR_OPTIONS = [
  { label: '아이보리', value: '#F5F0E8' },
  { label: '차콜', value: '#3A3A3A' },
  { label: '네이비', value: '#1A2744' },
];

export default function ProductDetailPage() {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [qty, setQty] = useState(1);
  const [liked, setLiked] = useState(false);
  const [tab, setTab] = useState<'detail' | 'review' | 'qna'>('detail');

  const price = 65000;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-body)', color: 'var(--text-primary)' }}>
      {/* 이미지 영역 */}
      <div style={{
        height: 320,
        background: 'var(--bg-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <Icon icon="solar:t-shirt-linear" width={80} height={80} style={{ color: 'var(--text-muted)', opacity: 0.2 }} />
        <button
          type="button"
          onClick={() => setLiked((v) => !v)}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.3)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label={liked ? '찜 해제' : '찜하기'}
        >
          <Icon
            icon={liked ? 'solar:heart-bold' : 'solar:heart-linear'}
            width={18}
            height={18}
            style={{ color: liked ? '#ef4444' : '#fff' }}
          />
        </button>
      </div>

      {/* 상품 정보 */}
      <div style={{ padding: '20px 20px 120px' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>코튼 컬렉션</p>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>플로럴 미디 원피스</h1>
        <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{price.toLocaleString()}원</p>

        {/* 색상 */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>색상 — {selectedColor.label}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setSelectedColor(c)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: c.value,
                  border: selectedColor.value === c.value ? '2px solid var(--accent)' : '2px solid var(--border-color)',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: 0,
                }}
                aria-label={c.label}
              />
            ))}
          </div>
        </div>

        {/* 사이즈 */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>사이즈</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {SIZE_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedSize(s)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: selectedSize === s ? 'var(--accent)' : 'var(--bg-elevated)',
                  border: `1px solid ${selectedSize === s ? 'var(--accent)' : 'var(--border-color)'}`,
                  color: selectedSize === s ? '#fff' : 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 탭 */}
        <div style={{ borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {(['detail', 'review', 'qna'] as const).map((t) => {
              const labels = { detail: '상품정보', review: '리뷰 (12)', qna: 'Q&A (3)' };
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    background: 'none',
                    border: 'none',
                    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                    color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: 13,
                    fontWeight: tab === t ? 700 : 400,
                    cursor: 'pointer',
                    marginBottom: -1,
                  }}
                >
                  {labels[t]}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {tab === 'detail' && <p>소재: 100% 코튼 / 세탁: 손세탁 권장 / 원산지: 국내산</p>}
          {tab === 'review' && <p>리뷰 12개 · 평점 4.5</p>}
          {tab === 'qna' && <p>Q&A 3개</p>}
        </div>
      </div>

      {/* 하단 구매 바 */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 20px',
        background: 'var(--bg-body)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '6px 12px' }}>
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>-</button>
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{qty}</span>
          <button type="button" onClick={() => setQty((q) => q + 1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>+</button>
        </div>
        <button
          type="button"
          style={{
            flex: 1,
            padding: '14px 0',
            background: selectedSize ? 'var(--accent)' : 'var(--bg-elevated)',
            color: selectedSize ? '#fff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 700,
            cursor: selectedSize ? 'pointer' : 'default',
          }}
        >
          {selectedSize ? `${(price * qty).toLocaleString()}원 구매하기` : '사이즈를 선택해주세요'}
        </button>
      </div>
    </main>
  );
}
