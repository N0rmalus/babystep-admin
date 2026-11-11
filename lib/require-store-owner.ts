import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { getStoreByUserId } from '@/queries/get-store-by-user-id';

const SIGN_IN_PATH = '/sign-in';
const HOME_PATH = '/';

// Dashboard pages render in parallel with the layout, so each page checks ownership itself before loading store data
export const requireStoreOwner = async (storeId: string) => {
  const { userId } = await auth();

  if (!userId) {
    redirect(SIGN_IN_PATH);
  }

  const store = await getStoreByUserId(storeId, userId);

  if (!store) {
    redirect(HOME_PATH);
  }

  return store;
};
