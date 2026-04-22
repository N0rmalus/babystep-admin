import { auth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import prismadb from '@/lib/prismadb';
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
    <>
      <Navbar />
      {children}
    </>
  );
}
