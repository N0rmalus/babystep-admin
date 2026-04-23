import prismadb from '@/lib/prismadb';
import { redirect } from 'next/navigation';
import { ProductForm } from './components/product-form';
import { Page } from '@/components/dashboard/page';

type Props = {
  params: {
    productId: string;
    storeId: string;
  };
};

const ProductPage = async ({ params }: Props) => {
  const product = await prismadb.product.findFirst({
    where: {
      id: params.productId,
      storeId: params.storeId,
    },
    include: {
      images: true,
    },
  });

  if (params.productId !== 'new' && !product) {
    redirect(`/${params.storeId}/products`);
  }

  const categories = await prismadb.category.findMany({
    where: { storeId: params.storeId },
  });

  const subcategories = await prismadb.subcategory.findMany({
    where: {
      category: {
        storeId: params.storeId,
      },
    },
  });

  return (
    <Page>
      <ProductForm subcategories={subcategories} categories={categories} initialData={product} />
    </Page>
  );
};

export default ProductPage;
