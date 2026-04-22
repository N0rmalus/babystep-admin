import prismadb from '@/lib/prismadb';
import { redirect } from 'next/navigation';
import { CategoryForm } from './components/category-form';

const CategoryPage = async ({ params }: { params: { categoryId: string; storeId: string } }) => {
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
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <CategoryForm billboards={billboards} initialData={category} />
      </div>
    </div>
  );
};

export default CategoryPage;
