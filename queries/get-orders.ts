import 'server-only';

import prismadb from '@/lib/prismadb';

export const getOrders = async (storeId: string) => {
  const orders = await prismadb.order.findMany({
    where: {
      storeId: storeId,
    },
    include: {
      orderItems: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return orders;
};
