import { format } from 'date-fns';
import { Page } from '@/components/dashboard/page';
import { getProducts } from '@/queries/get-products';
import { formatter } from '@/lib/utils';

import { ProductClient } from './components/client';
import { ProductColumn } from './components/columns';

type Props = {
  params: {
    storeId: string;
  };
};

const ProductsPage = async ({ params }: Props) => {
  const products = await getProducts(params.storeId, {
    includeSubcategory: true,
    orderByCreatedAt: 'desc',
  });

  const formattedProducts: ProductColumn[] = products.map((item) => ({
    id: item.id,
    name: item.name,
    isFeatured: item.isFeatured,
    isArchived: item.isArchived,
    price: formatter.format(item.price.toNumber()),
    subcategory: item.subcategory?.name || '',
    createdAt: format(item.createdAt, 'dd/MM/yyyy'),
  }));

  return (
    <Page>
      <ProductClient data={formattedProducts} />
    </Page>
  );
};

export default ProductsPage;
