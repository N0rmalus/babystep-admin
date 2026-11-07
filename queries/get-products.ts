import 'server-only';

import { Prisma, Product } from '@prisma/client';
import prismadb from '@/lib/prismadb';
import { getProductPricing } from '@/lib/product-pricing';
import { hasStockVariants, withStockCount } from '@/lib/product-variant';
import { buildPublicProduct } from '@/lib/public-product';

const STOCK_VARIANTS_SELECT = {
  select: {
    stockCount: true,
    isArchived: true,
  },
} satisfies Prisma.Product$variantsArgs;

const BY_POSITION = { position: 'asc' } as const;

export const ORDERED_IMAGES = {
  orderBy: BY_POSITION,
} satisfies Prisma.Product$imagesArgs;

const CHECKOUT_SELECT = {
  id: true,
  name: true,
  price: true,
  salePrice: true,
  saleStartsAt: true,
  saleEndsAt: true,
  variants: {
    select: {
      id: true,
      sku: true,
      stockCount: true,
      combinationKey: true,
      isArchived: true,
    },
  },
} satisfies Prisma.ProductSelect;

// Everything the public product shape is built from (see lib/public-product.ts)
export const PUBLIC_PRODUCT_INCLUDE = {
  images: ORDERED_IMAGES,
  subcategory: {
    include: {
      category: true,
    },
  },
  variants: {
    select: {
      id: true,
      sku: true,
      stockCount: true,
      price: true,
      salePrice: true,
      isArchived: true,
      combinationKey: true,
      optionValues: {
        select: {
          optionValueId: true,
        },
      },
    },
  },
  optionGroups: {
    orderBy: BY_POSITION,
    select: {
      group: {
        select: {
          id: true,
          name: true,
          displayType: true,
          values: {
            orderBy: BY_POSITION,
            select: {
              id: true,
              label: true,
              hex: true,
              ageFromMonths: true,
              ageToMonths: true,
              heightFromCm: true,
              heightToCm: true,
              weightFromKg: true,
              weightToKg: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export const toPublicProduct = (product: Prisma.ProductGetPayload<{ include: typeof PUBLIC_PRODUCT_INCLUDE }>) => {
  return buildPublicProduct(product);
};

export type PublicProduct = ReturnType<typeof toPublicProduct>;

type GetProductsOptions = {
  // Returns the public product shape: images, subcategory with category, `options` and resolved `variants`
  includeVariants?: boolean;
  includeSubcategory?: boolean;
  // Adds `stockCount` (available stock of active variants) and leaves raw variants out
  includeStockCount?: boolean;
  onlyActive?: boolean;
  isFeatured?: boolean;
  isOnSale?: boolean;
  categoryId?: string;
  subcategoryId?: string;
  productIds?: string[];
  orderByCreatedAt?: 'asc' | 'desc';
  selectCheckoutFields?: boolean;
};

export function getProducts(
  storeId: string,
  options: GetProductsOptions & { selectCheckoutFields: true; productIds: string[] },
): Promise<Prisma.ProductGetPayload<{ select: typeof CHECKOUT_SELECT }>[]>;
export function getProducts(
  storeId: string,
  options: GetProductsOptions & { includeVariants: true },
): Promise<PublicProduct[]>;
export function getProducts(
  storeId: string,
  options: GetProductsOptions & { includeSubcategory: true; includeStockCount: true },
): Promise<(Prisma.ProductGetPayload<{ include: { subcategory: true } }> & { stockCount: number })[]>;
export function getProducts(
  storeId: string,
  options: GetProductsOptions & { includeSubcategory: true },
): Promise<Prisma.ProductGetPayload<{ include: { subcategory: true } }>[]>;
export function getProducts(storeId: string, options?: GetProductsOptions): Promise<Product[]>;
export async function getProducts(storeId: string, options?: GetProductsOptions): Promise<unknown[]> {
  const where = getProductsWhere(storeId, options);
  const orderBy = options?.orderByCreatedAt ? { createdAt: options.orderByCreatedAt } : undefined;

  if (options?.includeVariants) {
    const products = await prismadb.product.findMany({ where, include: PUBLIC_PRODUCT_INCLUDE, orderBy });

    return filterOnSale({ products: products.map(toPublicProduct), isOnSale: options.isOnSale });
  }

  const products = await prismadb.product.findMany({
    where,
    ...(options?.selectCheckoutFields
      ? {
          select: CHECKOUT_SELECT,
        }
      : {}),
    ...(!options?.selectCheckoutFields && (options?.includeSubcategory || options?.includeStockCount)
      ? {
          include: {
            ...(options.includeStockCount ? { variants: STOCK_VARIANTS_SELECT } : {}),
            ...(options.includeSubcategory ? { subcategory: true } : {}),
          },
        }
      : {}),
    orderBy,
  });

  const productsWithStock = products.map((product) =>
    options?.includeStockCount && hasStockVariants(product) ? withStockCount(product) : product,
  );

  return filterOnSale({ products: productsWithStock, isOnSale: options?.isOnSale });
}

const getProductsWhere = (storeId: string, options?: GetProductsOptions) => {
  return {
    storeId,
    ...(options?.categoryId ? { subcategory: { categoryId: options.categoryId } } : {}),
    ...(options?.subcategoryId ? { subcategoryId: options.subcategoryId } : {}),
    ...(typeof options?.isFeatured === 'boolean' ? { isFeatured: options.isFeatured } : {}),
    ...(options?.isOnSale ? { salePrice: { not: null } } : {}),
    ...(options?.onlyActive ? { isArchived: false } : {}),
    ...(options?.productIds ? { id: { in: options.productIds } } : {}),
  } satisfies Prisma.ProductWhereInput;
};

const filterOnSale = <TProduct extends Parameters<typeof getProductPricing>[0]>({
  products,
  isOnSale,
}: {
  products: TProduct[];
  isOnSale?: boolean;
}) => {
  if (!isOnSale) {
    return products;
  }

  return products.filter((product) => getProductPricing(product).isOnSale);
};
