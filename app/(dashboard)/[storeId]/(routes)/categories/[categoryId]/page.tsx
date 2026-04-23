import { redirect } from 'next/navigation';
import { CategoryForm } from './components/category-form';
import { Page } from '@/components/dashboard/page';
import { getCategory } from '@/queries/get-category';
import { getBillboards } from '@/queries/get-billboards';

type Props = {
  params: {
    categoryId: string;
    storeId: string;
  };
};

const CategoryPage = async ({ params }: Props) => {
  const category =
    params.categoryId !== 'new'
      ? await getCategory(params.storeId, params.categoryId)
      : null;

  if (params.categoryId !== 'new' && !category) {
    redirect(`/${params.storeId}/categories`);
  }

  const billboards = await getBillboards(params.storeId);

  return (
    <Page>
      <CategoryForm billboards={billboards} initialData={category} />
    </Page>
  );
};

export default CategoryPage;
