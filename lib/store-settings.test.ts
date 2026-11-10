import { describe, expect, it } from 'vitest';

import { getNextOrderNumberMessage } from '@/lib/store-settings';

describe('getNextOrderNumberMessage', () => {
  it('accepts a number above the highest existing order number', () => {
    expect(getNextOrderNumberMessage({ nextOrderNumber: 20001, highestOrderNumber: 10005 })).toBeNull();
  });

  it('rejects the highest existing order number itself', () => {
    expect(getNextOrderNumberMessage({ nextOrderNumber: 10005, highestOrderNumber: 10005 })).toBe(
      'Kitas užsakymo numeris turi būti didesnis nei 10005.',
    );
  });

  it('rejects a number below the highest existing order number', () => {
    expect(getNextOrderNumberMessage({ nextOrderNumber: 9000, highestOrderNumber: 10005 })).toBe(
      'Kitas užsakymo numeris turi būti didesnis nei 10005.',
    );
  });

  it('accepts any positive integer when the store has no orders', () => {
    expect(getNextOrderNumberMessage({ nextOrderNumber: 1, highestOrderNumber: null })).toBeNull();
  });

  it.each([0, -5, 10001.5, Number.NaN])('rejects %s as not a positive integer', (nextOrderNumber) => {
    expect(getNextOrderNumberMessage({ nextOrderNumber, highestOrderNumber: null })).toBe(
      'Kitas užsakymo numeris turi būti teigiamas sveikasis skaičius.',
    );
  });
});
