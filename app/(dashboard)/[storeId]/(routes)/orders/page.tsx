import { format } from 'date-fns';
import { formatter } from '@/lib/utils';

import { OrderClient } from './components/client';
import { OrderColumn } from './components/columns';
import { Page } from '@/components/dashboard/page';
import { getOrderItemTotal } from '@/lib/product-pricing';
import { getOrderItemText, OrderItemSnapshot } from '@/lib/variant-label';
import { getOrders } from '@/queries/get-orders';

type Props = {
  params: Promise<{
    storeId: string;
  }>;
};

const OrdersPage = async (props: Props) => {
  const params = await props.params;
  const orders = await getOrders(params.storeId);

  const formattedOrders: OrderColumn[] = orders.map((item) => ({
    id: item.id,
    phone: item.phone,
    address: item.address,
    products: item.orderItems.map(formatOrderItem).join(', '),
    totalPrice: formatter.format(
      item.orderItems.reduce((total, item) => {
        return total + getOrderItemTotal(item);
      }, 0),
    ),
    isPaid: item.isPaid,
    createdAt: format(item.createdAt, 'MMMM do, yyyy'),
  }));

  return (
    <Page>
      <OrderClient data={formattedOrders} />
    </Page>
  );
};

export default OrdersPage;

// Built from the order item snapshot, never live product data.
const formatOrderItem = ({ quantity, ...snapshot }: OrderItemSnapshot & { quantity: number }) => {
  return `${getOrderItemText(snapshot)} × ${quantity}`;
};
