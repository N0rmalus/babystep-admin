import { describe, expect, it } from 'vitest';

import { getVariantTotalStock } from '@/lib/variant-stock';

describe('getVariantTotalStock', () => {
  it('adds the reserved units to the available stock', () => {
    expect(getVariantTotalStock({ stockCount: 5, reservedCount: 2 })).toBe(7);
  });

  it('reads the available stock as typed in the form', () => {
    expect(getVariantTotalStock({ stockCount: '3', reservedCount: 2 })).toBe(5);
  });

  it('has no total while the available stock is empty or invalid', () => {
    expect(getVariantTotalStock({ stockCount: '', reservedCount: 2 })).toBeNull();
    expect(getVariantTotalStock({ stockCount: '-1', reservedCount: 2 })).toBeNull();
    expect(getVariantTotalStock({ stockCount: '1.5', reservedCount: 0 })).toBeNull();
  });
});
