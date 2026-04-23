import 'server-only';

import { Category, Prisma } from '@prisma/client';
import prismadb from '@/lib/prismadb';

type GetCategoryOptions = {
  includeBillboard?: boolean;
};

export function getCategory(
  storeId: string,
  categoryId: string,
  options: GetCategoryOptions & { includeBillboard: true },
): Promise<Prisma.CategoryGetPayload<{ include: { billboard: true } }> | null>;
export function getCategory(storeId: string, categoryId: string, options?: GetCategoryOptions): Promise<Category | null>;
export async function getCategory(storeId: string, categoryId: string, options?: GetCategoryOptions) {
  const category = await prismadb.category.findFirst({
    where: {
      id: categoryId,
      storeId,
    },
    ...(options?.includeBillboard
      ? {
          include: {
            billboard: true,
          },
        }
      : {}),
  });

  return category;
}
