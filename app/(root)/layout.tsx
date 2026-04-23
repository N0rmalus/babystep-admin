import prismadb from '@/lib/prismadb';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export default async function SetupLayout({ children }: Props) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const store = await prismadb.store.findFirst({
    where: {
      userId,
    },
  });

  // If the user has any stores created, redirect to that store
  if (store) {
    redirect(`/${store.id}`);
  }

  return <>{children}</>;
}
