import prismadb from '@/lib/prismadb';
import { redirect } from 'next/navigation';
import { BillboardForm } from './components/billboard-form';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';

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
    <DashboardPageShell>
      <BillboardForm initialData={billboard} />
    </DashboardPageShell>
  );
};

export default BillboardPage;
