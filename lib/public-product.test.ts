import { describe, expect, it } from 'vitest';

import { buildPublicProduct } from '@/lib/public-product';

const NO_SIZES = {
  ageFromMonths: null,
  ageToMonths: null,
  heightFromCm: null,
  heightToCm: null,
  weightFromKg: null,
  weightToKg: null,
};

const createValue = ({ id, label, hex = null }: { id: string; label: string; hex?: string | null }) => ({
  id,
  label,
  hex,
  ...NO_SIZES,
});

const createVariant = (
  overrides: Partial<{
    id: string;
    sku: string | null;
    stockCount: number;
    price: number | null;
    salePrice: number | null;
    isArchived: boolean;
    optionValueIds: string[];
  }>,
) => {
  const optionValueIds = overrides.optionValueIds ?? [];

  return {
    id: overrides.id ?? 'variant',
    sku: overrides.sku ?? null,
    stockCount: overrides.stockCount ?? 0,
    price: overrides.price ?? null,
    salePrice: overrides.salePrice ?? null,
    isArchived: overrides.isArchived ?? false,
    combinationKey: [...optionValueIds].sort().join(','),
    optionValues: optionValueIds.map((optionValueId) => ({ optionValueId })),
  };
};

const SIZE_GROUP = {
  id: 'size',
  name: 'Dydis',
  displayType: 'CHIPS',
  values: [
    { id: 'size-0-6', label: '0–6 mėn.', hex: null, ...NO_SIZES, ageFromMonths: 0, ageToMonths: 6 },
    createValue({ id: 'size-6-12', label: '6–12 mėn.' }),
    createValue({ id: 'size-12-18', label: '12–18 mėn.' }),
  ],
};

const COLOUR_GROUP = {
  id: 'colour',
  name: 'Spalva',
  displayType: 'SWATCH',
  values: [
    createValue({ id: 'sage', label: 'Šalavijų', hex: '#A3B18A' }),
    createValue({ id: 'oat', label: 'Avižų', hex: '#E8DCC4' }),
  ],
};

const createProduct = (
  overrides: Partial<{ variants: ReturnType<typeof createVariant>[]; groups: (typeof SIZE_GROUP)[] }>,
) => ({
  id: 'product',
  name: 'Muslino merliukas',
  price: 20,
  salePrice: 15,
  saleStartsAt: null,
  saleEndsAt: null,
  variants: overrides.variants ?? [],
  optionGroups: (overrides.groups ?? []).map((group) => ({ group })),
});

