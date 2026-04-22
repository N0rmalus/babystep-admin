import { format } from 'date-fns';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import prismadb from '@/lib/prismadb';

import { BillboardClient } from './components/client';
import { BillboardColumn } from './components/columns';

const BillboardsPage = async ({ params }: { params: { storeId: string } }) => {
  const billboards = await prismadb.billboard.findMany({
    where: {
      storeId: params.storeId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const formattedBillboards: BillboardColumn[] = billboards.map((item) => ({
    id: item.id,
    label: item.label,
    createdAt: format(item.createdAt, 'dd/MM/yyyy'),
  }));

  return (
    <DashboardPageShell>
      <BillboardClient data={formattedBillboards} />
    </DashboardPageShell>
  );
};

export default BillboardsPage;
