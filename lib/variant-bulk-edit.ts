import { INVALID_STOCK_COUNT_MESSAGE, isValidStockCount } from '@/lib/product-variant';

const EMPTY_BULK_EDIT_MESSAGE = 'Įveskite bent vieną reikšmę, kurią norite pritaikyti';
// Same wording as the product price rules (lib/product-pricing.ts)
const INVALID_PRICE_MESSAGE = 'Reikalinga teigiama kaina';
const INVALID_SALE_PRICE_MESSAGE = 'Akcijos kaina turi būti didesnė už 0';

// The "Taikyti visiems" inputs as typed; an empty input leaves that field alone
type BulkInputs = {
  stockCount: string;
  price: string;
  salePrice: string;
};

export type BulkChanges = {
  stockCount?: number;
  price?: string;
  salePrice?: string;
};

type BulkChangesResult = { isValid: true; changes: BulkChanges } | { isValid: false; message: string };

// Each value is checked alone; how a price pairs with a row's sale price is checked by the form on Save
export const getBulkChanges = (inputs: BulkInputs): BulkChangesResult => {
  const stockCount = inputs.stockCount.trim();
  const price = inputs.price.trim();
  const salePrice = inputs.salePrice.trim();

  if (!stockCount && !price && !salePrice) {
    return { isValid: false, message: EMPTY_BULK_EDIT_MESSAGE };
  }

  if (stockCount && !isValidStockCount(Number(stockCount))) {
    return { isValid: false, message: INVALID_STOCK_COUNT_MESSAGE };
  }

  if (price && !isPositiveNumber(price)) {
    return { isValid: false, message: INVALID_PRICE_MESSAGE };
  }

  if (salePrice && !isPositiveNumber(salePrice)) {
    return { isValid: false, message: INVALID_SALE_PRICE_MESSAGE };
  }

  return {
    isValid: true,
    changes: {
      ...(stockCount ? { stockCount: Number(stockCount) } : {}),
      ...(price ? { price } : {}),
      ...(salePrice ? { salePrice } : {}),
    },
  };
};

// A variant table row, by its field key; rows marked for archiving are never ticked or bulk-edited
type TableRow = {
  key: string;
  isArchived: boolean;
};

type KeysWithValueOptions = {
  rows: (TableRow & { optionValueIds: string[] })[];
  valueId: string;
};

type BulkTargetOptions = {
  // In row order
  rows: TableRow[];
  tickedKeys: ReadonlySet<string>;
};

// Quick selection by value (e.g. "Spalva: Šalavijų"): the rows to tick, replacing the current ticks
export const getKeysWithValue = ({ rows, valueId }: KeysWithValueOptions): Set<string> => {
  return new Set(
    rows.flatMap(({ key, optionValueIds, isArchived }) =>
      !isArchived && optionValueIds.includes(valueId) ? [key] : [],
    ),
  );
};

// "Taikyti visiems" applies to the ticked rows, or to every row when none is ticked
export const getBulkTargetIndexes = ({ rows, tickedKeys }: BulkTargetOptions): number[] => {
  const activeIndexes = rows.flatMap(({ isArchived }, index) => (isArchived ? [] : [index]));
  const tickedIndexes = activeIndexes.filter((index) => tickedKeys.has(rows[index].key));

  return tickedIndexes.length > 0 ? tickedIndexes : activeIndexes;
};

const isPositiveNumber = (value: string) => {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0;
};
