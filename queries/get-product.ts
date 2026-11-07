import 'server-only';

import { Prisma, Product } from '@prisma/client';
import prismadb from '@/lib/prismadb';
import { DEFAULT_COMBINATION_KEY } from '@/lib/product-variant';
import { ORDERED_IMAGES, PUBLIC_PRODUCT_INCLUDE, toPublicProduct, type PublicProduct } from '@/queries/get-products';

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
  // Returns the public product shape: images, subcategory with category, `options` and resolved `variants`
  includeVariants?: boolean;
  // Adds `variants` holding only the default variant (empty for a product with options)
  includeDefaultVariant?: boolean;
};

export function getProduct(
  storeId: string,
  productId: string,
  options: GetProductOptions & { includeVariants: true },
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
  const where = {
    id: productId,
    storeId,
  };

  if (options?.includeVariants) {
    const product = await prismadb.product.findFirst({ where, include: PUBLIC_PRODUCT_INCLUDE });

    return product ? toPublicProduct(product) : null;
  }

  const hasInclude = options?.includeImages || options?.includeDefaultVariant;

  return prismadb.product.findFirst({
    where,
    ...(hasInclude
      ? {
          include: {
            ...(options.includeImages ? { images: ORDERED_IMAGES } : {}),
            ...(options.includeDefaultVariant ? { variants: DEFAULT_VARIANT_SELECT } : {}),
          },
        }
      : {}),
  });
}
