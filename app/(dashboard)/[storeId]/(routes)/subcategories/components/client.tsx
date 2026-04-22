'use client';

import { ResourceListView } from '@/components/dashboard/resource-list-view';
import { columns, SubCategoryColumn } from './columns';

type Props = {
  data: SubCategoryColumn[];
};

export const SubcategoryClient = ({ data }: Props) => (
  <ResourceListView
    columns={columns}
    data={data}
    entityIdName="subcategoryId"
    entitySegment="subcategories"
    searchKey="name"
    title="Subkategorijos"
  />
);
