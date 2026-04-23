import 'server-only';

import prismadb from '@/lib/prismadb';

interface GraphData {
  name: string;
  total: number;
}

export const getGraphRevenue = async (storeId: string): Promise<GraphData[]> => {
  const paidOrders = await prismadb.order.findMany({
    where: {
      storeId,
      isPaid: true,
    },
    include: {
      orderItems: {
        include: {
          product: true,
        },
      },
    },
  });

  const monthlyRevenue: { [key: number]: number } = {};

  // Grouping the orders by month and summing the revenue
  for (const order of paidOrders) {
    const month = order.createdAt.getMonth(); // 0 for Jan, 1 for Feb, ...
    let revenueForOrder = 0;

    for (const item of order.orderItems) {
      revenueForOrder += item.product.price.toNumber();
    }

    // Adding the revenue for this order to the respective month
    monthlyRevenue[month] = (monthlyRevenue[month] || 0) + revenueForOrder;
  }

  // Converting the grouped data into the format expected by the graph
  const graphData: GraphData[] = [
    { name: 'Sausis', total: 0 },
    { name: 'Vasaris', total: 0 },
    { name: 'Kovas', total: 0 },
    { name: 'Balandis', total: 0 },
    { name: 'Gegužė', total: 0 },
    { name: 'Birželis', total: 0 },
    { name: 'Liepa', total: 0 },
    { name: 'Rugpjūtis', total: 0 },
    { name: 'Rugsėjis', total: 0 },
    { name: 'Spalis', total: 0 },
    { name: 'Lapkritis', total: 0 },
    { name: 'Gruodis', total: 0 },
  ];

  // Filling in the revenue data
  for (const month in monthlyRevenue) {
    graphData[parseInt(month)].total = monthlyRevenue[parseInt(month)];
  }

  return graphData;
};
