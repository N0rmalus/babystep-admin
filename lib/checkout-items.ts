import { CENTS_PER_EURO, getOrderItemTotal, getProductPricing } from '@/lib/product-pricing';
import { getDefaultVariant } from '@/lib/product-variant';

type PriceLike = Parameters<typeof getProductPricing>[0]['price'];

type CheckoutVariant = {
  id: string;
  sku: string | null;
  stockCount: number;
  combinationKey: string;
  isArchived: boolean;
};

type CheckoutProduct = {
  id: string;
  name: string;
  price: PriceLike;
  salePrice: PriceLike;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  variants: CheckoutVariant[];
};

type Options = {
  productIds: string[];
  products: CheckoutProduct[];
  now?: Date;
};

export type CheckoutItem = {
  productId: string;
  variantId: string;
  quantity: number;
  productName: string;
  sku: string | null;
  unitPrice: number;
  regularUnitPrice: number;
};

export type CheckoutItemsResult =
  | { status: 'ok'; items: CheckoutItem[] }
  | { status: 'unavailable'; invalidProductIds: string[] }
  | { status: 'insufficient-stock'; insufficientStockItems: InsufficientStockItem[] };

type InsufficientStockItem = {
  productId: string;
  requested: number;
  available: number;
};

export const getCheckoutItemsTotal = (items: CheckoutItem[]): number => {
  const totalCents = items.reduce((sum, item) => sum + Math.round(getOrderItemTotal(item) * CENTS_PER_EURO), 0);

  return totalCents / CENTS_PER_EURO;
};

// Interim until the Montonio checkout (step 3): each product id resolves to the product's default variant.
export const buildCheckoutItems = ({ productIds, products, now = new Date() }: Options): CheckoutItemsResult => {
  const quantityByProductId = countByProductId(productIds);
  const productById = new Map(products.map((product) => [product.id, product]));
  const items: CheckoutItem[] = [];
  const invalidProductIds: string[] = [];
  const insufficientStockItems: InsufficientStockItem[] = [];

  for (const [productId, quantity] of quantityByProductId) {
    const product = productById.get(productId);
    const variant = product ? getDefaultVariant(product.variants) : undefined;

    if (!product || !variant) {
      invalidProductIds.push(productId);
      continue;
    }

    if (quantity > variant.stockCount) {
      insufficientStockItems.push({ productId, requested: quantity, available: variant.stockCount });
    }

    const pricing = getProductPricing(product, now);

    items.push({
      productId,
      variantId: variant.id,
      quantity,
      productName: product.name,
      sku: variant.sku,
      unitPrice: pricing.effectivePrice,
      regularUnitPrice: pricing.regularPrice,
    });
  }

  if (invalidProductIds.length > 0) {
    return { status: 'unavailable', invalidProductIds };
  }

  if (insufficientStockItems.length > 0) {
    return { status: 'insufficient-stock', insufficientStockItems };
  }

  return { status: 'ok', items };
};

const countByProductId = (productIds: string[]) => {
  const counts = new Map<string, number>();

  productIds.forEach((productId) => {
    counts.set(productId, (counts.get(productId) ?? 0) + 1);
  });

  return counts;
};
