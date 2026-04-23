import { redirect } from 'next/navigation';
import { SubcategoryForm } from './components/subcategory-form';
import { Page } from '@/components/dashboard/page';
import { getCategories } from '@/queries/get-categories';
import { getSubcategory } from '@/queries/get-subcategory';

type Props = {
  params: Promise<{
    subcategoryId: string;
    storeId: string;
  }>;
};

const SubcategoryPage = async (props: Props) => {
  const params = await props.params;
  const categories = await getCategories(params.storeId);

  const subcategory =
    params.subcategoryId !== 'new'
      ? await getSubcategory(params.storeId, params.subcategoryId)
      : null;

  if (params.subcategoryId !== 'new' && !subcategory) {
    redirect(`/${params.storeId}/subcategories`);
  }

  return (
    <Page>
      <SubcategoryForm categories={categories} initialData={subcategory} />
    </Page>
  );
};

export default SubcategoryPage;
