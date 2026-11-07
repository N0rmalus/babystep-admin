import { describe, expect, it } from 'vitest';

import { getOrderItemTotal, getProductPricing, resolveVariantPrices } from '@/lib/product-pricing';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-06-15T12:00:00Z');
const YESTERDAY = new Date(NOW.getTime() - DAY_MS);
const TOMORROW = new Date(NOW.getTime() + DAY_MS);

describe('getProductPricing', () => {
  it('applies the sale price while the sale is active', () => {
    const pricing = getProductPricing(
      { price: 100, salePrice: 75, saleStartsAt: YESTERDAY, saleEndsAt: TOMORROW },
      NOW,
    );

    expect(pricing).toEqual({
      regularPrice: 100,
      salePrice: 75,
      effectivePrice: 75,
      discountPercent: 25,
      isOnSale: true,
      status: 'active',
    });
  });

  it('treats a sale without dates as active', () => {
    const pricing = getProductPricing({ price: '50', salePrice: '40' }, NOW);

    expect(pricing.status).toBe('active');
    expect(pricing.effectivePrice).toBe(40);
    expect(pricing.discountPercent).toBe(20);
  });

  it('keeps the regular price for a scheduled sale', () => {
    const pricing = getProductPricing({ price: 100, salePrice: 75, saleStartsAt: TOMORROW }, NOW);

    expect(pricing.status).toBe('scheduled');
    expect(pricing.isOnSale).toBe(false);
    expect(pricing.effectivePrice).toBe(100);
    expect(pricing.discountPercent).toBe(0);
  });

  it('keeps the regular price after the sale has ended', () => {
    const pricing = getProductPricing({ price: 100, salePrice: 75, saleEndsAt: YESTERDAY }, NOW);

    expect(pricing.status).toBe('ended');
    expect(pricing.isOnSale).toBe(false);
    expect(pricing.effectivePrice).toBe(100);
  });

  it('reads Prisma Decimal-like prices', () => {
    const pricing = getProductPricing({ price: { toNumber: () => 80 }, salePrice: { toNumber: () => 60 } }, NOW);

    expect(pricing.effectivePrice).toBe(60);
  });

  it('ignores a sale price that is not below the regular price', () => {
    const pricing = getProductPricing({ price: 100, salePrice: 120 }, NOW);

    expect(pricing.status).toBe('invalid');
    expect(pricing.effectivePrice).toBe(100);
  });

  it('reports no sale when there is no sale price', () => {
    const pricing = getProductPricing({ price: 100 }, NOW);

    expect(pricing.status).toBe('none');
    expect(pricing.effectivePrice).toBe(100);
  });
});

describe('getOrderItemTotal', () => {
  it('multiplies the unit price paid by the quantity', () => {
    expect(getOrderItemTotal({ unitPrice: { toNumber: () => 19.99 }, quantity: 3 })).toBe(59.97);
  });
});

describe('resolveVariantPrices', () => {
  const product = { price: 20, salePrice: 15 };

  it('inherits both the price and the sale price when the variant overrides neither', () => {
    expect(resolveVariantPrices({ product, variant: { price: null, salePrice: null } })).toEqual({
      price: 20,
      salePrice: 15,
    });
  });

  it('overrides both when the variant has its own price, keeping its own sale price', () => {
    expect(resolveVariantPrices({ product, variant: { price: 24, salePrice: 18 } })).toEqual({
      price: 24,
      salePrice: 18,
    });
  });

  it('treats an overriding variant without a sale price as not on sale, ignoring the product sale price', () => {
    expect(resolveVariantPrices({ product, variant: { price: 24, salePrice: null } })).toEqual({
      price: 24,
      salePrice: null,
    });
  });

  it('lets getProductPricing judge the resolved sale against the product sale window', () => {
    const prices = resolveVariantPrices({ product, variant: { price: 24, salePrice: 18 } });

    expect(getProductPricing({ ...prices, saleStartsAt: TOMORROW }, NOW).isOnSale).toBe(false);
    expect(getProductPricing({ ...prices, saleStartsAt: YESTERDAY }, NOW).effectivePrice).toBe(18);
  });
});
