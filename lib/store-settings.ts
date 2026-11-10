export const NEXT_ORDER_NUMBER_INVALID_MESSAGE = 'Kitas užsakymo numeris turi būti teigiamas sveikasis skaičius.';

const getNextOrderNumberTooLowMessage = (highestOrderNumber: number) =>
  `Kitas užsakymo numeris turi būti didesnis nei ${highestOrderNumber}.`;

type NextOrderNumberOptions = {
  nextOrderNumber: number;
  highestOrderNumber: number | null;
};

export const getNextOrderNumberMessage = ({
  nextOrderNumber,
  highestOrderNumber,
}: NextOrderNumberOptions): string | null => {
  if (!Number.isInteger(nextOrderNumber) || nextOrderNumber < 1) {
    return NEXT_ORDER_NUMBER_INVALID_MESSAGE;
  }

  if (highestOrderNumber !== null && nextOrderNumber <= highestOrderNumber) {
    return getNextOrderNumberTooLowMessage(highestOrderNumber);
  }

  return null;
};
