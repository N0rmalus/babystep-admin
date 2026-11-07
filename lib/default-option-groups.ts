import type { Prisma } from '@prisma/client';

// Store-level groups every store starts with (no values). Keep in sync with the
// seed in prisma/migrations/20261107120000_product_variants for existing stores.
export const DEFAULT_OPTION_GROUPS = [
  { name: 'Dydis', displayType: 'CHIPS', role: 'SIZE', position: 0 },
  { name: 'Spalva', displayType: 'SWATCH', role: 'NONE', position: 1 },
] as const satisfies readonly Omit<Prisma.OptionGroupCreateManyStoreInput, 'productId'>[];
