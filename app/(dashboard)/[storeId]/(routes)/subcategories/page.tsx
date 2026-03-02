import { format } from 'date-fns';
import prismadb from '@/lib/prismadb';

import { SubcategoryClient } from './components/client';
import { SubCategoryColumn } from './components/columns';

const SubcategoriesPage = async ({ params }: { params: { storeId: string } }) => {
  const subcategories = await prismadb.subcategory.findMany({
    where: {
      category: {
        storeId: params.storeId,
      },
    },
    include: {
      category: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const formattedSubcategories: SubCategoryColumn[] = subcategories.map((item) => ({
    id: item.id,
    name: item.name,
    categoryName: item.category.name,
    createdAt: format(item.createdAt, 'dd/MM/yyyy'),
  }));

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <SubcategoryClient data={formattedSubcategories} />
      </div>
    </div>
  );
};

export default SubcategoriesPage;
