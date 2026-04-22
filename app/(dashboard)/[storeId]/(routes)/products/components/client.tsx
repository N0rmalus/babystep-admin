'use client';

import { Plus } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { DataTable } from '@/components/ui/data-table';
import { ApiList } from '@/components/ui/api-list';
import { columns, ProductColumn } from './columns';

type Props = {
  data: ProductColumn[];
};

export const ProductClient = ({ data }: Props) => {
  const router = useRouter();
  const params = useParams();

  return (
    <>
      <div className="flex items-center justify-between">
        <Heading title={`Prekės (${data.length})`} />
        <Button onClick={() => router.push(`/${params?.storeId}/products/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          Pridėti naują
        </Button>
      </div>
      <Separator />

      <DataTable searchKey="name" columns={columns} data={data} />

      <Heading title="API" />
      <Separator />
      <ApiList entityName="products" entityIdName="productId" />
    </>
  );
};
