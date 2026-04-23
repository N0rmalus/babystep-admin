import prismadb from '@/lib/prismadb';
import { redirect } from 'next/navigation';
import { BillboardForm } from './components/billboard-form';
import { Page } from '@/components/dashboard/page';

type Props = {
  params: {
    billboardId: string;
    storeId: string;
  };
};

const BillboardPage = async ({ params }: Props) => {
  const billboard =
    params.billboardId !== 'new'
      ? await prismadb.billboard.findFirst({
          where: {
            id: params.billboardId,
            storeId: params.storeId,
          },
        })
      : null;

  if (params.billboardId !== 'new' && !billboard) {
    redirect(`/${params.storeId}/billboards`);
  }

  return (
    <Page>
      <BillboardForm initialData={billboard} />
    </Page>
  );
};

export default BillboardPage;
