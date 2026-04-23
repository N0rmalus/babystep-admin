import 'server-only';

import { Prisma, Subcategory } from '@prisma/client';
import prismadb from '@/lib/prismadb';

type GetSubcategoriesOptions = {
  includeCategory?: boolean;
  orderByCreatedAt?: 'asc' | 'desc';
};

export function getSubcategories(
  storeId: string,
  options: GetSubcategoriesOptions & { includeCategory: true },
): Promise<Prisma.SubcategoryGetPayload<{ include: { category: true } }>[]>;

export function getSubcategories(storeId: string, options?: GetSubcategoriesOptions): Promise<Subcategory[]>;

export async function getSubcategories(storeId: string, options?: GetSubcategoriesOptions) {
  const subcategories = await prismadb.subcategory.findMany({
    where: {
      category: {
        storeId,
      },
    },
    ...(options?.includeCategory
      ? {
          include: {
            category: true,
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

  return subcategories;
}
