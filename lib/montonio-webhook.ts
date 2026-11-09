import 'server-only';

import * as Sentry from '@sentry/nextjs';
import type { Prisma } from '@prisma/client';

import type { WebhookAction } from '@/lib/checkout-rules';
import { flagOrderForReview } from '@/lib/order-review';
import prismadb from '@/lib/prismadb';
import { releaseReservation } from '@/lib/reservation';

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
      Sentry.captureMessage('Montonio PAID arrived after the stock was released', {
        level: 'warning',
        extra: { orderId },
      });
      return;
    case 'mark-paid':
      await updateGuarded({
        tx: prismadb,
        where: { id: orderId, isPaid: false, stockReleasedAt: null },
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
