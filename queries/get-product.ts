import 'server-only';

import { Prisma, Product } from '@prisma/client';
import prismadb from '@/lib/prismadb';
import { ORDERED_IMAGES, PUBLIC_PRODUCT_INCLUDE, toPublicProduct, type PublicProduct } from '@/queries/get-products';

// What the variant editor in the product form needs: active variants and the product's groups in order
const VARIANT_EDITOR_INCLUDE = {
  images: ORDERED_IMAGES,
  variants: {
    where: { isArchived: false },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      sku: true,
      stockCount: true,
      price: true,
      salePrice: true,
      combinationKey: true,
      optionValues: { select: { optionValueId: true } },
    },
  },
  optionGroups: {
    orderBy: { position: 'asc' },
    select: { groupId: true },
  },
} satisfies Prisma.ProductInclude;

// Every variant (archived too) with whether it has orders: the input for planVariantChanges
const PLAN_VARIANTS_INCLUDE = {
  variants: {
    select: {
      id: true,
      combinationKey: true,
      isArchived: true,
      _count: { select: { orderItems: true } },
    },
  },
} satisfies Prisma.ProductInclude;

type GetProductOptions = {
  // Returns the public product shape: images, subcategory with category, `options` and resolved `variants`
  includeVariants?: boolean;
  // Adds images, active variants with their option value ids, and the product's ordered group ids
  includeVariantEditor?: boolean;
  // Adds every variant with its combination key, archived flag and order count
  includePlanVariants?: boolean;
};

export function getProduct(
  storeId: string,
  productId: string,
  options: GetProductOptions & { includeVariants: true },
): Promise<PublicProduct | null>;
export function getProduct(
  storeId: string,
  productId: string,
  options: GetProductOptions & { includeVariantEditor: true },
): Promise<Prisma.ProductGetPayload<{ include: typeof VARIANT_EDITOR_INCLUDE }> | null>;
export function getProduct(
  storeId: string,
  productId: string,
  options: GetProductOptions & { includePlanVariants: true },
): Promise<Prisma.ProductGetPayload<{ include: typeof PLAN_VARIANTS_INCLUDE }> | null>;
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

  if (options?.includeVariantEditor) {
    return prismadb.product.findFirst({ where, include: VARIANT_EDITOR_INCLUDE });
  }

  if (options?.includePlanVariants) {
    return prismadb.product.findFirst({ where, include: PLAN_VARIANTS_INCLUDE });
  }

  return prismadb.product.findFirst({ where });
}
