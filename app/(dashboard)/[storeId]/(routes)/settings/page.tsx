import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { SettingsForm } from './components/settings-form';
import { Page } from '@/components/dashboard/page';
import { getHighestOrderNumber } from '@/queries/get-highest-order-number';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';

type Props = {
  params: Promise<{
    storeId: string;
  }>;
};

const SettingsPage = async ({ params }: Props) => {
  const { storeId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const store = await getStoreByUserId(storeId, userId);

  if (!store) {
    redirect('/');
  }

  const highestOrderNumber = await getHighestOrderNumber(store.id);

  return (
    <Page>
      <SettingsForm initialData={store} highestOrderNumber={highestOrderNumber} />
    </Page>
  );
};

export default SettingsPage;
