import 'server-only';

import type { SyncOrder } from '@/lib/montonio-order-sync';
import prismadb from '@/lib/prismadb';

type GetWebhookOrderOptions = {
  orderId: string;
  storeId?: string;
};

export const getWebhookOrder = async ({ orderId, storeId }: GetWebhookOrderOptions): Promise<SyncOrder | null> => {
  const order = await prismadb.order.findFirst({
    where: { id: orderId, ...(storeId ? { storeId } : {}) },
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
