import 'server-only';

import { Prisma, Product } from '@prisma/client';
import prismadb from '@/lib/prismadb';
import { DEFAULT_COMBINATION_KEY, hasStockVariants, withStockCount } from '@/lib/product-variant';
import { ORDERED_IMAGES, STOCK_VARIANTS_SELECT, type PublicProduct } from '@/queries/get-products';

const DEFAULT_VARIANT_SELECT = {
  where: {
    combinationKey: DEFAULT_COMBINATION_KEY,
  },
  select: {
    id: true,
    sku: true,
    stockCount: true,
  },
} satisfies Prisma.Product$variantsArgs;

type GetProductOptions = {
  includeImages?: boolean;
  includeSubcategoryCategory?: boolean;
  // Adds `stockCount` (available stock of active variants) and leaves raw variants out
  includeStockCount?: boolean;
  // Adds `variants` holding only the default variant (empty for a product with options)
  includeDefaultVariant?: boolean;
};

export function getProduct(
  storeId: string,
  productId: string,
  options: GetProductOptions & { includeImages: true; includeSubcategoryCategory: true; includeStockCount: true },
): Promise<PublicProduct | null>;
export function getProduct(
  storeId: string,
  productId: string,
  options: GetProductOptions & { includeImages: true; includeDefaultVariant: true },
): Promise<Prisma.ProductGetPayload<{
  include: { images: true; variants: { select: typeof DEFAULT_VARIANT_SELECT.select } };
}> | null>;
export function getProduct(storeId: string, productId: string, options?: GetProductOptions): Promise<Product | null>;
export async function getProduct(storeId: string, productId: string, options?: GetProductOptions): Promise<unknown> {
  const hasInclude =
    options?.includeImages ||
    options?.includeSubcategoryCategory ||
    options?.includeStockCount ||
    options?.includeDefaultVariant;

  const product = await prismadb.product.findFirst({
    where: {
      id: productId,
      storeId,
    },
    ...(hasInclude
      ? {
          include: {
            ...(options.includeImages ? { images: ORDERED_IMAGES } : {}),
            ...(options.includeStockCount ? { variants: STOCK_VARIANTS_SELECT } : {}),
            ...(options.includeDefaultVariant ? { variants: DEFAULT_VARIANT_SELECT } : {}),
            ...(options.includeSubcategoryCategory
              ? {
                  subcategory: {
                    include: {
                      category: true,
                    },
                  },
                }
              : {}),
          },
        }
      : {}),
  });

  if (product && options?.includeStockCount && hasStockVariants(product)) {
    return withStockCount(product);
  }

  return product;
}
