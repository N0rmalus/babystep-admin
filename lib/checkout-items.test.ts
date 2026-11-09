import { describe, expect, it } from 'vitest';

import { buildCheckoutItems } from '@/lib/checkout-items';

const NOW = new Date('2026-06-15T12:00:00Z');

const muslin = {
  id: 'muslin',
  name: 'Muslino merliukas',
  price: 20,
  salePrice: 15,
  saleStartsAt: null,
  saleEndsAt: null,
  variants: [{ id: 'muslin-default', sku: 'MM-1', stockCount: 5, combinationKey: '', isArchived: false }],
};

describe('buildCheckoutItems', () => {
  it('creates one item per product with its quantity, default variant, snapshot and prices', () => {
    const result = buildCheckoutItems({ productIds: ['muslin', 'muslin'], products: [muslin], now: NOW });

    expect(result).toEqual({
      status: 'ok',
      items: [
        {
          productId: 'muslin',
          variantId: 'muslin-default',
          quantity: 2,
          productName: 'Muslino merliukas',
          sku: 'MM-1',
          unitPrice: 15,
          regularUnitPrice: 20,
        },
      ],
    });
  });

  it('rejects missing products and products that have options as unavailable', () => {
    const sized = {
      ...muslin,
      id: 'sized',
      variants: [{ id: 'sized-s', sku: null, stockCount: 3, combinationKey: 'value-s', isArchived: false }],
    };

    const result = buildCheckoutItems({ productIds: ['muslin', 'sized', 'gone'], products: [muslin, sized], now: NOW });

    expect(result).toEqual({ status: 'unavailable', invalidProductIds: ['sized', 'gone'] });
  });

  it('rejects quantities above the available stock of the default variant', () => {
    const productIds = Array.from({ length: 6 }, () => 'muslin');

    const result = buildCheckoutItems({ productIds, products: [muslin], now: NOW });

    expect(result).toEqual({
      status: 'insufficient-stock',
      insufficientStockItems: [{ productId: 'muslin', requested: 6, available: 5 }],
    });
  });
});
