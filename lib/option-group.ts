import type { OptionDisplayType } from '@prisma/client';
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

const optionValueInputSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().trim().min(1, VALUE_LABEL_REQUIRED_MESSAGE),
  hex: z.string().trim().nullish(),
});

const optionGroupInputSchema = z.object({
  name: z.string().trim().min(1, NAME_REQUIRED_MESSAGE),
  displayType: z.enum(OPTION_DISPLAY_TYPES),
  values: z.array(optionValueInputSchema),
});

export type OptionValueInput = {
  id?: string;
  label: string;
  hex: string | null;
};

export type OptionGroupInput = {
  name: string;
  displayType: OptionDisplayType;
  values: OptionValueInput[];
};

type ParseResult = { isValid: true; group: OptionGroupInput } | { isValid: false; message: string };

export const isValidHexColour = (value: unknown): value is string => {
  return typeof value === 'string' && HEX_COLOUR_PATTERN.test(value);
};

export const getMissingHexMessage = (label: string) =>
  `Reikšmei „${label}“ reikia spalvos HEX kodo, pvz. ${HEX_PLACEHOLDER}`;

export const parseOptionGroupInput = (body: unknown): ParseResult => {
  const parsed = optionGroupInputSchema.safeParse(body);

  if (!parsed.success) {
    return { isValid: false, message: getZodIssueMessage(parsed.error) };
  }

  const { name, displayType, values } = parsed.data;
  const duplicateValue = findDuplicateLabel(values);

  if (duplicateValue) {
    return { isValid: false, message: `Reikšmė „${duplicateValue.label}“ kartojasi` };
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
      values: values.map(({ id, label, hex }) => ({
        ...(id ? { id } : {}),
        label,
        hex: isValidHexColour(hex) ? hex.toLowerCase() : null,
      })),
    },
  };
};

type PositionedValue = { label: string; hex: string | null; position: number };

type PlanOptions = {
  existingValueIds: string[];
  values: OptionValueInput[];
};

type PlanResult =
  | {
      isValid: true;
      creates: PositionedValue[];
      updates: (PositionedValue & { id: string })[];
      deleteIds: string[];
    }
  | { isValid: false; message: string };

// Turns the submitted, ordered values into writes: the array order becomes each value's position.
export const planOptionValueChanges = ({ existingValueIds, values }: PlanOptions): PlanResult => {
  const positionedValues = values.map((value, position) => ({ ...value, position }));
  const hasUnknownId = positionedValues.some((value) => value.id && !existingValueIds.includes(value.id));

  if (hasUnknownId) {
    return { isValid: false, message: VALUE_NOT_FOUND_MESSAGE };
  }

  const keptIds = new Set(positionedValues.flatMap((value) => (value.id ? [value.id] : [])));

  return {
    isValid: true,
    creates: positionedValues.flatMap(({ id, label, hex, position }) => (id ? [] : [{ label, hex, position }])),
    updates: positionedValues.flatMap(({ id, label, hex, position }) => (id ? [{ id, label, hex, position }] : [])),
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
