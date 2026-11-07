import type { OptionDisplayType, OptionGroupRole } from '@prisma/client';
import { z } from 'zod';

// Type-only Prisma import keeps this module usable in client forms
export const OPTION_DISPLAY_TYPES = ['CHIPS', 'SWATCH'] as const satisfies readonly OptionDisplayType[];
const HEX_COLOUR_PATTERN = /^#[0-9a-f]{6}$/i;
export const HEX_PLACEHOLDER = '#A3B18A';
const INVALID_INPUT_MESSAGE = 'Neteisingi duomenys';
export const NAME_REQUIRED_MESSAGE = 'Būtina nurodyti pavadinimą';
export const VALUE_LABEL_REQUIRED_MESSAGE = 'Kiekviena reikšmė turi turėti pavadinimą';
export const HEX_REQUIRED_MESSAGE = `Įveskite spalvos HEX kodą, pvz. ${HEX_PLACEHOLDER}`;
export const VALUE_NOT_FOUND_MESSAGE = 'Reikšmė šioje savybėje nerasta';
export const USED_VALUES_FALLBACK_MESSAGE =
  'Kai kurias reikšmes naudoja prekių variantai, todėl jų negalima ištrinti. Jas galima pervadinti.';
const CUSTOM_MESSAGES: readonly string[] = [NAME_REQUIRED_MESSAGE, VALUE_LABEL_REQUIRED_MESSAGE];

// Ranges a size-role group's values can carry (Dydis): age in months, height in cm, weight in kg
export const SIZE_RANGES = [
  { from: 'ageFromMonths', to: 'ageToMonths', title: 'Amžius (mėn.)', isInteger: true },
  { from: 'heightFromCm', to: 'heightToCm', title: 'Ūgis (cm)', isInteger: true },
  { from: 'weightFromKg', to: 'weightToKg', title: 'Svoris (kg)', isInteger: false },
] as const;

export type SizeField = (typeof SIZE_RANGES)[number]['from' | 'to'];
export type SizeFields = Record<SizeField, number | null>;

export const SIZE_NEGATIVE_MESSAGE = 'Skaičius negali būti neigiamas';
export const SIZE_NOT_INTEGER_MESSAGE = 'Įveskite sveikąjį skaičių';
export const SIZE_TOO_LARGE_MESSAGE = 'Skaičius per didelis';
// Postgres INT maximum (age and height columns); applied to weight too for one rule
const MAX_SIZE_VALUE = 2_147_483_647;
export const SIZE_RANGE_ORDER_MESSAGE = '„Nuo“ negali būti daugiau nei „iki“';

type SizeRangeIssue = { field: SizeField; title: string; message: string };

const sizeFieldSchema = z.number().finite().nullish();

const optionValueInputSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().trim().min(1, VALUE_LABEL_REQUIRED_MESSAGE),
  hex: z.string().trim().nullish(),
  ageFromMonths: sizeFieldSchema,
  ageToMonths: sizeFieldSchema,
  heightFromCm: sizeFieldSchema,
  heightToCm: sizeFieldSchema,
  weightFromKg: sizeFieldSchema,
  weightToKg: sizeFieldSchema,
});

const optionGroupInputSchema = z.object({
  name: z.string().trim().min(1, NAME_REQUIRED_MESSAGE),
  displayType: z.enum(OPTION_DISPLAY_TYPES),
  values: z.array(optionValueInputSchema),
});

export type OptionValueInput = SizeFields & {
  id?: string;
  label: string;
  hex: string | null;
};

export type OptionGroupInput = {
  name: string;
  displayType: OptionDisplayType;
  values: OptionValueInput[];
};

// Every end is optional; a set end must be non-negative (whole for months and cm), and from ≤ to when both are set.
export const getSizeRangeIssues = (sizes: SizeFields): SizeRangeIssue[] => {
  return SIZE_RANGES.flatMap(({ from, to, title, isInteger }) => {
    const endIssues = [from, to].flatMap((field) => {
      const value = sizes[field];

      if (value === null) {
        return [];
      }

      if (value < 0) {
        return [{ field, title, message: SIZE_NEGATIVE_MESSAGE }];
      }

      if (value > MAX_SIZE_VALUE) {
        return [{ field, title, message: SIZE_TOO_LARGE_MESSAGE }];
      }

      if (isInteger && !Number.isInteger(value)) {
        return [{ field, title, message: SIZE_NOT_INTEGER_MESSAGE }];
      }

      return [];
    });

    if (endIssues.length > 0) {
      return endIssues;
    }

    const fromValue = sizes[from];
    const toValue = sizes[to];

    if (fromValue !== null && toValue !== null && fromValue > toValue) {
      return [{ field: to, title, message: SIZE_RANGE_ORDER_MESSAGE }];
    }

    return [];
  });
};

type ParseResult = { isValid: true; group: OptionGroupInput } | { isValid: false; message: string };

export const isValidHexColour = (value: unknown): value is string => {
  return typeof value === 'string' && HEX_COLOUR_PATTERN.test(value);
};

export const getMissingHexMessage = (label: string) =>
  `Reikšmei „${label}“ reikia spalvos HEX kodo, pvz. ${HEX_PLACEHOLDER}`;

