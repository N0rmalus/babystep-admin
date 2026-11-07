import { z } from 'zod';
import {
  HEX_REQUIRED_MESSAGE,
  NAME_REQUIRED_MESSAGE,
  OPTION_DISPLAY_TYPES,
  SIZE_RANGES,
  VALUE_LABEL_REQUIRED_MESSAGE,
  getSizeRangeIssues,
  isValidHexColour,
  type SizeField,
  type SizeFields,
} from '@/lib/option-group';

const SIZE_NOT_A_NUMBER_MESSAGE = 'Įveskite skaičių';
const SIZE_FIELDS = SIZE_RANGES.flatMap(({ from, to }) => [from, to]);

const sizeTextSchema = z.string().trim();

export const optionGroupFormSchema = z
  .object({
    name: z.string().trim().min(1, NAME_REQUIRED_MESSAGE),
    displayType: z.enum(OPTION_DISPLAY_TYPES),
    // Comes from the group's role (Dydis); not editable in the form
    isSizeGroup: z.boolean(),
    values: z.array(
      z.object({
        valueId: z.string().optional(),
        label: z.string().trim().min(1, VALUE_LABEL_REQUIRED_MESSAGE),
        hex: z.string().trim(),
        variantCount: z.number(),
        ageFromMonths: sizeTextSchema,
        ageToMonths: sizeTextSchema,
        heightFromCm: sizeTextSchema,
        heightToCm: sizeTextSchema,
        weightFromKg: sizeTextSchema,
        weightToKg: sizeTextSchema,
      }),
    ),
  })
  .superRefine(({ displayType, isSizeGroup, values }, ctx) => {
    values.forEach((value, index) => {
      if (displayType === 'SWATCH' && !isValidHexColour(value.hex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['values', index, 'hex'],
          message: HEX_REQUIRED_MESSAGE,
        });
      }

      if (!isSizeGroup) {
        return;
      }

      const sizes = parseSizeTexts(value);
      const notANumberFields = SIZE_FIELDS.filter((field) => !isFiniteOrEmpty(sizes[field]));

      notANumberFields.forEach((field) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['values', index, field],
          message: SIZE_NOT_A_NUMBER_MESSAGE,
        });
      });

      if (notANumberFields.length > 0) {
        return;
      }

      getSizeRangeIssues(sizes).forEach(({ field, message }) => {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['values', index, field], message });
      });
    });
  });

export type OptionGroupFormValues = z.infer<typeof optionGroupFormSchema>;

// Empty text is null; a decimal comma is accepted. Unparseable text becomes NaN, which the schema rejects along with Infinity.
export const parseSizeTexts = (texts: Record<SizeField, string>): SizeFields => ({
  ageFromMonths: parseSizeText(texts.ageFromMonths),
  ageToMonths: parseSizeText(texts.ageToMonths),
  heightFromCm: parseSizeText(texts.heightFromCm),
  heightToCm: parseSizeText(texts.heightToCm),
  weightFromKg: parseSizeText(texts.weightFromKg),
  weightToKg: parseSizeText(texts.weightToKg),
});

export const toSizeText = (value: { toString: () => string } | null): string => value?.toString() ?? '';

const isFiniteOrEmpty = (value: number | null) => value === null || Number.isFinite(value);

const parseSizeText = (text: string) => {
  const trimmedText = text.trim();

  return trimmedText === '' ? null : Number(trimmedText.replace(',', '.'));
};
