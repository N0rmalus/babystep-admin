import 'server-only';

import type { Prisma } from '@prisma/client';

import prismadb from '@/lib/prismadb';

type ReservedLine = {
  variantId: string;
  quantity: number;
};

export class StockChangedError extends Error {
  constructor() {
    super('A guarded stock decrement found too little stock');
    this.name = 'StockChangedError';
  }
}

export const reserveStock = async ({
  tx,
  lines,
}: {
  tx: Prisma.TransactionClient;
  lines: ReservedLine[];
}): Promise<void> => {
  const linesInLockOrder = lines.toSorted((a, b) => a.variantId.localeCompare(b.variantId));

  for (const { variantId, quantity } of linesInLockOrder) {
    const { count } = await tx.productVariant.updateMany({
      where: { id: variantId, stockCount: { gte: quantity } },
      data: { stockCount: { decrement: quantity } },
    });

    if (count !== 1) {
      throw new StockChangedError();
    }
  }
};

type ReleaseReservationOptions = {
  orderId: string;
  tx?: Prisma.TransactionClient;
  now?: Date;
};

export const releaseReservation = ({ orderId, tx, now = new Date() }: ReleaseReservationOptions): Promise<boolean> => {
  if (tx) {
    return releaseInTransaction({ orderId, tx, now });
  }

  return prismadb.$transaction((transaction) => releaseInTransaction({ orderId, tx: transaction, now }));
};

const releaseInTransaction = async ({
  orderId,
  tx,
  now,
}: {
  orderId: string;
  tx: Prisma.TransactionClient;
  now: Date;
}) => {
  const { count } = await tx.order.updateMany({
    where: { id: orderId, stockReleasedAt: null, isPaid: false },
    data: { stockReleasedAt: now },
  });

  if (count !== 1) {
    return false;
  }

  const orderItems = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true } });

  for (const { variantId, quantity } of orderItems) {
    await tx.productVariant.update({ where: { id: variantId }, data: { stockCount: { increment: quantity } } });
  }

  return true;
};
