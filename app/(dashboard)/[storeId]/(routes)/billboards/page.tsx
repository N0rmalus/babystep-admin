import { format } from 'date-fns';
import { Page } from '@/components/dashboard/page';
import { getBillboards } from '@/queries/get-billboards';

import { BillboardClient } from './components/client';
import { BillboardColumn } from './components/columns';

const BillboardsPage = async (props: { params: Promise<{ storeId: string }> }) => {
  const params = await props.params;
  const billboards = await getBillboards(params.storeId, { orderByCreatedAt: 'desc' });

  const formattedBillboards: BillboardColumn[] = billboards.map((item) => ({
    id: item.id,
    label: item.label,
    createdAt: format(item.createdAt, 'dd/MM/yyyy'),
  }));

  return (
    <Page>
      <BillboardClient data={formattedBillboards} />
    </Page>
  );
};

export default BillboardsPage;
