import 'server-only';

import prismadb from '@/lib/prismadb';

export const ORDERED_OPTION_VALUES = { orderBy: { position: 'asc' } } as const;

// Store-level groups only (productId null): the ones managed on the Savybės page.
export const getOptionGroups = async (storeId: string) => {
  const optionGroups = await prismadb.optionGroup.findMany({
    where: { storeId, productId: null },
    include: {
      values: ORDERED_OPTION_VALUES,
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });

  return optionGroups;
};
