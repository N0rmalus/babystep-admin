'use client';

import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { DataTable } from '@/components/ui/data-table';

import { columns, OrderColumn } from './columns';

type Props = {
  data: OrderColumn[];
};

export const OrderClient = ({ data }: Props) => {
  return (
    <>
      <div className="flex flex-col gap-3">
        <Heading title={`Užsakymai (${data.length})`} />
      </div>
      <Separator />
      <DataTable searchKey="products" columns={columns} data={data} />
    </>
  );
};
