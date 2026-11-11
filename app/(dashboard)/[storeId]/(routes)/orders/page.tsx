import { OrderClient } from './components/client';
import { Page } from '@/components/dashboard/page';
import { toAdminOrder } from '@/lib/admin-order';
import { getOrders } from '@/queries/get-orders';
import { requireStoreOwner } from '@/lib/require-store-owner';

type Props = {
  params: Promise<{
    storeId: string;
  }>;
};

const OrdersPage = async (props: Props) => {
  const params = await props.params;
  await requireStoreOwner(params.storeId);
  const orders = await getOrders(params.storeId);

  return (
    <Page>
      <OrderClient data={orders.map(toAdminOrder)} />
    </Page>
  );
};

export default OrdersPage;
