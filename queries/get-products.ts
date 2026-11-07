import 'server-only';

import { Prisma, Product } from '@prisma/client';
import prismadb from '@/lib/prismadb';
import { getProductPricing } from '@/lib/product-pricing';
import { hasStockVariants, withStockCount } from '@/lib/product-variant';

export const STOCK_VARIANTS_SELECT = {
  select: {
    stockCount: true,
    isArchived: true,
  },
} satisfies Prisma.Product$variantsArgs;

export const ORDERED_IMAGES = {
  orderBy: {
    position: 'asc',
  },
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

export type PublicProduct = Prisma.ProductGetPayload<{
  include: {
    images: true;
    subcategory: {
      include: {
        category: true;
      };
    };
  };
}> & { stockCount: number };

type GetProductsOptions = {
  includeImages?: boolean;
  includeSubcategory?: boolean;
  includeSubcategoryCategory?: boolean;
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
  options: GetProductsOptions & { includeImages: true; includeSubcategoryCategory: true; includeStockCount: true },
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
  const products = await prismadb.product.findMany({
    where: {
      storeId,
      ...(options?.categoryId ? { subcategory: { categoryId: options.categoryId } } : {}),
      ...(options?.subcategoryId ? { subcategoryId: options.subcategoryId } : {}),
      ...(typeof options?.isFeatured === 'boolean' ? { isFeatured: options.isFeatured } : {}),
      ...(options?.isOnSale ? { salePrice: { not: null } } : {}),
      ...(options?.onlyActive ? { isArchived: false } : {}),
      ...(options?.productIds
        ? {
            id: {
              in: options.productIds,
            },
          }
        : {}),
    },
    ...(options?.selectCheckoutFields
      ? {
          select: CHECKOUT_SELECT,
        }
      : {}),
    ...(!options?.selectCheckoutFields &&
    (options?.includeImages ||
      options?.includeSubcategory ||
      options?.includeSubcategoryCategory ||
      options?.includeStockCount)
      ? {
          include: {
            ...(options.includeImages ? { images: ORDERED_IMAGES } : {}),
            ...(options.includeStockCount ? { variants: STOCK_VARIANTS_SELECT } : {}),
            ...(options.includeSubcategoryCategory
              ? {
                  subcategory: {
                    include: {
                      category: true,
                    },
                  },
                }
              : options.includeSubcategory
                ? {
                    subcategory: true,
                  }
                : {}),
          },
        }
      : {}),
    ...(options?.orderByCreatedAt
      ? {
          orderBy: {
            createdAt: options.orderByCreatedAt,
          },
        }
      : {}),
  });

  const productsWithStock = products.map((product) =>
    options?.includeStockCount && hasStockVariants(product) ? withStockCount(product) : product,
  );

  if (options?.isOnSale) {
    return productsWithStock.filter((product) => getProductPricing(product).isOnSale);
  }

  return productsWithStock;
}
