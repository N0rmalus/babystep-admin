import { describe, expect, it } from 'vitest';

import { getBulkChanges, getBulkTargetIndexes, getKeysWithValue } from '@/lib/variant-bulk-edit';

describe('getBulkChanges', () => {
  it('fills only the fields that were entered', () => {
    expect(getBulkChanges({ stockCount: ' 5 ', price: '', salePrice: '12.5' })).toEqual({
      isValid: true,
      changes: { stockCount: 5, salePrice: '12.5' },
    });
  });

  it('asks for a value when every input is empty', () => {
    expect(getBulkChanges({ stockCount: '', price: ' ', salePrice: '' })).toEqual({
      isValid: false,
      message: 'Įveskite bent vieną reikšmę, kurią norite pritaikyti',
    });
  });

  it.each(['-1', '2.5', 'abc'])('rejects Laisva "%s"', (stockCount) => {
    expect(getBulkChanges({ stockCount, price: '', salePrice: '' })).toEqual({
      isValid: false,
      message: 'Reikalingas laisvas kiekis (sveikasis skaičius, ne mažesnis už 0)',
    });
  });

  it.each(['0', '-3', 'abc'])('rejects price "%s"', (price) => {
    expect(getBulkChanges({ stockCount: '', price, salePrice: '' })).toEqual({
      isValid: false,
      message: 'Reikalinga teigiama kaina',
    });
  });

  it('rejects a sale price that is not above 0', () => {
    expect(getBulkChanges({ stockCount: '', price: '', salePrice: '0' })).toEqual({
      isValid: false,
      message: 'Akcijos kaina turi būti didesnė už 0',
    });
  });
});

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
