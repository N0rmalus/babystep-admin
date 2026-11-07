type StockVariant = {
  stockCount: number;
  isArchived: boolean;
};

type VariantLike = {
  combinationKey: string;
  isArchived: boolean;
};

// The default variant has no option values, so its combination key is empty (ADR 0001).
export const DEFAULT_COMBINATION_KEY = '';

export const INVALID_STOCK_COUNT_MESSAGE = 'Reikalingas laisvas kiekis (sveikasis skaičius, ne mažesnis už 0)';

export const isValidStockCount = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
};

export const getDefaultVariant = <TVariant extends VariantLike>(variants: TVariant[]): TVariant | undefined => {
  return variants.find((variant) => !variant.isArchived && variant.combinationKey === DEFAULT_COMBINATION_KEY);
};

export const getAvailableStockCount = (variants: StockVariant[]): number => {
  return variants.reduce((total, variant) => (variant.isArchived ? total : total + variant.stockCount), 0);
};

export const normalizeOptionalSku = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  return value.trim() || null;
};

// Replaces raw variants with the product's available stock, so variant rows never leak into API responses.
export const withStockCount = <TProduct extends { variants?: StockVariant[] }>({
  variants = [],
  ...product
}: TProduct) => {
  return { ...product, stockCount: getAvailableStockCount(variants) };
};

export const hasStockVariants = (product: object): product is { variants: StockVariant[] } => {
  return 'variants' in product && Array.isArray(product.variants);
};
