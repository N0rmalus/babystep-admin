'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { HtmlHTMLAttributes } from 'react';

const getStoreId = (storeId: string | string[] | undefined) => (Array.isArray(storeId) ? storeId[0] : storeId);

const isRouteActive = (pathname: string, href: string, exact = false) =>
  exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

const getRoutes = (storeId: string | undefined, pathname: string) => {
  const basePath = storeId ? `/${storeId}` : '/';

  return [
    {
      href: basePath,
      label: 'Apžvalga',
      active: isRouteActive(pathname, basePath, true),
    },
    {
      href: `${basePath}/billboards`,
      label: 'Skelbimų lentos',
      active: isRouteActive(pathname, `${basePath}/billboards`),
    },
    {
      href: `${basePath}/categories`,
      label: 'Kategorijos',
      active: isRouteActive(pathname, `${basePath}/categories`),
    },
    {
      href: `${basePath}/subcategories`,
      label: 'Subkategorijos',
      active: isRouteActive(pathname, `${basePath}/subcategories`),
    },
    {
      href: `${basePath}/products`,
      label: 'Prekės',
      active: isRouteActive(pathname, `${basePath}/products`),
    },
    {
      href: `${basePath}/orders`,
      label: 'Užsakymai',
      active: isRouteActive(pathname, `${basePath}/orders`),
    },
    {
      href: `${basePath}/settings`,
      label: 'Nustatymai',
      active: isRouteActive(pathname, `${basePath}/settings`),
    },
  ];
};

export const MainNav = ({ className, ...props }: HtmlHTMLAttributes<HTMLElement>) => {
  const pathname = usePathname();
  const params = useParams();
  const routes = getRoutes(getStoreId(params?.storeId), pathname);

  return (
    <nav className={cn('hidden items-center space-x-4 lg:space-x-6 xl:flex', className)} {...props}>
      {routes.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={cn(
            'text-sm font-medium transition-colors hover:text-primary',
            route.active ? 'text-black dark:text-white' : 'text-muted-foreground',
          )}
        >
          {route.label}
        </Link>
      ))}
    </nav>
  );
};

export const MobileNav = () => {
  const pathname = usePathname();
  const params = useParams();

  const routes = getRoutes(getStoreId(params?.storeId), pathname);
  const activeRoute = routes.find((route) => route.active);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="xl:hidden" aria-label="Atverti navigaciją">
          <Menu className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 xl:hidden">
        <DropdownMenuLabel>{activeRoute?.label ?? 'Navigacija'}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {routes.map((route) => (
          <DropdownMenuItem
            key={route.href}
            asChild
            className={cn('cursor-pointer', route.active && 'bg-accent text-accent-foreground')}
          >
            <Link href={route.href}>{route.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
