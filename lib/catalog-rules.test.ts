import { describe, expect, it } from 'vitest';

import {
  compareByLowestPrice,
  getCatalogPriceRange,
  getLowestEffectivePrice,
  hasEffectivePriceInRange,
  isInStock,
  isOnSale,
} from '@/lib/catalog-rules';
import { buildPublicProduct } from '@/lib/public-product';

const NOW = new Date('2026-06-15T12:00:00Z');
const YESTERDAY = new Date('2026-06-14T12:00:00Z');

const SIZE_GROUP = {
  id: 'size',
  name: 'Dydis',
  values: [
    { id: 'small', label: 'S' },
    { id: 'medium', label: 'M' },
    { id: 'large', label: 'L' },
  ],
};

type VariantOverrides = Partial<{
  price: number | null;
  salePrice: number | null;
  stockCount: number;
  isArchived: boolean;
}>;

const createVariant = (optionValueId: string, overrides: VariantOverrides = {}) => ({
  id: optionValueId,
  sku: null,
  stockCount: overrides.stockCount ?? 1,
  price: overrides.price ?? null,
  salePrice: overrides.salePrice ?? null,
  isArchived: overrides.isArchived ?? false,
  combinationKey: optionValueId,
  optionValues: [{ optionValueId }],
});

const createDefaultVariant = (overrides: VariantOverrides = {}) => ({
  ...createVariant('default', overrides),
  combinationKey: '',
  optionValues: [],
});

type ProductOverrides = Partial<{
  price: number;
  salePrice: number | null;
  saleEndsAt: Date | null;
}>;

const createProduct = ({
  overrides,
  variants,
  groups,
}: {
  overrides: ProductOverrides;
  variants: ReturnType<typeof createVariant>[];
  groups: (typeof SIZE_GROUP)[];
}) =>
  buildPublicProduct({
    id: 'product',
    price: overrides.price ?? 20,
    salePrice: overrides.salePrice ?? null,
    saleStartsAt: null,
    saleEndsAt: overrides.saleEndsAt ?? null,
    variants,
    optionGroups: groups.map((group) => ({ group })),
  });

// A product with a Dydis option group and the given option variants
const createProductWithOptions = ({
  variants = [],
  ...overrides
}: ProductOverrides & { variants?: ReturnType<typeof createVariant>[] } = {}) =>
  createProduct({ overrides, variants, groups: [SIZE_GROUP] });

// A product without options: only the default variant
const createSimpleProduct = ({ stockCount = 1, ...overrides }: ProductOverrides & { stockCount?: number } = {}) =>
  createProduct({ overrides, variants: [createDefaultVariant({ stockCount })], groups: [] });

describe('a product with options whose variants are all archived', () => {
  const product = createProductWithOptions({
    price: 20,
    salePrice: 15,
    variants: [createVariant('small', { price: 30, salePrice: 25, stockCount: 4, isArchived: true })],
  });

  it('has no price and never falls back to the product price', () => {
    expect(getLowestEffectivePrice(product, NOW)).toBeNull();
    expect(getCatalogPriceRange([product], NOW)).toEqual({ min: 0, max: 0 });
    expect(hasEffectivePriceInRange({ product, min: 0, max: 100, now: NOW })).toBe(false);
  });

  it('still shows when no price bound is set', () => {
    expect(hasEffectivePriceInRange({ product, now: NOW })).toBe(true);
  });

  it('is neither on sale nor in stock', () => {
    expect(isOnSale(product, NOW)).toBe(false);
    expect(isInStock(product)).toBe(false);
  });
});

describe('getLowestEffectivePrice', () => {
  it('returns the lowest effective price across active variants', () => {
    const product = createProductWithOptions({
      price: 20,
      variants: [
        createVariant('small', { price: 30, salePrice: 12 }),
        createVariant('medium'),
        createVariant('large', { price: 25 }),
      ],
    });

    expect(getLowestEffectivePrice(product, NOW)).toBe(12);
  });

  it('ignores archived variants', () => {
    const product = createProductWithOptions({
      variants: [createVariant('small', { price: 5, isArchived: true }), createVariant('medium', { price: 18 })],
    });

    expect(getLowestEffectivePrice(product, NOW)).toBe(18);
  });

  it('uses the product sale price for a product without options', () => {
    const product = createSimpleProduct({ price: 20, salePrice: 15 });

    expect(getLowestEffectivePrice(product, NOW)).toBe(15);
  });

  it('applies the product sale window to variant sale prices', () => {
    const product = createProductWithOptions({
      saleEndsAt: YESTERDAY,
      variants: [createVariant('small', { price: 30, salePrice: 12 })],
    });

    expect(getLowestEffectivePrice(product, NOW)).toBe(30);
  });
});

