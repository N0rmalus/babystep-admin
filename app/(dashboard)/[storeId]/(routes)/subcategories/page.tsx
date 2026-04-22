import { format } from 'date-fns';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import prismadb from '@/lib/prismadb';
import { SubcategoryClient } from './components/client';
import { SubCategoryColumn } from './components/columns';

type Props = {
  params: {
    storeId: string;
  };
};

const SubcategoriesPage = async ({ params }: Props) => {
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
    <DashboardPageShell>
      <SubcategoryClient data={formattedSubcategories} />
    </DashboardPageShell>
  );
};

export default SubcategoriesPage;
