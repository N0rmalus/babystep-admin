import 'server-only';

import { Prisma, Product } from '@prisma/client';
import prismadb from '@/lib/prismadb';
import { buildPublicProduct, withUsedImageTags } from '@/lib/public-product';
import { ORDERED_IMAGES, PUBLIC_IMAGE_SELECT, PUBLIC_PRODUCT_INCLUDE } from '@/queries/get-products';

// The public product shape plus image tags, which only the single-product response has
const SINGLE_PUBLIC_PRODUCT_INCLUDE = {
  ...PUBLIC_PRODUCT_INCLUDE,
  images: { ...ORDERED_IMAGES, select: { ...PUBLIC_IMAGE_SELECT, optionValueId: true } },
} satisfies Prisma.ProductInclude;

const toSinglePublicProduct = (
  product: Prisma.ProductGetPayload<{ include: typeof SINGLE_PUBLIC_PRODUCT_INCLUDE }>,
) => {
  const publicProduct = buildPublicProduct(product);

  return { ...publicProduct, images: withUsedImageTags(publicProduct) };
};

export type SinglePublicProduct = ReturnType<typeof toSinglePublicProduct>;

// What the variant editor in the product form needs: active variants, the product's groups in order and its
// own product groups with their values
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
  ownedOptionGroups: {
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, values: { orderBy: { position: 'asc' }, select: { id: true, label: true } } },
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
  // Returns the public product shape (images with their tags, subcategory with category, `options` and resolved
  // `variants`)
  includeVariants?: boolean;
  // Adds images, active variants with their option value ids, the product's ordered group ids and its product groups
  includeVariantEditor?: boolean;
  // Adds every variant with its combination key, archived flag and order count
  includePlanVariants?: boolean;
};

export function getProduct(
  storeId: string,
  productId: string,
  options: GetProductOptions & { includeVariants: true },
): Promise<SinglePublicProduct | null>;
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
    const product = await prismadb.product.findFirst({ where, include: SINGLE_PUBLIC_PRODUCT_INCLUDE });

    return product ? toSinglePublicProduct(product) : null;
  }

  if (options?.includeVariantEditor) {
    return prismadb.product.findFirst({ where, include: VARIANT_EDITOR_INCLUDE });
  }

  if (options?.includePlanVariants) {
    return prismadb.product.findFirst({ where, include: PLAN_VARIANTS_INCLUDE });
  }

  return prismadb.product.findFirst({ where });
}
