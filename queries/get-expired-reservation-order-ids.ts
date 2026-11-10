import 'server-only';

import { HOLDING_STOCK_WHERE } from '@/lib/order-stock-hold';
import prismadb from '@/lib/prismadb';

type GetExpiredReservationOrderIdsOptions = {
  cutoff: Date;
  limit: number;
  variantIds?: string[];
};

export const getExpiredReservationOrderIds = async ({
  cutoff,
  limit,
  variantIds,
}: GetExpiredReservationOrderIdsOptions): Promise<string[]> => {
  const orders = await prismadb.order.findMany({
    where: {
      ...HOLDING_STOCK_WHERE,
      expiresAt: { lt: cutoff },
      ...(variantIds ? { orderItems: { some: { variantId: { in: variantIds } } } } : {}),
    },
    orderBy: { expiresAt: 'asc' },
    take: limit,
    select: { id: true },
  });

  return orders.map(({ id }) => id);
};
