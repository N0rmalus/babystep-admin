import 'server-only';

import { Prisma, Subcategory } from '@prisma/client';
import prismadb from '@/lib/prismadb';

type GetSubcategoryOptions = {
  includeCategory?: boolean;
};

export function getSubcategory(
  storeId: string,
  subcategoryId: string,
  options: GetSubcategoryOptions & { includeCategory: true },
): Promise<Prisma.SubcategoryGetPayload<{ include: { category: true } }> | null>;
export function getSubcategory(
  storeId: string,
  subcategoryId: string,
  options?: GetSubcategoryOptions,
): Promise<Subcategory | null>;
export async function getSubcategory(storeId: string, subcategoryId: string, options?: GetSubcategoryOptions) {
  const subcategory = await prismadb.subcategory.findFirst({
    where: {
      id: subcategoryId,
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
  });

  return subcategory;
}
