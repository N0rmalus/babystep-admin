import prismadb from '@/lib/prismadb';
import { redirect } from 'next/navigation';
import { SubcategoryForm } from './components/subcategory-form';

type Props = {
  params: {
    subcategoryId: string;
    storeId: string;
  };
};

const SubcategoryPage = async ({ params }: Props) => {
  const subcategory =
    params.subcategoryId !== 'new'
      ? await prismadb.subcategory.findFirst({
          where: {
            id: params.subcategoryId,
            category: {
              storeId: params.storeId,
            },
          },
        })
      : null;

  if (params.subcategoryId !== 'new' && !subcategory) {
    redirect(`/${params.storeId}/subcategories`);
  }

  const categories = await prismadb.category.findMany({
    where: { storeId: params.storeId },
  });

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <SubcategoryForm categories={categories} initialData={subcategory} />
      </div>
    </div>
  );
};

export default SubcategoryPage;
