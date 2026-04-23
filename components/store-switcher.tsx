'use client';

import * as React from 'react';
import { type Store as PrismaStore } from '@prisma/client';
import { Check, ChevronsUpDown, PlusCircle, Search, Store as StoreIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useStoreModal } from '@/hooks/use-store-modal';
import { useParams, useRouter } from 'next/navigation';

type PopoverTriggerProps = React.ComponentPropsWithoutRef<typeof PopoverTrigger>;

interface StoreSwitcherProps extends PopoverTriggerProps {
  items: PrismaStore[];
}

export default function StoreSwitcher({ className, items = [] }: StoreSwitcherProps) {
  const storeModal = useStoreModal();
  const params = useParams();
  const router = useRouter();
  const [search, setSearch] = React.useState('');

  const formattedItems = items.map((item) => ({
    label: item.name,
    value: item.id,
  }));
  const normalizedSearch = search.trim().toLowerCase();
  const filteredItems = normalizedSearch
    ? formattedItems.filter((item) => item.label.toLowerCase().includes(normalizedSearch))
    : formattedItems;

  const currentStore = formattedItems.find((item) => item.value === params.storeId);

  const [open, setOpen] = React.useState(false);

  const onStoreSelect = (store: { value: string; label: string }) => {
    setOpen(false);
    setSearch('');
    router.push(`/${store.value}`);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearch('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Pasirinkite parduotuvę"
          className={cn('w-[200px] min-w-0 justify-between gap-2', className)}
        >
          <StoreIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{currentStore?.label ?? 'Pasirinkite parduotuvę'}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b px-3 py-0.5">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ieškoti parduotuvės..."
              className="border-none bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>

        <div className="max-h-[280px] overflow-y-auto p-1">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Parduotuvės</div>

          {filteredItems.length > 0 ? (
            filteredItems.map((store) => (
              <button
                key={store.value}
                type="button"
                onClick={() => onStoreSelect(store)}
                className="flex w-full items-center rounded-sm px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <StoreIcon className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{store.label}</span>
                <Check
                  className={cn(
                    'ml-auto h-4 w-4 shrink-0',
                    currentStore?.value === store.value ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </button>
            ))
          ) : (
            <div className="px-2 py-3 text-sm text-muted-foreground">Parduotuvių nerasta.</div>
          )}
        </div>

        <div className="border-t p-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSearch('');
              storeModal.onOpen();
            }}
            className="flex w-full items-center rounded-sm px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <PlusCircle className="mr-2 h-5 w-5 shrink-0" />
            <span>Nauja parduotuvė</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
