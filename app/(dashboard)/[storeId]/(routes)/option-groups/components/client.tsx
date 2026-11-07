'use client';

import { ResourceListView } from '@/components/dashboard/resource-list-view';
import { OptionGroupColumn, columns } from './columns';

type Props = {
  data: OptionGroupColumn[];
};

export const OptionGroupClient = ({ data }: Props) => {
  return (
    <ResourceListView
      columns={columns}
      data={data}
      entityIdName="optionGroupId"
      entitySegment="option-groups"
      searchKey="name"
      title="Savybės"
      createLabel="Nauja savybė"
    />
  );
};
