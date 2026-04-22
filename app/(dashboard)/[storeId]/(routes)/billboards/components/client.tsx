'use client';

import { ResourceListView } from '@/components/dashboard/resource-list-view';
import { BillboardColumn, columns } from './columns';

type Props = {
  data: BillboardColumn[];
};

export const BillboardClient = ({ data }: Props) => (
  <ResourceListView
    columns={columns}
    data={data}
    entityIdName="billboardId"
    entitySegment="billboards"
    searchKey="label"
    title="Skelbimų lentos"
  />
);
