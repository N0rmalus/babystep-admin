import { redirect } from 'next/navigation';
import { ProductForm } from './components/product-form';
import { Page } from '@/components/dashboard/page';
import { getCategories } from '@/queries/get-categories';
import { getProduct } from '@/queries/get-product';
import { getSubcategories } from '@/queries/get-subcategories';

type Props = {
  params: {
    productId: string;
    storeId: string;
  };
};

const ProductPage = async ({ params }: Props) => {
  const categories = await getCategories(params.storeId);
  const subcategories = await getSubcategories(params.storeId);

  const product = await getProduct(params.storeId, params.productId, { includeImages: true });

  if (params.productId !== 'new' && !product) {
    redirect(`/${params.storeId}/products`);
  }

  return (
    <Page>
      <ProductForm subcategories={subcategories} categories={categories} initialData={product} />
    </Page>
  );
};

export default ProductPage;
