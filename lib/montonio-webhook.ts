import 'server-only';

import type { Prisma } from '@prisma/client';

import { getLatePaymentTransition, type LatePaymentTransition, type WebhookAction } from '@/lib/checkout-rules';
import { flagOrderForReview } from '@/lib/order-review';
import { HOLDING_STOCK_WHERE } from '@/lib/order-stock-hold';
import prismadb from '@/lib/prismadb';
import { releaseReservation, reserveStock, StockChangedError } from '@/lib/reservation';

type ApplyWebhookActionOptions = {
  order: { id: string; isPaid: boolean };
  action: WebhookAction;
  now?: Date;
};

export class OrderChangedError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} changed while a Montonio webhook was applied`);
    this.name = 'OrderChangedError';
  }
}

export const applyWebhookAction = async ({
  order,
  action,
  now = new Date(),
}: ApplyWebhookActionOptions): Promise<void> => {
  const { id: orderId } = order;

  switch (action.type) {
    case 'none':
      return;
    case 'late-payment':
      await applyLatePayment({ orderId, now });
      return;
    case 'mark-paid':
      await updateGuarded({
        tx: prismadb,
        where: { id: orderId, ...HOLDING_STOCK_WHERE },
        data: { isPaid: true, paymentStatus: 'PAID', paidAt: now },
      });
      return;
    case 'abandon':
      await prismadb.$transaction(async (tx) => {
        await updateGuarded({ tx, where: { id: orderId, isPaid: false }, data: { paymentStatus: 'ABANDONED' } });
        await releaseReservation({ orderId, tx, now });
      });
      return;
    case 'flag-voided':
      await prismadb.$transaction(async (tx) => {
        await updateGuarded({ tx, where: { id: orderId, isPaid: true }, data: { paymentStatus: 'VOIDED' } });
        await flagOrderForReview({ orderId, reason: 'VOIDED_AFTER_PAID', tx });
      });
      return;
    case 'mirror':
      await updateGuarded({
        tx: prismadb,
        where: { id: orderId, isPaid: order.isPaid },
        data: { paymentStatus: action.paymentStatus },
      });
      return;
  }
};

const applyLatePayment = async ({ orderId, now }: { orderId: string; now: Date }) => {
  try {
    await prismadb.$transaction(async (tx) => {
      await applyLatePaymentTransition({
        tx,
        orderId,
        transition: getLatePaymentTransition({ isStockReserved: true, now }),
      });
      const lines = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true, quantity: true } });
      await reserveStock({ tx, lines });
    });
  } catch (error) {
    if (!(error instanceof StockChangedError)) {
      throw error;
    }

    await prismadb.$transaction((tx) =>
      applyLatePaymentTransition({
        tx,
        orderId,
        transition: getLatePaymentTransition({ isStockReserved: false, now }),
      }),
    );
  }
};

const applyLatePaymentTransition = async ({
  tx,
  orderId,
  transition,
}: {
  tx: Prisma.TransactionClient;
  orderId: string;
  transition: LatePaymentTransition;
}) => {
  await updateGuarded({
    tx,
    where: { id: orderId, isPaid: false, stockReleasedAt: { not: null } },
    data: transition.data,
  });

  if (transition.type === 'paid-flagged') {
    await flagOrderForReview({ orderId, reason: transition.reviewReason, tx });
  }
};

const updateGuarded = async ({
  tx,
  where,
  data,
}: {
  tx: Prisma.TransactionClient;
  where: Prisma.OrderWhereInput & { id: string };
  data: Prisma.OrderUpdateManyMutationInput;
}) => {
  const { count } = await tx.order.updateMany({ where, data });

  if (count !== 1) {
    throw new OrderChangedError(where.id);
  }
};
