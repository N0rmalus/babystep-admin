import 'server-only';

import * as Sentry from '@sentry/nextjs';
import type { Prisma, ReviewReason } from '@prisma/client';

import prismadb from '@/lib/prismadb';

type FlagOrderForReviewOptions = {
  orderId: string;
  reason: ReviewReason;
  tx?: Prisma.TransactionClient;
};

export const flagOrderForReview = async ({
  orderId,
  reason,
  tx = prismadb,
}: FlagOrderForReviewOptions): Promise<void> => {
  await tx.order.update({ where: { id: orderId }, data: { needsReview: true, reviewReason: reason } });
  Sentry.captureMessage('Order flagged for review', { level: 'warning', extra: { orderId, reason } });
};

type ResolveOrderReviewOptions = {
  storeId: string;
  orderId: string;
};

export const resolveOrderReview = async ({ storeId, orderId }: ResolveOrderReviewOptions): Promise<boolean> => {
  const { count } = await prismadb.order.updateMany({ where: { id: orderId, storeId }, data: { needsReview: false } });

  return count > 0;
};
