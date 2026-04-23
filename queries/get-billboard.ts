import 'server-only';

import prismadb from '@/lib/prismadb';

export const getBillboard = async (storeId: string, billboardId: string) => {
  const billboard = await prismadb.billboard.findFirst({
    where: {
      id: billboardId,
      storeId,
    },
  });

  return billboard;
};
