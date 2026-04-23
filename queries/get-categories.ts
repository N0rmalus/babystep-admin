import 'server-only';

import { Category, Prisma } from '@prisma/client';
import prismadb from '@/lib/prismadb';

type GetCategoriesOptions = {
  includeBillboard?: boolean;
  orderByCreatedAt?: 'asc' | 'desc';
};

export function getCategories(
  storeId: string,
  options: GetCategoriesOptions & { includeBillboard: true },
): Promise<Prisma.CategoryGetPayload<{ include: { billboard: true } }>[]>;
export function getCategories(storeId: string, options?: GetCategoriesOptions): Promise<Category[]>;
export async function getCategories(storeId: string, options?: GetCategoriesOptions) {
  const categories = await prismadb.category.findMany({
    where: { storeId },
    ...(options?.includeBillboard
      ? {
          include: {
            billboard: true,
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

  return categories;
}
