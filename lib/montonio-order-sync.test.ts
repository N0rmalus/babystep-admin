import { describe, expect, it, vi } from 'vitest';

import type { MontonioOrderToken, VerifyOrderTokenResult } from '@/lib/montonio-client';
import { type SyncOrder, syncOrderToken } from '@/lib/montonio-order-sync';

const ORDER_ID = 'order-1';
const TOKEN = 'signed-token';

const TOKEN_ORDER = {
  uuid: 'montonio-uuid',
  merchantReference: ORDER_ID,
  paymentStatus: 'ABANDONED',
  grandTotal: 42.96,
  currency: 'EUR',
} satisfies MontonioOrderToken;

const PENDING_ORDER = {
  id: ORDER_ID,
  isPaid: false,
  paymentStatus: 'PENDING',
  stockReleasedAt: null,
  montonioOrderUuid: 'montonio-uuid',
  total: 42.96,
} satisfies SyncOrder;

const sync = ({
  verified = { status: 'valid', order: TOKEN_ORDER },
  order = PENDING_ORDER,
  expectedOrderId,
}: {
  verified?: VerifyOrderTokenResult;
  order?: SyncOrder | null;
  expectedOrderId?: string;
} = {}) => {
  const getOrder = vi.fn(async () => order);
  const applyAction = vi.fn(async () => {});
  const result = syncOrderToken({
    token: TOKEN,
    expectedOrderId,
    verifyOrderToken: async () => verified,
    getOrder,
    applyAction,
  });

  return { result, getOrder, applyAction };
};

describe('syncOrderToken', () => {
  it('applies the webhook transition for a valid token', async () => {
    const { result, applyAction } = sync({ expectedOrderId: ORDER_ID });

    await expect(result).resolves.toEqual({ status: 'applied', orderId: ORDER_ID, action: { type: 'abandon' } });
    expect(applyAction).toHaveBeenCalledWith({ order: PENDING_ORDER, action: { type: 'abandon' } });
  });

  it('marks a pending order paid when the token says PAID', async () => {
    const { result } = sync({ verified: { status: 'valid', order: { ...TOKEN_ORDER, paymentStatus: 'PAID' } } });

    await expect(result).resolves.toMatchObject({ status: 'applied', action: { type: 'mark-paid' } });
  });

  it('rejects a token with a bad signature without loading the order', async () => {
    const { result, getOrder } = sync({ verified: { status: 'invalid' } });

    await expect(result).resolves.toEqual({ status: 'invalid' });
    expect(getOrder).not.toHaveBeenCalled();
  });

  it('rejects a token signed for another access key', async () => {
    const { result } = sync({ verified: { status: 'foreign-access-key' } });

    await expect(result).resolves.toEqual({ status: 'rejected', reason: 'FOREIGN_ACCESS_KEY' });
  });

  it('rejects a token for a different order than expected, without loading it', async () => {
    const { result, getOrder, applyAction } = sync({ expectedOrderId: 'order-2' });

    await expect(result).resolves.toEqual({ status: 'rejected', reason: 'ORDER_ID', orderId: ORDER_ID });
    expect(getOrder).not.toHaveBeenCalled();
    expect(applyAction).not.toHaveBeenCalled();
  });

  it('rejects a token for an unknown order', async () => {
    const { result } = sync({ order: null });

    await expect(result).resolves.toEqual({ status: 'rejected', reason: 'ORDER_NOT_FOUND', orderId: ORDER_ID });
  });

  it.each([
    ['UUID', { ...TOKEN_ORDER, uuid: 'other-uuid' }],
    ['AMOUNT', { ...TOKEN_ORDER, grandTotal: 1 }],
    ['CURRENCY', { ...TOKEN_ORDER, currency: 'USD' }],
  ] as const)('rejects a %s mismatch without applying anything', async (reason, tokenOrder) => {
    const { result, applyAction } = sync({ verified: { status: 'valid', order: tokenOrder } });

    await expect(result).resolves.toEqual({ status: 'rejected', reason, orderId: ORDER_ID });
    expect(applyAction).not.toHaveBeenCalled();
  });

  it('reports an order whose Montonio UUID is not stored yet', async () => {
    const { result, applyAction } = sync({ order: { ...PENDING_ORDER, montonioOrderUuid: null } });

    await expect(result).resolves.toEqual({ status: 'uuid-missing', orderId: ORDER_ID });
    expect(applyAction).not.toHaveBeenCalled();
  });
});
