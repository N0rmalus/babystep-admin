import { format } from 'date-fns';
import { Page } from '@/components/dashboard/page';
import { getProductPricing, type SaleStatus } from '@/lib/product-pricing';
import { getProducts } from '@/queries/get-products';
import { formatter } from '@/lib/utils';

import { ProductClient } from './components/client';
import { ProductColumn } from './components/columns';
import { requireStoreOwner } from '@/lib/require-store-owner';

type Props = {
  params: Promise<{
    storeId: string;
  }>;
};

const saleStatusLabels = {
  none: 'Nėra',
  active: 'Aktyvi',
  scheduled: 'Suplanuota',
  ended: 'Pasibaigusi',
  invalid: 'Patikrinti',
} satisfies Record<SaleStatus, string>;

const ProductsPage = async (props: Props) => {
  const params = await props.params;
  await requireStoreOwner(params.storeId);
  const products = await getProducts(params.storeId, {
    includeSubcategory: true,
    includeStockCount: true,
    orderByCreatedAt: 'desc',
  });

  const formattedProducts: ProductColumn[] = products.map((item) => {
    const pricing = getProductPricing(item);

    return {
      id: item.id,
      name: item.name,
      isFeatured: item.isFeatured,
      isArchived: item.isArchived,
      stockCount: item.stockCount,
      variantCount: item.variantCount,
      price: formatter.format(pricing.regularPrice),
      salePrice: pricing.salePrice === null ? null : formatter.format(pricing.salePrice),
      saleStatus: saleStatusLabels[pricing.status],
      isOnSale: pricing.isOnSale,
      subcategory: item.subcategory?.name || '',
      createdAt: format(item.createdAt, 'dd/MM/yyyy'),
    };
  });

  return (
    <Page>
      <ProductClient data={formattedProducts} />
    </Page>
  );
};

export default ProductsPage;
