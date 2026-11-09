import 'server-only';

import { Prisma } from '@prisma/client';
import prismadb from '@/lib/prismadb';

type GetOptionGroupOptions = {
  // Adds each value's variant count, which tells whether the value can be deleted
  includeValueUsage?: boolean;
};

type OptionGroupWithValues = Prisma.OptionGroupGetPayload<{ include: { values: true } }>;
type OptionGroupWithValueUsage = Prisma.OptionGroupGetPayload<{
  include: { values: { include: { _count: { select: { variants: true } } } } };
}>;

// Store-level groups only (productId null), with values in order.
export function getOptionGroup(
  storeId: string,
  optionGroupId: string,
  options: GetOptionGroupOptions & { includeValueUsage: true },
): Promise<OptionGroupWithValueUsage | null>;
export function getOptionGroup(
  storeId: string,
  optionGroupId: string,
  options?: GetOptionGroupOptions,
): Promise<OptionGroupWithValues | null>;
export async function getOptionGroup(storeId: string, optionGroupId: string, options?: GetOptionGroupOptions) {
  const optionGroup = await prismadb.optionGroup.findFirst({
    where: { id: optionGroupId, storeId, productId: null },
    include: {
      values: {
        orderBy: { position: 'asc' },
        ...(options?.includeValueUsage ? { include: { _count: { select: { variants: true } } } } : {}),
      },
    },
  });

  return optionGroup;
}
