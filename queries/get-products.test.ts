import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProducts } from '@/queries/get-products';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prismadb', () => ({ default: { product: { findMany } } }));

const STORE_ID = 'store';

const SIZE_GROUP = {
  id: 'size',
  name: 'Dydis',
  displayType: 'CHIPS',
  values: [{ id: 'small', label: 'S' }],
};

const createVariant = ({
  combinationKey,
  price = null,
  salePrice = null,
}: {
  combinationKey: string;
  price?: number | null;
  salePrice?: number | null;
}) => ({
  id: `variant-${combinationKey}`,
  sku: null,
  stockCount: 1,
  price,
  salePrice,
  isArchived: false,
  combinationKey,
  optionValues: combinationKey ? [{ optionValueId: combinationKey }] : [],
});

// Database rows with everything the public product shape is built from
const createRow = ({
  id,
  salePrice,
  variants,
  hasOptions,
}: {
  id: string;
  salePrice: number | null;
  variants: ReturnType<typeof createVariant>[];
  hasOptions: boolean;
}) => ({
  id,
  storeId: STORE_ID,
  name: id,
  price: 20,
  salePrice,
  saleStartsAt: null,
  saleEndsAt: null,
  isArchived: false,
  createdAt: new Date('2026-01-01'),
  images: [],
  subcategory: null,
  variants,
  optionGroups: hasOptions ? [{ group: SIZE_GROUP }] : [],
});

const ROWS = [
  // Only a variant is on sale; the product has no sale price of its own
  createRow({
    id: 'variant-sale',
    salePrice: null,
    hasOptions: true,
    variants: [createVariant({ combinationKey: 'small', price: 30, salePrice: 25 })],
  }),
  // The product has a sale price, but its only variant overrides the price without a sale
  createRow({
    id: 'overridden-sale',
    salePrice: 15,
    hasOptions: true,
    variants: [createVariant({ combinationKey: 'small', price: 30 })],
  }),
  createRow({
    id: 'simple-sale',
    salePrice: 15,
    hasOptions: false,
    variants: [createVariant({ combinationKey: '' })],
  }),
  createRow({
    id: 'no-sale',
    salePrice: null,
    hasOptions: false,
    variants: [createVariant({ combinationKey: '' })],
  }),
];

const SALE_PRODUCT_IDS = ['variant-sale', 'simple-sale'];

const getIds = (products: { id: string }[]) => products.map(({ id }) => id);

describe('getProducts with isOnSale', () => {
  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue(ROWS);
  });

  it('keeps products with any active variant on sale in the public shape', async () => {
    const products = await getProducts(STORE_ID, { isOnSale: true, includeVariants: true });

    expect(getIds(products)).toEqual(SALE_PRODUCT_IDS);
  });

  it('applies the same variant-aware rule without includeVariants', async () => {
    const products = await getProducts(STORE_ID, { isOnSale: true });

    expect(getIds(products)).toEqual(SALE_PRODUCT_IDS);
  });

  it('applies the same variant-aware rule to the subcategory shape', async () => {
    const products = await getProducts(STORE_ID, { isOnSale: true, includeSubcategory: true });

    expect(getIds(products)).toEqual(SALE_PRODUCT_IDS);
  });

  it('returns every product when isOnSale is not set', async () => {
    const products = await getProducts(STORE_ID, {});

    expect(getIds(products)).toEqual(getIds(ROWS));
  });
});
