import { auth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';
import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  params: { storeId: string };
};

export default async function DashboardLayout({ children, params }: Props) {
  const { userId } = auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const store = await getStoreByUserId(params.storeId, userId);

  if (!store) {
    redirect('/');
  }

  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
