import { describe, expect, it } from 'vitest';

import { getUsedValuesMessage, parseOptionGroupInput, planOptionValueChanges } from '@/lib/option-group';

describe('parseOptionGroupInput', () => {
  it('accepts a chips group and trims its name and value labels', () => {
    const result = parseOptionGroupInput({
      name: '  Dydis ',
      displayType: 'CHIPS',
      values: [{ label: ' 0–6 mėn. ' }, { id: 'value-1', label: 'S' }],
    });

    expect(result).toEqual({
      isValid: true,
      group: {
        name: 'Dydis',
        displayType: 'CHIPS',
        values: [
          { label: '0–6 mėn.', hex: null },
          { id: 'value-1', label: 'S', hex: null },
        ],
      },
    });
  });

  it('rejects a group without a name', () => {
    expect(parseOptionGroupInput({ name: '  ', displayType: 'CHIPS', values: [] })).toEqual({
      isValid: false,
      message: 'Būtina nurodyti pavadinimą',
    });
  });

  it('rejects a value without a label', () => {
    expect(parseOptionGroupInput({ name: 'Dydis', displayType: 'CHIPS', values: [{ label: ' ' }] })).toEqual({
      isValid: false,
      message: 'Kiekviena reikšmė turi turėti pavadinimą',
    });
  });

  it('rejects two values with the same label, ignoring case', () => {
    const result = parseOptionGroupInput({
      name: 'Dydis',
      displayType: 'CHIPS',
      values: [{ label: 'S' }, { label: 's ' }],
    });

    expect(result).toEqual({ isValid: false, message: 'Reikšmė „s“ kartojasi' });
  });

  it('requires a valid hex colour on every value of a swatch group', () => {
    const result = parseOptionGroupInput({
      name: 'Spalva',
      displayType: 'SWATCH',
      values: [
        { label: 'Šalavijų', hex: '#A3B18A' },
        { label: 'Pilka', hex: 'pilka' },
      ],
    });

    expect(result).toEqual({ isValid: false, message: 'Reikšmei „Pilka“ reikia spalvos HEX kodo, pvz. #A3B18A' });
  });

  it('accepts a swatch group whose values all have hex colours, stored in lower case', () => {
    const result = parseOptionGroupInput({
      name: 'Spalva',
      displayType: 'SWATCH',
      values: [{ label: 'Šalavijų', hex: '#A3B18A' }],
    });

    expect(result).toEqual({
      isValid: true,
      group: { name: 'Spalva', displayType: 'SWATCH', values: [{ label: 'Šalavijų', hex: '#a3b18a' }] },
    });
  });
});

describe('planOptionValueChanges', () => {
  it('keeps submitted order as positions, creates new values and deletes the left-out ones', () => {
    const plan = planOptionValueChanges({
      existingValueIds: ['value-a', 'value-b', 'value-c'],
      values: [
        { id: 'value-c', label: 'L', hex: null },
        { label: 'M', hex: null },
        { id: 'value-a', label: 'XS', hex: '#ffffff' },
      ],
    });

    expect(plan).toEqual({
      isValid: true,
      creates: [{ label: 'M', hex: null, position: 1 }],
      updates: [
        { id: 'value-c', label: 'L', hex: null, position: 0 },
        { id: 'value-a', label: 'XS', hex: '#ffffff', position: 2 },
      ],
      deleteIds: ['value-b'],
    });
  });

  it('rejects a value id that does not belong to the group', () => {
    const plan = planOptionValueChanges({
      existingValueIds: ['value-a'],
      values: [{ id: 'other-group-value', label: 'S', hex: null }],
    });

    expect(plan).toEqual({ isValid: false, message: 'Reikšmė šioje savybėje nerasta' });
  });
});

describe('getUsedValuesMessage', () => {
  it('names the values that variants use and suggests renaming', () => {
    expect(getUsedValuesMessage(['S'])).toBe(
      'Reikšmės „S“ negalima ištrinti, nes ją naudoja prekių variantai. Ją galima pervadinti.',
    );
    expect(getUsedValuesMessage(['S', 'M'])).toBe(
      'Reikšmių „S“, „M“ negalima ištrinti, nes jas naudoja prekių variantai. Jas galima pervadinti.',
    );
  });
});
