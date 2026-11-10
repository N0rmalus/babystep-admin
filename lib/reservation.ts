import 'server-only';

import * as Sentry from '@sentry/nextjs';
import type { Prisma } from '@prisma/client';

import prismadb from '@/lib/prismadb';
import { releaseOrderBatch } from '@/lib/release-order-batch';
import { getReleaseCutoff } from '@/lib/reservation-config';
import { getExpiredReservationOrderIds } from '@/queries/get-expired-reservation-order-ids';

const RELEASE_BATCH_SIZE = 50;

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

const RELEASE_LOG_TAG = '[RELEASE_EXPIRED_ORDERS]';

export const releaseExpiredOrders = (now = new Date()): Promise<number> =>
  releaseOrderBatch({
    findOrderIds: () => getExpiredReservationOrderIds({ cutoff: getReleaseCutoff(now), limit: RELEASE_BATCH_SIZE }),
    release: (orderId) => releaseReservation({ orderId, now }),
    onReleaseError: reportReleaseError,
  });

type ReleaseExpiredOrdersHoldingOptions = {
  variantIds: string[];
  now?: Date;
};

export const releaseExpiredOrdersHolding = ({
  variantIds,
  now = new Date(),
}: ReleaseExpiredOrdersHoldingOptions): Promise<number> =>
  releaseOrderBatch({
    findOrderIds: () =>
      getExpiredReservationOrderIds({ cutoff: getReleaseCutoff(now), limit: RELEASE_BATCH_SIZE, variantIds }),
    release: (orderId) => releaseReservation({ orderId, now }),
    onReleaseError: reportReleaseError,
    onLookupError: (error) => {
      Sentry.captureException(error, { extra: { variantIds } });
      console.log(RELEASE_LOG_TAG, 'lookup', error);
    },
  });

const reportReleaseError = (error: unknown, orderId: string) => {
  Sentry.captureException(error, { extra: { orderId } });
  console.log(RELEASE_LOG_TAG, orderId, error);
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
