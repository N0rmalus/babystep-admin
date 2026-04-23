import { format } from 'date-fns';
import { Page } from '@/components/dashboard/page';
import { getSubcategories } from '@/queries/get-subcategories';
import { SubcategoryClient } from './components/client';
import { SubCategoryColumn } from './components/columns';

type Props = {
  params: Promise<{
    storeId: string;
  }>;
};

const SubcategoriesPage = async (props: Props) => {
  const params = await props.params;
  const subcategories = await getSubcategories(params.storeId, {
    includeCategory: true,
    orderByCreatedAt: 'desc',
  });

  const formattedSubcategories: SubCategoryColumn[] = subcategories.map((item) => ({
    id: item.id,
    name: item.name,
    categoryName: item.category.name,
    createdAt: format(item.createdAt, 'dd/MM/yyyy'),
  }));

  return (
    <Page>
      <SubcategoryClient data={formattedSubcategories} />
    </Page>
  );
};

export default SubcategoriesPage;
