import { describe, expect, it } from 'vitest';

import {
  getUsedValuesMessage,
  parseOptionGroupInput,
  parseSizeValueInput,
  planOptionValueChanges,
  VALUE_LABEL_REQUIRED_MESSAGE,
} from '@/lib/option-group';

const EMPTY_SIZES = {
  ageFromMonths: null,
  ageToMonths: null,
  heightFromCm: null,
  heightToCm: null,
  weightFromKg: null,
  weightToKg: null,
};

describe('parseOptionGroupInput', () => {
  it('accepts a chips group and trims its name and value labels', () => {
    const result = parseOptionGroupInput(
      {
        name: '  Dydis ',
        displayType: 'CHIPS',
        values: [{ label: ' 0–6 mėn. ' }, { id: 'value-1', label: 'S' }],
      },
      'NONE',
    );

    expect(result).toEqual({
      isValid: true,
      group: {
        name: 'Dydis',
        displayType: 'CHIPS',
        values: [
          { label: '0–6 mėn.', hex: null, ...EMPTY_SIZES },
          { id: 'value-1', label: 'S', hex: null, ...EMPTY_SIZES },
        ],
      },
    });
  });

  it('rejects a group without a name', () => {
    expect(parseOptionGroupInput({ name: '  ', displayType: 'CHIPS', values: [] }, 'NONE')).toEqual({
      isValid: false,
      message: 'Būtina nurodyti pavadinimą',
    });
  });

  it('rejects a value without a label', () => {
    expect(parseOptionGroupInput({ name: 'Dydis', displayType: 'CHIPS', values: [{ label: ' ' }] }, 'NONE')).toEqual({
      isValid: false,
      message: 'Kiekviena reikšmė turi turėti pavadinimą',
    });
  });

  it('rejects two values with the same label, ignoring case', () => {
    const result = parseOptionGroupInput(
      {
        name: 'Dydis',
        displayType: 'CHIPS',
        values: [{ label: 'S' }, { label: 's ' }],
      },
      'NONE',
    );

    expect(result).toEqual({ isValid: false, message: 'Reikšmė „s“ kartojasi' });
  });

  it('requires a valid hex colour on every value of a swatch group', () => {
    const result = parseOptionGroupInput(
      {
        name: 'Spalva',
        displayType: 'SWATCH',
        values: [
          { label: 'Šalavijų', hex: '#A3B18A' },
          { label: 'Pilka', hex: 'pilka' },
        ],
      },
      'NONE',
    );

    expect(result).toEqual({ isValid: false, message: 'Reikšmei „Pilka“ reikia spalvos HEX kodo, pvz. #A3B18A' });
  });

  it('accepts a swatch group whose values all have hex colours, stored in lower case', () => {
    const result = parseOptionGroupInput(
      {
        name: 'Spalva',
        displayType: 'SWATCH',
        values: [{ label: 'Šalavijų', hex: '#A3B18A' }],
      },
      'NONE',
    );

    expect(result).toEqual({
      isValid: true,
      group: { name: 'Spalva', displayType: 'SWATCH', values: [{ label: 'Šalavijų', hex: '#a3b18a', ...EMPTY_SIZES }] },
    });
  });
});

describe('parseOptionGroupInput for the size-role group', () => {
  it('keeps the age, height and weight ranges of size values, whatever the group is called', () => {
    const result = parseOptionGroupInput(
      {
        name: 'Dydžiai',
        displayType: 'CHIPS',
        values: [
          {
            label: '0–6 mėn.',
            ageFromMonths: 0,
            ageToMonths: 6,
            heightFromCm: 56,
            heightToCm: 68,
            weightFromKg: 3.5,
            weightToKg: 8,
          },
          { label: 'S' },
        ],
      },
      'SIZE',
    );

    expect(result).toEqual({
      isValid: true,
      group: {
        name: 'Dydžiai',
        displayType: 'CHIPS',
        values: [
          {
            label: '0–6 mėn.',
            hex: null,
            ageFromMonths: 0,
            ageToMonths: 6,
            heightFromCm: 56,
            heightToCm: 68,
            weightFromKg: 3.5,
            weightToKg: 8,
          },
          {
            label: 'S',
            hex: null,
            ageFromMonths: null,
            ageToMonths: null,
            heightFromCm: null,
            heightToCm: null,
            weightFromKg: null,
            weightToKg: null,
          },
        ],
      },
    });
  });
});

