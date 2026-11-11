import type { Prisma } from '@prisma/client';

export const HOLDING_STOCK_WHERE = {
  isPaid: false,
  stockReleasedAt: null,
} as const satisfies Prisma.OrderWhereInput;

type PreviousAttemptWhereOptions = {
  storeId: string;
  email: string;
};

// A retry may only release an earlier attempt from the same store and the same customer, so a leaked order ID
// can't be used to cancel someone else's reservation.
export const getPreviousAttemptWhere = ({ storeId, email }: PreviousAttemptWhereOptions) =>
  ({
    storeId,
    email: { equals: email, mode: 'insensitive' },
  }) satisfies Prisma.OrderWhereInput;

type OrderStockHoldState = {
  isPaid: boolean;
  stockReleasedAt: Date | null;
};

export const isHoldingStock = ({ isPaid, stockReleasedAt }: OrderStockHoldState): boolean =>
  !isPaid && stockReleasedAt === null;
