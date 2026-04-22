'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { ApiList } from '@/components/ui/api-list';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';

type ResourceListViewProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  entityIdName: string;
  entitySegment: string;
  searchKey: string;
  title: string;
  createLabel?: string;
};

const getStoreId = (storeId: string | string[] | undefined) => (Array.isArray(storeId) ? storeId[0] : storeId);

export function ResourceListView<TData, TValue>({
  columns,
  data,
  entityIdName,
  entitySegment,
  searchKey,
  title,
  createLabel = 'Pridėti naują',
}: ResourceListViewProps<TData, TValue>) {
  const router = useRouter();
  const params = useParams();
  const storeId = getStoreId(params?.storeId);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Heading title={`${title} (${data.length})`} />
        <Button className="w-full sm:w-auto" onClick={() => router.push(`/${storeId}/${entitySegment}/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          {createLabel}
        </Button>
      </div>
      <Separator />

      <DataTable searchKey={searchKey} columns={columns} data={data} />

      <Heading title="API" />
      <Separator />
      <ApiList entityName={entitySegment} entityIdName={entityIdName} />
    </>
  );
}
