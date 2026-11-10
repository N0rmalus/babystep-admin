export type ReservedCounts = Record<string, number>;

type VariantTotalStockOptions = {
  stockCount: string | number | null | undefined;
  reservedCount: number;
};

export const getVariantTotalStock = ({ stockCount, reservedCount }: VariantTotalStockOptions): number | null => {
  if (stockCount === null || stockCount === undefined || String(stockCount).trim().length === 0) {
    return null;
  }

  const availableCount = Number(stockCount);

  if (!Number.isInteger(availableCount) || availableCount < 0) {
    return null;
  }

  return availableCount + reservedCount;
};
