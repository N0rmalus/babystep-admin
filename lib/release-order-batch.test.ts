import { describe, expect, it } from 'vitest';

import { releaseOrderBatch } from '@/lib/release-order-batch';

const createRelease = (results: Record<string, boolean | Error>) => {
  const releasedOrderIds: string[] = [];
  const release = async (orderId: string) => {
    releasedOrderIds.push(orderId);
    const result = results[orderId];

    if (result instanceof Error) {
      throw result;
    }

    return result ?? false;
  };

  return { release, releasedOrderIds };
};

describe('releaseOrderBatch', () => {
  it('releases every expired order in the order given and counts the releases', async () => {
    const { release, releasedOrderIds } = createRelease({ 'order-1': true, 'order-2': true });

    const releasedCount = await releaseOrderBatch({
      findOrderIds: async () => ['order-1', 'order-2'],
      release,
      onReleaseError: () => {},
    });

    expect(releasedCount).toBe(2);
    expect(releasedOrderIds).toEqual(['order-1', 'order-2']);
  });

  it('does not count an order that something else released or paid in the meantime', async () => {
    const { release } = createRelease({ 'order-1': false, 'order-2': true });

    const releasedCount = await releaseOrderBatch({
      findOrderIds: async () => ['order-1', 'order-2'],
      release,
      onReleaseError: () => {},
    });

    expect(releasedCount).toBe(1);
  });

  it('reports a failed release and still releases the orders after it', async () => {
    const dbError = new Error('Transaction timed out');
    const { release, releasedOrderIds } = createRelease({ 'order-1': dbError, 'order-2': true });
    const reportedErrors: { error: unknown; orderId: string }[] = [];

    const releasedCount = await releaseOrderBatch({
      findOrderIds: async () => ['order-1', 'order-2'],
      release,
      onReleaseError: (error, orderId) => reportedErrors.push({ error, orderId }),
    });

    expect(releasedCount).toBe(1);
    expect(releasedOrderIds).toEqual(['order-1', 'order-2']);
    expect(reportedErrors).toEqual([{ error: dbError, orderId: 'order-1' }]);
  });
});
