import type { Prisma } from '@prisma/client';

export const HOLDING_STOCK_WHERE = {
  isPaid: false,
  stockReleasedAt: null,
} as const satisfies Prisma.OrderWhereInput;

type OrderStockHoldState = {
  isPaid: boolean;
  stockReleasedAt: Date | null;
};

export const isHoldingStock = ({ isPaid, stockReleasedAt }: OrderStockHoldState): boolean =>
  !isPaid && stockReleasedAt === null;
