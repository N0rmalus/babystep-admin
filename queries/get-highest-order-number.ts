import 'server-only';

import type { Prisma } from '@prisma/client';

import prismadb from '@/lib/prismadb';

export const getHighestOrderNumber = async (
  storeId: string,
  tx: Prisma.TransactionClient = prismadb,
): Promise<number | null> => {
  const { _max } = await tx.order.aggregate({ where: { storeId }, _max: { number: true } });

  return _max.number;
};
