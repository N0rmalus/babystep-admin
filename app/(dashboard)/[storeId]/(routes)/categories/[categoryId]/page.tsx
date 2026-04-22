import prismadb from '@/lib/prismadb';
import { redirect } from 'next/navigation';
import { CategoryForm } from './components/category-form';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';

type Props = {
  params: {
    categoryId: string;
    storeId: string;
  };
};

const CategoryPage = async ({ params }: Props) => {
  const category =
    params.categoryId !== 'new'
      ? await prismadb.category.findFirst({
          where: {
            id: params.categoryId,
            storeId: params.storeId,
          },
        })
      : null;

  if (params.categoryId !== 'new' && !category) {
    redirect(`/${params.storeId}/categories`);
  }

  const billboards = await prismadb.billboard.findMany({
    where: {
      storeId: params.storeId,
    },
  });

  return (
    <DashboardPageShell>
      <CategoryForm billboards={billboards} initialData={category} />
    </DashboardPageShell>
  );
};

export default CategoryPage;
