import 'server-only';

import { Prisma, Product } from '@prisma/client';
import prismadb from '@/lib/prismadb';

type GetProductOptions = {
  includeImages?: boolean;
  includeSubcategoryCategory?: boolean;
};

export function getProduct(
  storeId: string,
  productId: string,
  options: GetProductOptions & { includeImages: true; includeSubcategoryCategory: true },
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
  }> | null
>;
export function getProduct(
  storeId: string,
  productId: string,
  options: GetProductOptions & { includeImages: true },
): Promise<Prisma.ProductGetPayload<{ include: { images: true } }> | null>;
export function getProduct(storeId: string, productId: string, options?: GetProductOptions): Promise<Product | null>;
export async function getProduct(storeId: string, productId: string, options?: GetProductOptions) {
  const product = await prismadb.product.findFirst({
    where: {
      id: productId,
      storeId,
    },
    ...((options?.includeImages || options?.includeSubcategoryCategory)
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
              : {}),
          },
        }
      : {}),
  });

  return product;
}
