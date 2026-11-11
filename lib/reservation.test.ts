import { beforeEach, describe, expect, it, vi } from 'vitest';

import { releasePreviousAttempt } from '@/lib/reservation';

const { updateMany, findMany, update, captureException } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@sentry/nextjs', () => ({ captureException }));
vi.mock('@/queries/get-expired-reservation-order-ids', () => ({ getExpiredReservationOrderIds: vi.fn() }));
vi.mock('@/lib/prismadb', () => {
  const tx = { order: { updateMany }, orderItem: { findMany }, productVariant: { update } };

  return { default: { $transaction: (run: (client: typeof tx) => Promise<unknown>) => run(tx) } };
});

const NOW = new Date('2026-11-11T12:00:00Z');
const OPTIONS = { orderId: 'order-1', storeId: 'store-1', email: 'ona@example.test', now: NOW };

describe('releasePreviousAttempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    updateMany.mockResolvedValue({ count: 1 });
    findMany.mockResolvedValue([{ variantId: 'variant-1', quantity: 2 }]);
  });

  it('releases the earlier attempt only while it holds stock in the same store for the same customer', async () => {
    await expect(releasePreviousAttempt(OPTIONS)).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-1',
        storeId: 'store-1',
        email: { equals: 'ona@example.test', mode: 'insensitive' },
        isPaid: false,
        stockReleasedAt: null,
      },
      data: { stockReleasedAt: NOW },
    });
    expect(update).toHaveBeenCalledWith({ where: { id: 'variant-1' }, data: { stockCount: { increment: 2 } } });
  });

  it('leaves stock alone when the order is paid, released, or not the customer’s', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(releasePreviousAttempt(OPTIONS)).resolves.toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it('reports a failed release instead of failing the new checkout', async () => {
    const error = new Error('database down');
    updateMany.mockRejectedValue(error);

    await expect(releasePreviousAttempt(OPTIONS)).resolves.toBe(false);
    expect(captureException).toHaveBeenCalledWith(error, { extra: { orderId: 'order-1' } });
  });
});