describe('size range validation', () => {
  const parseSizeValue = (sizes: Record<string, unknown>) =>
    parseOptionGroupInput({ name: 'Dydis', displayType: 'CHIPS', values: [{ label: 'S', ...sizes }] }, 'SIZE');

  it('rejects a range whose start is above its end', () => {
    expect(parseSizeValue({ heightFromCm: 80, heightToCm: 68 })).toEqual({
      isValid: false,
      message: 'Reikšmė „S“, Ūgis (cm): „nuo“ negali būti daugiau nei „iki“',
    });
  });

  it('rejects negative values', () => {
    expect(parseSizeValue({ weightFromKg: -1 })).toEqual({
      isValid: false,
      message: 'Reikšmė „S“, Svoris (kg): skaičius negali būti neigiamas',
    });
  });

  it('rejects fractional months and centimetres but allows fractional kilograms', () => {
    expect(parseSizeValue({ ageToMonths: 6.5 })).toEqual({
      isValid: false,
      message: 'Reikšmė „S“, Amžius (mėn.): įveskite sveikąjį skaičių',
    });
    expect(parseSizeValue({ weightFromKg: 3.5, weightToKg: 3.5 })).toMatchObject({ isValid: true });
  });

  it('rejects numbers too large to store', () => {
    expect(parseSizeValue({ heightToCm: 3_000_000_000 })).toEqual({
      isValid: false,
      message: 'Reikšmė „S“, Ūgis (cm): skaičius per didelis',
    });
  });

  it('accepts a range with only one end set', () => {
    expect(parseSizeValue({ ageFromMonths: 24 })).toMatchObject({ isValid: true });
  });

  it('ignores invalid ranges submitted for a group without the size role', () => {
    const result = parseOptionGroupInput(
      { name: 'Spalva', displayType: 'CHIPS', values: [{ label: 'Pilka', heightFromCm: 80, heightToCm: 68 }] },
      'NONE',
    );

    expect(result).toMatchObject({ isValid: true });
  });
});

describe('parseOptionGroupInput for other groups', () => {
  it('does not store size ranges on values of a group without the size role', () => {
    const result = parseOptionGroupInput(
      {
        name: 'Spalva',
        displayType: 'CHIPS',
        values: [{ label: 'Pilka', ageFromMonths: 0, ageToMonths: 6, heightFromCm: 56, weightToKg: 8 }],
      },
      'NONE',
    );

    expect(result).toEqual({
      isValid: true,
      group: { name: 'Spalva', displayType: 'CHIPS', values: [{ label: 'Pilka', hex: null, ...EMPTY_SIZES }] },
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

describe('parseSizeValueInput', () => {
  it('trims the new size label', () => {
    expect(parseSizeValueInput({ label: ' 6–9 mėn. ' }, ['0–3 mėn.'])).toEqual({ isValid: true, label: '6–9 mėn.' });
  });

  it('requires a label', () => {
    expect(parseSizeValueInput({ label: '  ' }, [])).toEqual({ isValid: false, message: VALUE_LABEL_REQUIRED_MESSAGE });
    expect(parseSizeValueInput({}, [])).toEqual({ isValid: false, message: VALUE_LABEL_REQUIRED_MESSAGE });
  });

  it('rejects a size the group already has, ignoring case', () => {
    expect(parseSizeValueInput({ label: 's' }, ['S', 'M'])).toEqual({
      isValid: false,
      message: 'Reikšmė „s“ kartojasi',
    });
  });
});
