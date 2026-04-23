import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';
import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  params: Promise<{ storeId: string }>;
};

export default async function DashboardLayout({ children, params }: Props) {
  const { storeId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const store = await getStoreByUserId(storeId, userId);

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
