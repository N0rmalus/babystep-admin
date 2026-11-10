'use client';

import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { DataTable } from '@/components/ui/data-table';
import type { AdminOrder } from '@/lib/admin-order';

import { columns, SEARCH_COLUMN_ID } from './columns';

type Props = {
  data: AdminOrder[];
};

export const OrderClient = ({ data }: Props) => {
  return (
    <>
      <div className="flex flex-col gap-3">
        <Heading title={`Užsakymai (${data.length})`} />
      </div>
      <Separator />
      <DataTable searchKey={SEARCH_COLUMN_ID} columns={columns} data={data} />
    </>
  );
};
