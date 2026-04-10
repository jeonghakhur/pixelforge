/**
 * @page 주문 내역 — 구매 이력 조회 및 상세 확인
 * @author 정민준
 * @category 마이페이지
 * @status dev-done
 */
'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';

type OrderStatus = 'completed' | 'pending' | 'cancelled';

interface Order {
  id: string;
  orderNo: string;
  date: string;
  items: string[];
  total: number;
  status: OrderStatus;
}

const ORDERS: Order[] = [
  { id: 'o-1', orderNo: 'PF-2026-00041', date: '2026.03.20', items: ['PixelForge Pro 구독 (연간)'],                           total: 120000, status: 'completed' },
  { id: 'o-2', orderNo: 'PF-2026-00038', date: '2026.03.15', items: ['Figma 플러그인 팩', 'Pretendard 라이선스'],              total:  84000, status: 'completed' },
  { id: 'o-3', orderNo: 'PF-2026-00031', date: '2026.03.08', items: ['Design Ops 템플릿'],                                    total:  29000, status: 'cancelled' },
  { id: 'o-4', orderNo: 'PF-2026-00024', date: '2026.02.28', items: ['컴포넌트 라이브러리 Pro', 'Motion One 강의 패키지'],     total: 158000, status: 'completed' },
  { id: 'o-5', orderNo: 'PF-2026-00017', date: '2026.02.14', items: ['PixelForge Starter 구독 (월간)'],                       total:  15000, status: 'pending'   },
];

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  completed: { label: '구매 완료', color: '#198754', bg: '#f0fff5' },
  pending:   { label: '처리 중',   color: '#e67e00', bg: '#fff8ee' },
  cancelled: { label: '취소됨',    color: '#999',    bg: '#f5f5f5' },
};

function formatPrice(n: number) {
  return n.toLocaleString('ko-KR') + '원';
}

export default function OrderHistoryPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  return (
    <main
      style={{
        minHeight: '100svh',
        background: '#f8f9fa',
        fontFamily: "'Pretendard', system-ui, sans-serif",
        padding: '40px 24px',
      }}
      data-testid="order-history-page"
    >
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 24 }}>
          주문 내역
        </h1>

        {ORDERS.length === 0 ? (
          <div data-testid="order-empty" style={{ textAlign: 'center', padding: '80px 0', color: '#999' }}>
            <Icon icon="solar:bag-2-linear" width={48} height={48} />
            <p style={{ marginTop: 12, fontSize: 15 }}>주문 내역이 없습니다.</p>
          </div>
        ) : (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="order-list">
            {ORDERS.map((order) => {
              const cfg = STATUS_CONFIG[order.status];
              const isOpen = expanded === order.id;

              return (
                <li
                  key={order.id}
                  data-testid={`order-${order.id}`}
                  style={{
                    background: '#fff',
                    borderRadius: 10,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  {/* 요약 행 */}
                  <button
                    type="button"
                    data-testid={`order-toggle-${order.id}`}
                    onClick={() => toggle(order.id)}
                    aria-expanded={isOpen}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '16px 20px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', color: '#333' }}>
                          {order.orderNo}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: cfg.color,
                            background: cfg.bg,
                            borderRadius: 4,
                            padding: '2px 7px',
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
                        {order.date} · {order.items[0]}{order.items.length > 1 ? ` 외 ${order.items.length - 1}건` : ''}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px' }}>{formatPrice(order.total)}</p>
                    </div>
                    <Icon
                      icon={isOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                      width={16}
                      height={16}
                      style={{ color: '#ccc', flexShrink: 0 }}
                    />
                  </button>

                  {/* 상세 패널 */}
                  {isOpen && (
                    <div
                      data-testid={`order-detail-${order.id}`}
                      style={{
                        borderTop: '1px solid #f0f0f0',
                        padding: '16px 20px',
                        background: '#fafafa',
                      }}
                    >
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#aaa', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        주문 상품
                      </p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {order.items.map((item) => (
                          <li key={item} style={{ fontSize: 13, color: '#555', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Icon icon="solar:box-linear" width={13} height={13} style={{ color: '#aaa' }} />
                            {item}
                          </li>
                        ))}
                      </ul>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          data-testid={`order-receipt-${order.id}`}
                          style={{ padding: '8px 16px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                        >
                          영수증 보기
                        </button>
                        {order.status === 'completed' && (
                          <button
                            type="button"
                            data-testid={`order-reorder-${order.id}`}
                            style={{ padding: '8px 16px', background: '#0055b2', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                          >
                            재구매
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}
