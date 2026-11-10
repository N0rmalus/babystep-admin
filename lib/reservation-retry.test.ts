import { describe, expect, it } from 'vitest';

import { reserveWithRetry } from '@/lib/reservation-retry';

const ORDER = { id: 'order-uuid-1', number: 10027 };
const SLIPPER_SHORTAGE = { productId: 'tapukai-su-rastukais', availableCount: 2 };

const createAttempts = (results: ({ status: 'reserved'; order: typeof ORDER } | { status: 'short' })[]) => {
  let attemptCount = 0;
  const reserve = async () => {
    const result = results.at(attemptCount);
    attemptCount += 1;

    if (!result) {
      throw new Error('Unexpected reservation attempt');
    }

    return result;
  };

  return { reserve, getAttemptCount: () => attemptCount };
};

describe('reserveWithRetry', () => {
  it('retries once when the stock re-read finds no shortage, and returns the reserved order', async () => {
    const { reserve, getAttemptCount } = createAttempts([{ status: 'short' }, { status: 'reserved', order: ORDER }]);

    const result = await reserveWithRetry({ reserve, getShortages: async () => [] });

    expect(result).toEqual({ status: 'reserved', order: ORDER });
    expect(getAttemptCount()).toBe(2);
  });

  it('reports the shortage without retrying when the re-read finds one', async () => {
    const { reserve, getAttemptCount } = createAttempts([{ status: 'short' }]);

    const result = await reserveWithRetry({ reserve, getShortages: async () => [SLIPPER_SHORTAGE] });

    expect(result).toEqual({ status: 'stock-changed', items: [SLIPPER_SHORTAGE] });
    expect(getAttemptCount()).toBe(1);
  });

  it('reports the shortage found after the retry also fails', async () => {
    const { reserve } = createAttempts([{ status: 'short' }, { status: 'short' }]);
    const shortageReads = [[], [SLIPPER_SHORTAGE]];

    const result = await reserveWithRetry({ reserve, getShortages: async () => shortageReads.shift() ?? [] });

    expect(result).toEqual({ status: 'stock-changed', items: [SLIPPER_SHORTAGE] });
  });

  it('never reports an empty stock change when the retry fails without a shortage', async () => {
    const { reserve, getAttemptCount } = createAttempts([{ status: 'short' }, { status: 'short' }]);

    await expect(reserveWithRetry({ reserve, getShortages: async () => [] })).rejects.toThrow();
    expect(getAttemptCount()).toBe(2);
  });
});
