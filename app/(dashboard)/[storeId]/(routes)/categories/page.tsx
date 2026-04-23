import { format } from 'date-fns';
import { Page } from '@/components/dashboard/page';
import { getCategories } from '@/queries/get-categories';

import { CategoryClient } from './components/client';
import { CategoryColumn } from './components/columns';

const CategoriesPage = async (props: { params: Promise<{ storeId: string }> }) => {
  const params = await props.params;
  const categories = await getCategories(params.storeId, {
    includeBillboard: true,
    orderByCreatedAt: 'desc',
  });

  const formattedCategories: CategoryColumn[] = categories.map((item) => ({
    id: item.id,
    name: item.name,
    billboardLabel: item.billboard.label,
    createdAt: format(item.createdAt, 'dd/MM/yyyy'),
  }));

  return (
    <Page>
      <CategoryClient data={formattedCategories} />
    </Page>
  );
};

export default CategoriesPage;
