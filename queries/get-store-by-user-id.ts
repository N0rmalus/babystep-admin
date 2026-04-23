import 'server-only';

import prismadb from '@/lib/prismadb';

export const getStoreByUserId = async (storeId: string, userId: string) => {
  const store = await prismadb.store.findFirst({
    where: {
      id: storeId,
      userId,
    },
  });

  return store;
};
