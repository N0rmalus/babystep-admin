'use client';

import { Plus } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { DataTable } from '@/components/ui/data-table';
import { ApiList } from '@/components/ui/api-list';
import { SubCategoryColumn, columns } from './columns';

interface SubCategoryClientProps {
  data: SubCategoryColumn[];
}

export const SubcategoryClient: React.FC<SubCategoryClientProps> = ({ data }) => {
  const router = useRouter();
  const params = useParams();

  return (
    <>
      <div className="flex items-center justify-between">
        <Heading title={`Subkategorijos (${data.length})`} description="Tvarkykite parduotuvės subkategorijas" />
        <Button onClick={() => router.push(`/${params.storeId}/subcategories/new`)}>
          <Plus className="mr-2 h-4 w-4" />
          Pridėti naują
        </Button>
      </div>
      <Separator />
      <DataTable searchKey="name" columns={columns} data={data} />
      <Heading title="API" description="API iškvietimas subkategorijoms" />
      <Separator />
      <ApiList entityName="subcategories" entityIdName="subcategoryId" />
    </>
  );
};
