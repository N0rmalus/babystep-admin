import 'server-only';

import prismadb from '@/lib/prismadb';

type GetBillboardsOptions = {
  orderByCreatedAt?: 'asc' | 'desc';
};

export const getBillboards = async (storeId: string, options?: GetBillboardsOptions) => {
  const billboards = await prismadb.billboard.findMany({
    where: {
      storeId,
    },
    ...(options?.orderByCreatedAt
      ? {
          orderBy: {
            createdAt: options.orderByCreatedAt,
          },
        }
      : {}),
  });

  return billboards;
};
