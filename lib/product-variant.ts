type StockVariant = {
  stockCount: number;
  isArchived: boolean;
  combinationKey: string;
};

type VariantLike = {
  combinationKey: string;
  isArchived: boolean;
};

// The default variant has no option values, so its combination key is empty (ADR 0001).
export const DEFAULT_COMBINATION_KEY = '';

const COMBINATION_KEY_SEPARATOR = ',';

// Sorted option value ids joined by ",": the same combination gives the same key whatever the value order.
export const getCombinationKey = (optionValueIds: string[]): string => {
  return [...optionValueIds].sort().join(COMBINATION_KEY_SEPARATOR);
};

export const INVALID_STOCK_COUNT_MESSAGE = 'Reikalingas laisvas kiekis (sveikasis skaičius, ne mažesnis už 0)';

export const isValidStockCount = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
};

export const getDefaultVariant = <TVariant extends VariantLike>(variants: TVariant[]): TVariant | undefined => {
  return variants.find((variant) => !variant.isArchived && variant.combinationKey === DEFAULT_COMBINATION_KEY);
};

export const getAvailableStockCount = (variants: Omit<StockVariant, 'combinationKey'>[]): number => {
  return variants.reduce((total, variant) => (variant.isArchived ? total : total + variant.stockCount), 0);
};

export const normalizeOptionalSku = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  return value.trim() || null;
};

// Active variants with option values; 0 for a product that only has its default variant.
export const getOptionVariantCount = (variants: StockVariant[]): number => {
  return variants.filter((variant) => !variant.isArchived && variant.combinationKey !== DEFAULT_COMBINATION_KEY).length;
};

// Replaces raw variants with the product's available stock and option variant count, so variant rows never leak.
export const withStockCount = <TProduct extends { variants?: StockVariant[] }>({
  variants = [],
  ...product
}: TProduct) => {
  return { ...product, stockCount: getAvailableStockCount(variants), variantCount: getOptionVariantCount(variants) };
};

const DECIMAL_BASE = 10;
const HUNDRED = 100;
// 10–20 take the genitive plural ("variantų") whatever their last digit
const TEENS_START = 10;
const TEENS_END = 20;

// "1 variantas", "4 variantai", "12 variantų" (Lithuanian plural forms)
export const formatVariantCount = (count: number): string => {
  const lastDigit = count % DECIMAL_BASE;
  const lastTwoDigits = count % HUNDRED;
  const isTeen = lastTwoDigits >= TEENS_START && lastTwoDigits <= TEENS_END;

  if (lastDigit === 1 && !isTeen) {
    return `${count} variantas`;
  }

  if (lastDigit === 0 || isTeen) {
    return `${count} variantų`;
  }

  return `${count} variantai`;
};

export const hasStockVariants = (product: object): product is { variants: StockVariant[] } => {
  return 'variants' in product && Array.isArray(product.variants);
};
