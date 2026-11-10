import { describe, expect, it } from 'vitest';

import {
  getAvailableStockCount,
  getDefaultVariant,
  getSellableVariants,
  normalizeOptionalSku,
} from '@/lib/product-variant';

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

describe('getSellableVariants', () => {
  const defaultVariant = { id: 'default', combinationKey: '', isArchived: false };
  const smallVariant = { id: 'small', combinationKey: 'size-s', isArchived: false };
  const archivedMediumVariant = { id: 'medium', combinationKey: 'size-m', isArchived: true };

  it('sells the default variant of a product without option groups or active option variants', () => {
    const result = getSellableVariants({
      hasOptionGroups: false,
      variants: [archivedMediumVariant, defaultVariant],
    });

    expect(result).toEqual({ hasOptions: false, defaultVariant });
  });

  it('sells only the active option variants of a product with option groups', () => {
    const result = getSellableVariants({
      hasOptionGroups: true,
      variants: [defaultVariant, smallVariant, archivedMediumVariant],
    });

    expect(result).toEqual({ hasOptions: true, optionVariants: [smallVariant] });
  });

  it('treats active option variants as options even after all groups were removed', () => {
    const result = getSellableVariants({ hasOptionGroups: false, variants: [defaultVariant, smallVariant] });

    expect(result).toEqual({ hasOptions: true, optionVariants: [smallVariant] });
  });

  it('never falls back to the default variant when every option variant is archived', () => {
    const result = getSellableVariants({ hasOptionGroups: true, variants: [defaultVariant, archivedMediumVariant] });

    expect(result).toEqual({ hasOptions: true, optionVariants: [] });
  });

  it('sells nothing when a product without options has no active default variant', () => {
    const result = getSellableVariants({
      hasOptionGroups: false,
      variants: [{ ...defaultVariant, isArchived: true }],
    });

    expect(result).toEqual({ hasOptions: true, optionVariants: [] });
  });
});
