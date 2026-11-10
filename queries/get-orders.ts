import 'server-only';

import { ADMIN_ORDER_SELECT } from '@/lib/admin-order';
import prismadb from '@/lib/prismadb';

export const getOrders = async (storeId: string) => {
  const orders = await prismadb.order.findMany({
    where: {
      storeId: storeId,
    },
    select: ADMIN_ORDER_SELECT,
    orderBy: {
      createdAt: 'desc',
    },
  });

  return orders;
};
