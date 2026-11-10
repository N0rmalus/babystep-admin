import 'server-only';

import { HOLDING_STOCK_WHERE } from '@/lib/order-stock-hold';
import prismadb from '@/lib/prismadb';
import type { ReservedCounts } from '@/lib/variant-stock';

export const getVariantReservedCounts = async (variantIds: string[]): Promise<ReservedCounts> => {
  if (variantIds.length === 0) {
    return {};
  }

  const groups = await prismadb.orderItem.groupBy({
    by: ['variantId'],
    where: {
      variantId: { in: variantIds },
      order: HOLDING_STOCK_WHERE,
    },
    _sum: { quantity: true },
  });

  return Object.fromEntries(groups.map(({ variantId, _sum }) => [variantId, _sum.quantity ?? 0]));
};
