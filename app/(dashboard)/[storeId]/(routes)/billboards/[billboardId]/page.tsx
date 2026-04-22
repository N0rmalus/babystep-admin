import prismadb from '@/lib/prismadb';
import { redirect } from 'next/navigation';
import { BillboardForm } from './components/billboard-form';

const BillboardPage = async ({ params }: { params: { billboardId: string; storeId: string } }) => {
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
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <BillboardForm initialData={billboard} />
      </div>
    </div>
  );
};

export default BillboardPage;
