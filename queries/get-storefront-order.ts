import 'server-only';

import prismadb from '@/lib/prismadb';
import { STOREFRONT_ORDER_SELECT } from '@/lib/storefront-order';

type GetStorefrontOrderOptions = {
  storeId: string;
  orderId: string;
};

export const getStorefrontOrder = ({ storeId, orderId }: GetStorefrontOrderOptions) =>
  prismadb.order.findFirst({ where: { id: orderId, storeId }, select: STOREFRONT_ORDER_SELECT });
