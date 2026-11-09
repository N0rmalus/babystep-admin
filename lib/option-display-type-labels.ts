import type { OptionDisplayType } from '@prisma/client';

export const OPTION_DISPLAY_TYPE_LABELS = {
  CHIPS: 'Mygtukai',
  SWATCH: 'Spalvų apskritimai',
} as const satisfies Record<OptionDisplayType, string>;