// Only the size-role group (recognised by role, not name) stores size ranges; other groups get nulls.
export const parseOptionGroupInput = (body: unknown, role: OptionGroupRole): ParseResult => {
  const parsed = optionGroupInputSchema.safeParse(body);

  if (!parsed.success) {
    return { isValid: false, message: getZodIssueMessage(parsed.error) };
  }

  const { name, displayType, values } = parsed.data;
  const duplicateValue = findDuplicateLabel(values);

  if (duplicateValue) {
    return { isValid: false, message: `Reikšmė „${duplicateValue.label}“ kartojasi` };
  }

  if (role === 'SIZE') {
    const sizeIssue = values
      .flatMap((value) => getSizeRangeIssues(pickSizeFields(value)).map((issue) => ({ ...issue, label: value.label })))
      .at(0);

    if (sizeIssue) {
      return {
        isValid: false,
        message: `Reikšmė „${sizeIssue.label}“, ${sizeIssue.title}: ${lowerFirstLetter(sizeIssue.message)}`,
      };
    }
  }

  if (displayType === 'SWATCH') {
    const valueWithoutHex = values.find((value) => !isValidHexColour(value.hex));

    if (valueWithoutHex) {
      return { isValid: false, message: getMissingHexMessage(valueWithoutHex.label) };
    }
  }

  return {
    isValid: true,
    group: {
      name,
      displayType,
      // Chips groups keep a valid hex so switching back to swatches doesn't lose colours
      values: values.map((value) => ({
        ...(value.id ? { id: value.id } : {}),
        label: value.label,
        hex: isValidHexColour(value.hex) ? value.hex.toLowerCase() : null,
        ...(role === 'SIZE' ? pickSizeFields(value) : EMPTY_SIZE_FIELDS),
      })),
    },
  };
};

type PlanOptions<TValue extends { id?: string }> = {
  existingValueIds: string[];
  values: TValue[];
};

type PositionedValue<TValue> = Omit<TValue, 'id'> & { position: number };

type PlanResult<TValue> =
  | {
      isValid: true;
      creates: PositionedValue<TValue>[];
      updates: (PositionedValue<TValue> & { id: string })[];
      deleteIds: string[];
    }
  | { isValid: false; message: string };

// Turns the submitted, ordered values into writes: the array order becomes each value's position.
export const planOptionValueChanges = <TValue extends { id?: string }>({
  existingValueIds,
  values,
}: PlanOptions<TValue>): PlanResult<TValue> => {
  const positionedValues = values.map((value, position) => ({ ...value, position }));
  const hasUnknownId = positionedValues.some((value) => value.id && !existingValueIds.includes(value.id));

  if (hasUnknownId) {
    return { isValid: false, message: VALUE_NOT_FOUND_MESSAGE };
  }

  const keptIds = new Set(positionedValues.flatMap((value) => (value.id ? [value.id] : [])));

  return {
    isValid: true,
    creates: positionedValues.flatMap(({ id, ...value }) => (id ? [] : [value])),
    updates: positionedValues.flatMap(({ id, ...value }) => (id ? [{ id, ...value }] : [])),
    deleteIds: existingValueIds.filter((id) => !keptIds.has(id)),
  };
};

// Store-level values that variants use can only be renamed (order snapshots keep the old text).
export const getUsedValuesMessage = (labels: string[]) => {
  const quotedLabels = labels.map((label) => `„${label}“`).join(', ');

  if (labels.length === 1) {
    return `Reikšmės ${quotedLabels} negalima ištrinti, nes ją naudoja prekių variantai. Ją galima pervadinti.`;
  }

  return `Reikšmių ${quotedLabels} negalima ištrinti, nes jas naudoja prekių variantai. Jas galima pervadinti.`;
};

const EMPTY_SIZE_FIELDS: SizeFields = {
  ageFromMonths: null,
  ageToMonths: null,
  heightFromCm: null,
  heightToCm: null,
  weightFromKg: null,
  weightToKg: null,
};

export const pickSizeFields = (value: Partial<Record<SizeField, number | null>>): SizeFields => ({
  ageFromMonths: value.ageFromMonths ?? null,
  ageToMonths: value.ageToMonths ?? null,
  heightFromCm: value.heightFromCm ?? null,
  heightToCm: value.heightToCm ?? null,
  weightFromKg: value.weightFromKg ?? null,
  weightToKg: value.weightToKg ?? null,
});

const lowerFirstLetter = (text: string) => text.replace(/\p{L}/u, (letter) => letter.toLocaleLowerCase('lt'));

const getZodIssueMessage = (error: z.ZodError) => {
  const message = error.issues.at(0)?.message;

  return message && CUSTOM_MESSAGES.includes(message) ? message : INVALID_INPUT_MESSAGE;
};

const findDuplicateLabel = <TValue extends { label: string }>(values: TValue[]) => {
  const seenLabels = new Set<string>();

  return values.find((value) => {
    const key = value.label.toLocaleLowerCase('lt');

    if (seenLabels.has(key)) {
      return true;
    }

    seenLabels.add(key);

    return false;
  });
};
