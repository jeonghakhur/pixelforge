/**
 * @page 장바구니 — 상품 담기 및 결제 준비
 * @author 김하늘, 한지원
 * @category 쇼핑
 * @status wip
 */
'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';

interface CartItem {
  id: string;
  name: string;
  option: string;
  price: number;
  qty: number;
}

const INITIAL_ITEMS: CartItem[] = [
  { id: 'item-1', name: 'Pretendard Variable 폰트 라이선스', option: 'Standard',    price: 49000, qty: 1 },
  { id: 'item-2', name: 'PixelForge Pro 구독',               option: '연간 플랜',   price: 120000, qty: 1 },
  { id: 'item-3', name: 'Figma 플러그인 팩',                  option: 'Design Ops', price: 35000, qty: 2 },
];

function formatPrice(n: number) {
  return n.toLocaleString('ko-KR') + '원';
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>(INITIAL_ITEMS);

  const updateQty = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item
      )
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shipping = subtotal >= 50000 ? 0 : 3000;
  const total = subtotal + shipping;

  return (
    <main
      style={{
        minHeight: '100svh',
        background: '#f8f9fa',
        fontFamily: "'Pretendard', system-ui, sans-serif",
        padding: '40px 24px',
      }}
      data-testid="cart-page"
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
          장바구니
        </h1>
        <p style={{ fontSize: 13, color: '#999', marginBottom: 24 }}>
          총 {items.length}개 상품
        </p>

        {items.length === 0 ? (
          <div
            data-testid="cart-empty"
            style={{ textAlign: 'center', padding: '80px 0', color: '#999' }}
          >
            <Icon icon="solar:cart-large-2-linear" width={48} height={48} />
            <p style={{ marginTop: 12, fontSize: 15 }}>장바구니가 비어 있습니다.</p>
          </div>
        ) : (
          <>
            {/* 상품 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }} data-testid="cart-items">
              {items.map((item) => (
                <div
                  key={item.id}
                  data-testid={`cart-item-${item.id}`}
                  style={{
                    background: '#fff',
                    borderRadius: 10,
                    padding: 20,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
                      {item.name}
                    </p>
                    <p style={{ fontSize: 13, color: '#888', margin: 0 }}>{item.option}</p>
                  </div>

                  {/* 수량 조절 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      data-testid={`qty-decrease-${item.id}`}
                      onClick={() => updateQty(item.id, -1)}
                      style={{ width: 28, height: 28, border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16 }}
                    >
                      −
                    </button>
                    <span data-testid={`qty-${item.id}`} style={{ fontSize: 14, fontWeight: 600, minWidth: 20, textAlign: 'center' }}>
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      data-testid={`qty-increase-${item.id}`}
                      onClick={() => updateQty(item.id, 1)}
                      style={{ width: 28, height: 28, border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16 }}
                    >
                      +
                    </button>
                  </div>

                  <p style={{ fontSize: 15, fontWeight: 700, minWidth: 80, textAlign: 'right' }}>
                    {formatPrice(item.price * item.qty)}
                  </p>

                  <button
                    type="button"
                    data-testid={`remove-${item.id}`}
                    onClick={() => removeItem(item.id)}
                    aria-label={`${item.name} 삭제`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', flexShrink: 0 }}
                  >
                    <Icon icon="solar:close-circle-linear" width={18} height={18} />
                  </button>
                </div>
              ))}
            </div>

            {/* 금액 요약 */}
            <div
              data-testid="cart-summary"
              style={{
                background: '#fff',
                borderRadius: 10,
                padding: 20,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                marginBottom: 16,
              }}
            >
              {[
                { label: '상품 금액',  value: formatPrice(subtotal), testId: 'cart-subtotal' },
                { label: '배송비',     value: shipping === 0 ? '무료' : formatPrice(shipping), testId: 'cart-shipping' },
              ].map(({ label, value, testId }) => (
                <div key={testId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
                  <span style={{ color: '#666' }}>{label}</span>
                  <span data-testid={testId}>{value}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
                <span>총 결제 금액</span>
                <span data-testid="cart-total">{formatPrice(total)}</span>
              </div>
            </div>

            <button
              type="button"
              data-testid="cart-checkout-btn"
              style={{
                width: '100%',
                padding: 14,
                background: '#0055b2',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              결제하기
            </button>
          </>
        )}
      </div>
    </main>
  );
}
