import { describe, expect, it } from 'vitest';

import { getBulkChanges, getBulkTargetIndexes, getKeysWithValue } from '@/lib/variant-bulk-edit';

describe('getBulkChanges', () => {
  it('fills only the fields that were entered', () => {
    expect(getBulkChanges({ ...NO_INPUTS, stockCount: ' 5 ', salePrice: '12.5' })).toEqual({
      isValid: true,
      changes: { stockCount: 5, salePrice: '12.5' },
    });
  });

  it('asks for a value when every input is empty', () => {
    expect(getBulkChanges({ ...NO_INPUTS, price: ' ' })).toEqual({
      isValid: false,
      message: 'Įveskite bent vieną reikšmę, kurią norite pritaikyti',
    });
  });

  it.each(['-1', '2.5', 'abc'])('rejects Laisva "%s"', (stockCount) => {
    expect(getBulkChanges({ ...NO_INPUTS, stockCount })).toEqual({
      isValid: false,
      message: 'Reikalingas laisvas kiekis (sveikasis skaičius, ne mažesnis už 0)',
    });
  });

  it.each(['0', '-3', 'abc'])('rejects price "%s"', (price) => {
    expect(getBulkChanges({ ...NO_INPUTS, price })).toEqual({
      isValid: false,
      message: 'Reikalinga teigiama kaina',
    });
  });

  it('rejects a sale price that is not above 0', () => {
    expect(getBulkChanges({ ...NO_INPUTS, salePrice: '0' })).toEqual({
      isValid: false,
      message: 'Akcijos kaina turi būti didesnė už 0',
    });
  });

  it('clears the price and the sale price, so the rows use the product prices again', () => {
    expect(getBulkChanges({ ...NO_INPUTS, shouldClearPrice: true })).toEqual({
      isValid: true,
      changes: { price: null, salePrice: null },
    });
  });

  it('clears only the sale price', () => {
    expect(getBulkChanges({ ...NO_INPUTS, price: '20', shouldClearSalePrice: true })).toEqual({
      isValid: true,
      changes: { price: '20', salePrice: null },
    });
  });

  it('lets a clear win over a typed value of the same field', () => {
    expect(getBulkChanges({ ...NO_INPUTS, price: '20', shouldClearPrice: true })).toEqual({
      isValid: true,
      changes: { price: null, salePrice: null },
    });
  });

  it('rejects a sale price together with clearing the price', () => {
    expect(getBulkChanges({ ...NO_INPUTS, salePrice: '10', shouldClearPrice: true })).toEqual({
      isValid: false,
      message: 'Akcijos kainą galima nurodyti tik kartu su varianto kaina',
    });
  });
});

const NO_INPUTS = { stockCount: '', price: '', salePrice: '', shouldClearPrice: false, shouldClearSalePrice: false };

describe('getKeysWithValue', () => {
  it('returns exactly the rows that use the value', () => {
    const rows = [
      { key: 'a', optionValueIds: ['s', 'sage'], isArchived: false },
      { key: 'b', optionValueIds: ['s', 'oat'], isArchived: false },
      { key: 'c', optionValueIds: ['m', 'sage'], isArchived: false },
      { key: 'd', optionValueIds: ['m', 'oat'], isArchived: false },
    ];

    expect(getKeysWithValue({ rows, valueId: 'sage' })).toEqual(new Set(['a', 'c']));
    expect(getKeysWithValue({ rows, valueId: 'm' })).toEqual(new Set(['c', 'd']));
  });

  it('leaves out rows marked for archiving', () => {
    const rows = [
      { key: 'a', optionValueIds: ['s', 'sage'], isArchived: true },
      { key: 'b', optionValueIds: ['m', 'sage'], isArchived: false },
    ];

    expect(getKeysWithValue({ rows, valueId: 'sage' })).toEqual(new Set(['b']));
  });
});

describe('getBulkTargetIndexes', () => {
  it('targets every row when none is ticked', () => {
    expect(getBulkTargetIndexes({ rows: toRows(['a', 'b', 'c']), tickedKeys: new Set() })).toEqual([0, 1, 2]);
  });

  it('targets only the ticked rows when some are ticked', () => {
    expect(getBulkTargetIndexes({ rows: toRows(['a', 'b', 'c']), tickedKeys: new Set(['c', 'a']) })).toEqual([0, 2]);
  });

  it('ignores ticks of rows that were removed', () => {
    expect(getBulkTargetIndexes({ rows: toRows(['a', 'b']), tickedKeys: new Set(['gone', 'b']) })).toEqual([1]);
  });

  it('never targets rows marked for archiving, ticked or not', () => {
    const rows = [
      { key: 'a', isArchived: true },
      { key: 'b', isArchived: false },
      { key: 'c', isArchived: true },
    ];

    expect(getBulkTargetIndexes({ rows, tickedKeys: new Set() })).toEqual([1]);
    expect(getBulkTargetIndexes({ rows, tickedKeys: new Set(['a']) })).toEqual([1]);
  });
});

const toRows = (keys: string[]) => keys.map((key) => ({ key, isArchived: false }));
