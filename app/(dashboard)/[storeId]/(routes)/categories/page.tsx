import { format } from 'date-fns';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import prismadb from '@/lib/prismadb';

import { CategoryClient } from './components/client';
import { CategoryColumn } from './components/columns';

const CategoriesPage = async ({ params }: { params: { storeId: string } }) => {
  const categories = await prismadb.category.findMany({
    where: {
      storeId: params.storeId,
    },
    include: {
      billboard: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const formattedCategories: CategoryColumn[] = categories.map((item) => ({
    id: item.id,
    name: item.name,
    billboardLabel: item.billboard.label,
    createdAt: format(item.createdAt, 'dd/MM/yyyy'),
  }));

  return (
    <DashboardPageShell>
      <CategoryClient data={formattedCategories} />
    </DashboardPageShell>
  );
};

export default CategoriesPage;
