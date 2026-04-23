import 'server-only';

import { Prisma, Product } from '@prisma/client';
import prismadb from '@/lib/prismadb';

type GetProductsOptions = {
  includeImages?: boolean;
  includeSubcategory?: boolean;
  includeSubcategoryCategory?: boolean;
  onlyActive?: boolean;
  isFeatured?: boolean;
  subcategoryId?: string;
  productIds?: string[];
  orderByCreatedAt?: 'asc' | 'desc';
  selectCheckoutFields?: boolean;
};

export function getProducts(
  storeId: string,
  options: GetProductsOptions & { selectCheckoutFields: true; productIds: string[] },
): Promise<Prisma.ProductGetPayload<{ select: { id: true; name: true; price: true; amountInStock: true } }>[]>;
export function getProducts(
  storeId: string,
  options: GetProductsOptions & { includeImages: true; includeSubcategoryCategory: true },
): Promise<
  Prisma.ProductGetPayload<{
    include: {
      images: true;
      subcategory: {
        include: {
          category: true;
        };
      };
    };
  }>[]
>;
export function getProducts(
  storeId: string,
  options: GetProductsOptions & { includeSubcategory: true },
): Promise<Prisma.ProductGetPayload<{ include: { subcategory: true } }>[]>;
export function getProducts(storeId: string, options?: GetProductsOptions): Promise<Product[]>;
export async function getProducts(storeId: string, options?: GetProductsOptions) {
  const products = await prismadb.product.findMany({
    where: {
      storeId,
      ...(options?.subcategoryId ? { subcategoryId: options.subcategoryId } : {}),
      ...(typeof options?.isFeatured === 'boolean' ? { isFeatured: options.isFeatured } : {}),
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
          select: {
            id: true,
            name: true,
            price: true,
            amountInStock: true,
          },
        }
      : {}),
    ...(!options?.selectCheckoutFields && (options?.includeImages || options?.includeSubcategory || options?.includeSubcategoryCategory)
      ? {
          include: {
            ...(options.includeImages ? { images: true } : {}),
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

  return products;
}
