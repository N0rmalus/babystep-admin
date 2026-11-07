import { z } from 'zod';
import {
  HEX_REQUIRED_MESSAGE,
  NAME_REQUIRED_MESSAGE,
  OPTION_DISPLAY_TYPES,
  VALUE_LABEL_REQUIRED_MESSAGE,
  isValidHexColour,
} from '@/lib/option-group';

export const optionGroupFormSchema = z
  .object({
    name: z.string().trim().min(1, NAME_REQUIRED_MESSAGE),
    displayType: z.enum(OPTION_DISPLAY_TYPES),
    values: z.array(
      z.object({
        valueId: z.string().optional(),
        label: z.string().trim().min(1, VALUE_LABEL_REQUIRED_MESSAGE),
        hex: z.string().trim(),
        variantCount: z.number(),
      }),
    ),
  })
  .superRefine(({ displayType, values }, ctx) => {
    if (displayType !== 'SWATCH') {
      return;
    }

    values.forEach((value, index) => {
      if (!isValidHexColour(value.hex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['values', index, 'hex'],
          message: HEX_REQUIRED_MESSAGE,
        });
      }
    });
  });

export type OptionGroupFormValues = z.infer<typeof optionGroupFormSchema>;
