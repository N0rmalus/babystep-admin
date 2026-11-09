import 'server-only';

import prismadb from '@/lib/prismadb';

export const getVariantStockCounts = async (
  variantIds: string[],
): Promise<{ variantId: string; stockCount: number }[]> => {
  const variants = await prismadb.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, stockCount: true },
  });

  return variants.map(({ id, stockCount }) => ({ variantId: id, stockCount }));
};
