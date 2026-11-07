import { describe, expect, it } from 'vitest';

import { getAvailableStockCount, getDefaultVariant, normalizeOptionalSku } from '@/lib/product-variant';

describe('getDefaultVariant', () => {
  it('returns the active variant without option values', () => {
    const variants = [
      { id: 'sized', combinationKey: 'value-1', isArchived: false },
      { id: 'default', combinationKey: '', isArchived: false },
    ];

    expect(getDefaultVariant(variants)?.id).toBe('default');
  });

  it('ignores an archived default variant', () => {
    expect(getDefaultVariant([{ id: 'default', combinationKey: '', isArchived: true }])).toBeUndefined();
  });
});

describe('getAvailableStockCount', () => {
  it('sums available stock of active variants only', () => {
    const variants = [
      { stockCount: 4, isArchived: false },
      { stockCount: 3, isArchived: false },
      { stockCount: 10, isArchived: true },
    ];

    expect(getAvailableStockCount(variants)).toBe(7);
  });
});

describe('normalizeOptionalSku', () => {
  it('trims the SKU and treats a blank one as not set', () => {
    expect(normalizeOptionalSku('  BS-001 ')).toBe('BS-001');
    expect(normalizeOptionalSku('   ')).toBeNull();
    expect(normalizeOptionalSku(undefined)).toBeNull();
  });
});
