'use client';

import { ResourceListView } from '@/components/dashboard/resource-list-view';
import { CategoryColumn, columns } from './columns';

type Props = {
  data: CategoryColumn[];
};

export const CategoryClient = ({ data }: Props) => {
  return (
    <ResourceListView
      columns={columns}
      data={data}
      entityIdName="categoryId"
      entitySegment="categories"
      searchKey="name"
      title="Kategorijos"
    />
  );
};
