import { auth, UserButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { MainNav, MobileNav } from '@/components/main-nav';
import StoreSwitcher from '@/components/store-switcher';
import prismadb from '@/lib/prismadb';
import { ThemeToggle } from '@/components/theme-toggle';

export const Navbar = async () => {
  const { userId } = auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const stores = await prismadb.store.findMany({
    where: {
      userId,
    },
  });

  return (
    <div className="border-b">
      <div className="flex h-16 flex-wrap items-center gap-3 px-4 py-3 xl:flex-nowrap xl:gap-0 xl:py-0">
        <StoreSwitcher items={stores} className="h-10 min-w-0 flex-1 sm:flex-none xl:w-56" />
        <MainNav className="mx-6 flex-1" />
        <div className="ml-auto flex items-center gap-2 sm:gap-3 xl:gap-4">
          <MobileNav />
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </div>
  );
};