describe('buildPublicProduct', () => {
  it('hides the default variant and takes product-level price and stock from it', () => {
    const product = buildPublicProduct(
      createProduct({ variants: [createVariant({ id: 'default', sku: 'BS-1', stockCount: 7 })] }),
    );

    expect(product).toEqual({
      id: 'product',
      name: 'Muslino merliukas',
      price: 20,
      salePrice: 15,
      saleStartsAt: null,
      saleEndsAt: null,
      stockCount: 7,
      hasOptions: false,
      options: [],
      variants: [],
    });
  });

  it('lists active variants with resolved prices, labels in group order and summed product stock', () => {
    const product = buildPublicProduct(
      createProduct({
        groups: [SIZE_GROUP, COLOUR_GROUP],
        variants: [
          createVariant({ id: 'inherits', sku: 'BS-1-S', stockCount: 3, optionValueIds: ['sage', 'size-0-6'] }),
          createVariant({
            id: 'overrides',
            stockCount: 2,
            price: 24,
            salePrice: null,
            optionValueIds: ['oat', 'size-6-12'],
          }),
        ],
      }),
    );

    expect(product.stockCount).toBe(5);
    expect(product.price).toBe(20);
    expect(product.variants).toEqual([
      {
        id: 'inherits',
        sku: 'BS-1-S',
        label: 'Dydis: 0–6 mėn. · Spalva: Šalavijų',
        optionValueIds: ['size-0-6', 'sage'],
        price: 20,
        salePrice: 15,
        stockCount: 3,
      },
      {
        id: 'overrides',
        sku: null,
        label: 'Dydis: 6–12 mėn. · Spalva: Avižų',
        optionValueIds: ['size-6-12', 'oat'],
        price: 24,
        salePrice: null,
        stockCount: 2,
      },
    ]);
  });

  it('lists only the values active variants use, in group then value order, without archived variants', () => {
    const product = buildPublicProduct(
      createProduct({
        groups: [SIZE_GROUP, COLOUR_GROUP],
        variants: [
          createVariant({ id: 'oat-big', stockCount: 1, optionValueIds: ['oat', 'size-6-12'] }),
          createVariant({ id: 'sage-small', stockCount: 1, optionValueIds: ['sage', 'size-0-6'] }),
          createVariant({ id: 'archived', stockCount: 9, isArchived: true, optionValueIds: ['sage', 'size-12-18'] }),
        ],
      }),
    );

    expect(product.variants.map(({ id }) => id)).toEqual(['oat-big', 'sage-small']);
    expect(product.stockCount).toBe(2);
    expect(product.options).toEqual([
      {
        id: 'size',
        name: 'Dydis',
        displayType: 'CHIPS',
        values: [
          { id: 'size-0-6', label: '0–6 mėn.', hex: null, ...NO_SIZES, ageFromMonths: 0, ageToMonths: 6 },
          { id: 'size-6-12', label: '6–12 mėn.', hex: null, ...NO_SIZES },
        ],
      },
      {
        id: 'colour',
        name: 'Spalva',
        displayType: 'SWATCH',
        values: [
          { id: 'sage', label: 'Šalavijų', hex: '#A3B18A', ...NO_SIZES },
          { id: 'oat', label: 'Avižų', hex: '#E8DCC4', ...NO_SIZES },
        ],
      },
    ]);
  });

  it('leaves out a group none of the active variants use', () => {
    const product = buildPublicProduct(
      createProduct({
        groups: [SIZE_GROUP, COLOUR_GROUP],
        variants: [
          createVariant({ id: 'sized', stockCount: 1, optionValueIds: ['size-0-6'] }),
          createVariant({ id: 'archived', isArchived: true, optionValueIds: ['oat', 'size-6-12'] }),
        ],
      }),
    );

    expect(product.options.map(({ id }) => id)).toEqual(['size']);
  });

  it('treats a product whose variants are all archived as unavailable, like sold out', () => {
    const product = buildPublicProduct(
      createProduct({
        groups: [SIZE_GROUP],
        variants: [
          createVariant({ id: 'default', stockCount: 4, isArchived: true }),
          createVariant({ id: 'sized', stockCount: 6, isArchived: true, optionValueIds: ['size-0-6'] }),
        ],
      }),
    );

    expect(product).toMatchObject({ stockCount: 0, options: [], variants: [] });
  });

  it('treats a product whose groups were removed as a plain product, ignoring its archived option variants', () => {
    const product = buildPublicProduct(
      createProduct({
        groups: [],
        variants: [
          createVariant({ id: 'default', stockCount: 4 }),
          createVariant({ id: 'sized', stockCount: 6, isArchived: true, optionValueIds: ['size-0-6'] }),
        ],
      }),
    );

    expect(product).toMatchObject({ hasOptions: false, stockCount: 4, options: [], variants: [] });
  });

  it('keeps a product with option groups unavailable when only its default variant is still active', () => {
    const product = buildPublicProduct(
      createProduct({
        groups: [SIZE_GROUP],
        variants: [
          createVariant({ id: 'default', stockCount: 4 }),
          createVariant({ id: 'sized', stockCount: 6, isArchived: true, optionValueIds: ['size-0-6'] }),
        ],
      }),
    );

    expect(product).toMatchObject({ stockCount: 0, options: [], variants: [] });
  });

  it('uses the default variant price override for the product-level prices', () => {
    const product = buildPublicProduct(
      createProduct({ variants: [createVariant({ id: 'default', stockCount: 1, price: 30, salePrice: null })] }),
    );

    expect(product).toMatchObject({ price: 30, salePrice: null, variants: [] });
  });
});
