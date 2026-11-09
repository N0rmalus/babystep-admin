import 'server-only';

import prismadb from '@/lib/prismadb';

export const getWebhookOrder = async (orderId: string) => {
  const order = await prismadb.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      isPaid: true,
      paymentStatus: true,
      stockReleasedAt: true,
      montonioOrderUuid: true,
      total: true,
    },
  });

  return order ? { ...order, total: order.total.toNumber() } : null;
};