describe('compareByLowestPrice', () => {
  const cheap = createProductWithOptions({
    variants: [createVariant('small', { price: 50 }), createVariant('medium', { price: 8 })],
  });
  const middle = createSimpleProduct({ price: 20 });
  const unpriced = createProductWithOptions({
    variants: [createVariant('small', { price: 1, isArchived: true })],
  });
  const sortNames = (isDescending: boolean) =>
    [
      { name: 'unpriced', product: unpriced },
      { name: 'middle', product: middle },
      { name: 'cheap', product: cheap },
    ]
      .sort((first, second) =>
        compareByLowestPrice({ first: first.product, second: second.product, isDescending, now: NOW }),
      )
      .map(({ name }) => name);

  it('sorts ascending by the lowest variant price, unpriced last', () => {
    expect(sortNames(false)).toEqual(['cheap', 'middle', 'unpriced']);
  });

  it('sorts descending by the lowest variant price, unpriced still last', () => {
    expect(sortNames(true)).toEqual(['middle', 'cheap', 'unpriced']);
  });
});

describe('isOnSale', () => {
  it('is on sale when a variant overrides with its own sale price, even without a product sale price', () => {
    const product = createProductWithOptions({
      salePrice: null,
      variants: [createVariant('small', { price: 30 }), createVariant('medium', { price: 30, salePrice: 25 })],
    });

    expect(isOnSale(product, NOW)).toBe(true);
  });

  it('is on sale when a variant inherits an active product sale', () => {
    const product = createProductWithOptions({
      price: 20,
      salePrice: 15,
      variants: [createVariant('small', { price: 30 }), createVariant('medium')],
    });

    expect(isOnSale(product, NOW)).toBe(true);
  });

  it('is not on sale when every variant overrides without a sale price', () => {
    const product = createProductWithOptions({
      price: 20,
      salePrice: 15,
      variants: [createVariant('small', { price: 30 })],
    });

    expect(isOnSale(product, NOW)).toBe(false);
  });

  it('ignores archived variants', () => {
    const product = createProductWithOptions({
      variants: [
        createVariant('small', { price: 30 }),
        createVariant('medium', { price: 30, salePrice: 25, isArchived: true }),
      ],
    });

    expect(isOnSale(product, NOW)).toBe(false);
  });

  it('is not on sale once the product sale window has ended', () => {
    const product = createProductWithOptions({
      saleEndsAt: YESTERDAY,
      variants: [createVariant('small', { price: 30, salePrice: 25 })],
    });

    expect(isOnSale(product, NOW)).toBe(false);
  });

  it('uses the product sale for a product without options', () => {
    expect(isOnSale(createSimpleProduct({ price: 20, salePrice: 15 }), NOW)).toBe(true);
    expect(isOnSale(createSimpleProduct({ price: 20 }), NOW)).toBe(false);
  });
});

describe('isInStock', () => {
  it('is in stock when any active variant has stock', () => {
    const product = createProductWithOptions({
      variants: [createVariant('small', { stockCount: 0 }), createVariant('medium', { stockCount: 2 })],
    });

    expect(isInStock(product)).toBe(true);
  });

  it('is out of stock when only archived variants have stock', () => {
    const product = createProductWithOptions({
      variants: [
        createVariant('small', { stockCount: 0 }),
        createVariant('medium', { stockCount: 5, isArchived: true }),
      ],
    });

    expect(isInStock(product)).toBe(false);
  });

  it('uses the default variant stock for a product without options', () => {
    expect(isInStock(createSimpleProduct({ stockCount: 3 }))).toBe(true);
    expect(isInStock(createSimpleProduct({ stockCount: 0 }))).toBe(false);
  });
});

describe('getCatalogPriceRange', () => {
  it('spans all active variant prices across products, rounded outwards', () => {
    const products = [
      createProductWithOptions({
        variants: [
          createVariant('small', { price: 9.5 }),
          createVariant('medium', { price: 80.2 }),
          createVariant('large', { price: 100, isArchived: true }),
        ],
      }),
      createSimpleProduct({ price: 20, salePrice: 4.9 }),
    ];

    expect(getCatalogPriceRange(products, NOW)).toEqual({ min: 4, max: 81 });
  });

  it('is zero for an empty catalog', () => {
    expect(getCatalogPriceRange([], NOW)).toEqual({ min: 0, max: 0 });
  });
});

describe('hasEffectivePriceInRange', () => {
  const product = createProductWithOptions({
    variants: [createVariant('small', { price: 10 }), createVariant('large', { price: 40 })],
  });

  it('matches when any active variant price is in range', () => {
    expect(hasEffectivePriceInRange({ product, min: 35, max: 45, now: NOW })).toBe(true);
    expect(hasEffectivePriceInRange({ product, min: 5, max: 15, now: NOW })).toBe(true);
  });

  it('does not match when no variant price is in range', () => {
    expect(hasEffectivePriceInRange({ product, min: 15, max: 35, now: NOW })).toBe(false);
  });

  it('treats a missing bound as open', () => {
    expect(hasEffectivePriceInRange({ product, min: 30, now: NOW })).toBe(true);
    expect(hasEffectivePriceInRange({ product, now: NOW })).toBe(true);
  });

  it('ignores archived variants', () => {
    const withArchived = createProductWithOptions({
      variants: [createVariant('small', { price: 10 }), createVariant('large', { price: 40, isArchived: true })],
    });

    expect(hasEffectivePriceInRange({ product: withArchived, min: 35, now: NOW })).toBe(false);
  });
});
