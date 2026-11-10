'use client';

import axios from 'axios';
import { CircleCheck, MoreHorizontal } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AdminOrder } from '@/lib/admin-order';

type Props = {
  order: AdminOrder;
};

export const CellAction = ({ order }: Props) => {
  const params = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleResolve = async () => {
    try {
      setIsLoading(true);
      await axios.patch(`/api/${params.storeId}/orders/${order.id}`, { needsReview: false });
      router.refresh();
      toast.success(`Užsakymas ${order.number} pažymėtas kaip sutvarkytas.`);
    } catch {
      toast.error('Nepavyko pažymėti užsakymo kaip sutvarkyto.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!order.review) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="size-8 p-0">
          <span className="sr-only">Meniu</span>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Veiksmai</DropdownMenuLabel>
        <DropdownMenuItem className="cursor-pointer" disabled={isLoading} onClick={handleResolve}>
          <CircleCheck className="mr-2 size-4" />
          Pažymėti kaip sutvarkytą
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
