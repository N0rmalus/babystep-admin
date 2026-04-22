'use client';

import { ResourceListView } from '@/components/dashboard/resource-list-view';
import { columns, ProductColumn } from './columns';

type Props = {
  data: ProductColumn[];
};

export const ProductClient = ({ data }: Props) => (
  <ResourceListView
    columns={columns}
    data={data}
    entityIdName="productId"
    entitySegment="products"
    searchKey="name"
    title="Prekės"
  />
);
