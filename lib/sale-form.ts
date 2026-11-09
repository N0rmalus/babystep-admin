const MS_PER_MINUTE = 60_000;
const DATE_TIME_LOCAL_LENGTH = 16;

export const formatDateTimeLocalValue = (value?: string | Date | null): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * MS_PER_MINUTE);

  return localDate.toISOString().slice(0, DATE_TIME_LOCAL_LENGTH);
};

type EndedSaleWindowOptions = {
  saleStartsAt: string | null | undefined;
  now: Date;
};

export const getEndedSaleWindow = ({ saleStartsAt, now }: EndedSaleWindowOptions) => {
  const saleEndsAt = formatDateTimeLocalValue(now);
  const startsAt = saleStartsAt ? new Date(saleStartsAt) : null;
  const hasFutureStart = startsAt !== null && startsAt.getTime() > now.getTime();

  return {
    saleStartsAt: hasFutureStart ? saleEndsAt : saleStartsAt || null,
    saleEndsAt,
  };
};
