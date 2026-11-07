import { getProductPricing } from '@/lib/product-pricing';

type PricingInput = Parameters<typeof getProductPricing>[0];

export type PriceRange = {
  min: number;
  max: number;
};

// The catalog-relevant slice of the public product shape (lib/public-product.ts).
// `variants` holds only active option variants. A product with options but no active variants is unavailable.
type CatalogProduct = Required<PricingInput> & {
  hasOptions: boolean;
  stockCount: number;
  variants: (Pick<PricingInput, 'price' | 'salePrice'> & { stockCount: number })[];
};

// Catalog rules work across active variants. A product without options is priced and stocked as itself.

// Null when the product has no active variant to price
export const getLowestEffectivePrice = (product: CatalogProduct, now = new Date()): number | null => {
  const prices = getEffectivePrices(product, now);

  if (prices.length === 0) {
    return null;
  }

  return Math.min(...prices);
};

// Price sort order. Unpriced products (options but no active variants) sort last in both directions.
export const compareByLowestPrice = ({
  first,
  second,
  isDescending,
  now = new Date(),
}: {
  first: CatalogProduct;
  second: CatalogProduct;
  isDescending: boolean;
  now?: Date;
}): number => {
  const firstPrice = getLowestEffectivePrice(first, now);
  const secondPrice = getLowestEffectivePrice(second, now);

  if (firstPrice === null || secondPrice === null) {
    return Number(firstPrice === null) - Number(secondPrice === null);
  }

  return isDescending ? secondPrice - firstPrice : firstPrice - secondPrice;
};

// A missing bound is open; with no bounds every product matches, priced or not
export const hasEffectivePriceInRange = ({
  product,
  min,
  max,
  now = new Date(),
}: Partial<PriceRange> & { product: CatalogProduct; now?: Date }): boolean => {
  if (min === undefined && max === undefined) {
    return true;
  }

  return getEffectivePrices(product, now).some(
    (price) => (min === undefined || price >= min) && (max === undefined || price <= max),
  );
};

export const isOnSale = (product: CatalogProduct, now = new Date()): boolean => {
  return getVariantPricings(product, now).some((pricing) => pricing.isOnSale);
};

export const isInStock = (product: CatalogProduct): boolean => {
  if (!product.hasOptions) {
    return product.stockCount > 0;
  }

  return product.variants.some(({ stockCount }) => stockCount > 0);
};

// Bounds for the storefront's price slider
export const getCatalogPriceRange = (products: CatalogProduct[], now = new Date()): PriceRange => {
  const prices = products
    .flatMap((product) => getEffectivePrices(product, now))
    .filter((price) => Number.isFinite(price) && price >= 0);

  if (prices.length === 0) {
    return { min: 0, max: 0 };
  }

  return {
    min: Math.floor(Math.min(...prices)),
    max: Math.ceil(Math.max(...prices)),
  };
};

const getEffectivePrices = (product: CatalogProduct, now: Date) => {
  return getVariantPricings(product, now).map(({ effectivePrice }) => effectivePrice);
};

// Variants inherit the product's sale window
const getVariantPricings = (product: CatalogProduct, now: Date) => {
  if (!product.hasOptions) {
    return [getProductPricing(product, now)];
  }

  return product.variants.map(({ price, salePrice }) =>
    getProductPricing({ price, salePrice, saleStartsAt: product.saleStartsAt, saleEndsAt: product.saleEndsAt }, now),
  );
};
