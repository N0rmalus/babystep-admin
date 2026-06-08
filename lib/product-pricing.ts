type PriceLike = number | string | { toNumber: () => number } | null | undefined;
type DateLike = Date | string | null | undefined;

type ProductPricingInput = {
  price: PriceLike;
  salePrice?: PriceLike;
  saleStartsAt?: DateLike;
  saleEndsAt?: DateLike;
};

type OrderItemPricingInput = {
  unitPrice?: PriceLike;
  product: ProductPricingInput;
};

type SaleValidationInput = {
  price: number | null;
  salePrice: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
};

export type SaleStatus = 'none' | 'active' | 'scheduled' | 'ended' | 'invalid';

export const hasSubmittedValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return true;
};

export const normalizeOptionalPrice = (value: PriceLike) => {
  if (!hasSubmittedValue(value)) {
    return null;
  }

  const numericValue = getNumberFromPrice(value);

  return Number.isFinite(numericValue) ? numericValue : null;
};

export const normalizeOptionalDate = (value: DateLike) => {
  if (!hasSubmittedValue(value)) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

export const getProductSaleValidationMessage = ({
  price,
  salePrice,
  saleStartsAt,
  saleEndsAt,
}: SaleValidationInput) => {
  if (price === null || price <= 0) {
    return 'Reikalinga teigiama kaina';
  }

  if (salePrice === null) {
    if (saleStartsAt || saleEndsAt) {
      return 'Akcijos datas galima nurodyti tik kartu su akcijos kaina';
    }

    return null;
  }

  if (salePrice <= 0) {
    return 'Akcijos kaina turi būti didesnė už 0';
  }

  if (salePrice >= price) {
    return 'Akcijos kaina turi būti mažesnė už įprastą kainą';
  }

  if (saleStartsAt && saleEndsAt && saleStartsAt.getTime() > saleEndsAt.getTime()) {
    return 'Akcijos pradžia negali būti vėliau nei pabaiga';
  }

  return null;
};

export const getProductPricing = (product: ProductPricingInput, now = new Date()) => {
  const regularPrice = normalizeOptionalPrice(product.price) ?? 0;
  const salePrice = normalizeOptionalPrice(product.salePrice);
  const status = getProductSaleStatus(product, now);
  const isOnSale = status === 'active' && salePrice !== null;
  const effectivePrice = isOnSale ? salePrice : regularPrice;
  const discountPercent =
    isOnSale && regularPrice > 0 ? Math.max(Math.round(((regularPrice - salePrice) / regularPrice) * 100), 1) : 0;

  return {
    regularPrice,
    salePrice,
    effectivePrice,
    discountPercent,
    isOnSale,
    status,
  };
};

export const getProductEffectivePrice = (product: ProductPricingInput, now = new Date()) => {
  return getProductPricing(product, now).effectivePrice;
};

export const getOrderItemPrice = (orderItem: OrderItemPricingInput, now = new Date()) => {
  return normalizeOptionalPrice(orderItem.unitPrice) ?? getProductEffectivePrice(orderItem.product, now);
};

export const getProductSaleStatus = (product: ProductPricingInput, now = new Date()): SaleStatus => {
  const regularPrice = normalizeOptionalPrice(product.price);
  const salePrice = normalizeOptionalPrice(product.salePrice);

  if (regularPrice === null || salePrice === null) {
    return 'none';
  }

  if (salePrice <= 0 || salePrice >= regularPrice) {
    return 'invalid';
  }

  const startsAt = normalizeOptionalDate(product.saleStartsAt);
  const endsAt = normalizeOptionalDate(product.saleEndsAt);

  if (startsAt && startsAt.getTime() > now.getTime()) {
    return 'scheduled';
  }

  if (endsAt && endsAt.getTime() < now.getTime()) {
    return 'ended';
  }

  return 'active';
};

const getNumberFromPrice = (value: PriceLike) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  if (hasToNumber(value)) {
    return value.toNumber();
  }

  return Number.NaN;
};

const hasToNumber = (value: PriceLike): value is { toNumber: () => number } => {
  return typeof value === 'object' && value !== null && 'toNumber' in value && typeof value.toNumber === 'function';
};
