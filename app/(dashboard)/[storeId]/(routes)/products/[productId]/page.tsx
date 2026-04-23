import { redirect } from 'next/navigation';
import { ProductForm } from './components/product-form';
import { Page } from '@/components/dashboard/page';
import { getCategories } from '@/queries/get-categories';
import { getProduct } from '@/queries/get-product';
import { getSubcategories } from '@/queries/get-subcategories';

type Props = {
  params: Promise<{
    productId: string;
    storeId: string;
  }>;
};

const ProductPage = async (props: Props) => {
  const params = await props.params;
  const categories = await getCategories(params.storeId);
  const subcategories = await getSubcategories(params.storeId);

  const product = await getProduct(params.storeId, params.productId, { includeImages: true });

  if (params.productId !== 'new' && !product) {
    redirect(`/${params.storeId}/products`);
  }

  const serializedProduct = product
    ? {
        ...product,
        price: Number(product.price),
      }
    : null;

  return (
    <Page>
      <ProductForm subcategories={subcategories} categories={categories} initialData={serializedProduct} />
    </Page>
  );
};

export default ProductPage;
