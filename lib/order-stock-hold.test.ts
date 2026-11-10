import type { PaymentStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { HOLDING_STOCK_WHERE, isHoldingStock } from '@/lib/order-stock-hold';

const RELEASED_AT = new Date('2026-11-10T12:00:00Z');

type OrderState = {
  paymentStatus: PaymentStatus;
  isPaid: boolean;
  stockReleasedAt: Date | null;
};

const ORDER_CASES: { name: string; order: OrderState; isHolding: boolean }[] = [
  {
    name: 'a pending order',
    order: { paymentStatus: 'PENDING', isPaid: false, stockReleasedAt: null },
    isHolding: true,
  },
  {
    name: 'an authorized, unpaid order',
    order: { paymentStatus: 'AUTHORIZED', isPaid: false, stockReleasedAt: null },
    isHolding: true,
  },
  {
    name: 'a released pending order',
    order: { paymentStatus: 'PENDING', isPaid: false, stockReleasedAt: RELEASED_AT },
    isHolding: false,
  },
  {
    name: 'a released authorized order',
    order: { paymentStatus: 'AUTHORIZED', isPaid: false, stockReleasedAt: RELEASED_AT },
    isHolding: false,
  },
  {
    name: 'an abandoned order',
    order: { paymentStatus: 'ABANDONED', isPaid: false, stockReleasedAt: RELEASED_AT },
    isHolding: false,
  },
  { name: 'a paid order', order: { paymentStatus: 'PAID', isPaid: true, stockReleasedAt: null }, isHolding: false },
  {
    name: 'a voided order that was paid',
    order: { paymentStatus: 'VOIDED', isPaid: true, stockReleasedAt: null },
    isHolding: false,
  },
];

describe('isHoldingStock', () => {
  it.each(ORDER_CASES)('is $isHolding for $name', ({ order, isHolding }) => {
    expect(isHoldingStock(order)).toBe(isHolding);
  });
});

describe('HOLDING_STOCK_WHERE', () => {
  it.each(ORDER_CASES)('matches $name exactly when it holds stock', ({ order, isHolding }) => {
    expect(matchesEqualityWhere(order, HOLDING_STOCK_WHERE)).toBe(isHolding);
  });

  it('counts an authorized order as reserved', () => {
    const authorizedOrder = { paymentStatus: 'AUTHORIZED', isPaid: false, stockReleasedAt: null } satisfies OrderState;

    expect(matchesEqualityWhere(authorizedOrder, HOLDING_STOCK_WHERE)).toBe(true);
  });
});

const matchesEqualityWhere = (order: OrderState, where: Record<string, unknown>) =>
  Object.entries(where).every(([field, value]) =>
    Object.entries(order).some(([key, actual]) => key === field && actual === value),
  );
