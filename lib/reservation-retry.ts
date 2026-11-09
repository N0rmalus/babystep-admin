type ReservationAttempt<TOrder> = { status: 'reserved'; order: TOrder } | { status: 'short' };

type ReserveWithRetryOptions<TOrder, TShortage> = {
  reserve: () => Promise<ReservationAttempt<TOrder>>;
  getShortages: () => Promise<TShortage[]>;
};

export type ReservationResult<TOrder, TShortage> =
  | { status: 'reserved'; order: TOrder }
  | { status: 'stock-changed'; items: TShortage[] };

export const reserveWithRetry = async <TOrder, TShortage>({
  reserve,
  getShortages,
}: ReserveWithRetryOptions<TOrder, TShortage>): Promise<ReservationResult<TOrder, TShortage>> => {
  const attempt = await reserve();

  if (attempt.status === 'reserved') {
    return attempt;
  }

  const shortages = await getShortages();

  if (shortages.length > 0) {
    return { status: 'stock-changed', items: shortages };
  }

  const retry = await reserve();

  if (retry.status === 'reserved') {
    return retry;
  }

  const retryShortages = await getShortages();

  if (retryShortages.length === 0) {
    throw new Error('Reservation failed twice without a stock shortage');
  }

  return { status: 'stock-changed', items: retryShortages };
};
