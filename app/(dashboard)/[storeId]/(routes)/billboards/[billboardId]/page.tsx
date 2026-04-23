import { redirect } from 'next/navigation';
import { BillboardForm } from './components/billboard-form';
import { Page } from '@/components/dashboard/page';
import { getBillboard } from '@/queries/get-billboard';

type Props = {
  params: Promise<{
    billboardId: string;
    storeId: string;
  }>;
};

const BillboardPage = async (props: Props) => {
  const params = await props.params;
  const billboard =
    params.billboardId !== 'new'
      ? await getBillboard(params.storeId, params.billboardId)
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
