'use client';

import toast from 'react-hot-toast';
import { useParams, useRouter } from 'next/navigation';
import { Copy, Edit, MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OptionGroupColumn } from './columns';

type Props = {
  data: OptionGroupColumn;
};

export const CellAction = ({ data }: Props) => {
  const params = useParams();
  const router = useRouter();

  const handleCopy = () => {
    navigator.clipboard.writeText(data.id);
    toast.success('Savybės ID nukopijuotas į iškarpinę.');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Meniu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Veiksmai</DropdownMenuLabel>
        <DropdownMenuItem className="cursor-pointer" onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Nukopijuoti ID
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push(`/${params?.storeId}/option-groups/${data.id}`)}
        >
          <Edit className="mr-2 h-4 w-4" />
          Atnaujinti
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
