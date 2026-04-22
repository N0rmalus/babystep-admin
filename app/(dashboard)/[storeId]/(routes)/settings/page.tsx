import { auth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

import prismadb from '@/lib/prismadb';

import { SettingsForm } from './components/settings-form';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';

type Props = {
  params: {
    storeId: string;
  };
};

const SettingsPage = async ({ params }: Props) => {
  const { userId } = auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const store = await prismadb.store.findFirst({
    where: {
      id: params.storeId,
      userId,
    },
  });

  if (!store) {
    redirect('/');
  }

  return (
    <DashboardPageShell>
      <SettingsForm initialData={store} />
    </DashboardPageShell>
  );
};

export default SettingsPage;
