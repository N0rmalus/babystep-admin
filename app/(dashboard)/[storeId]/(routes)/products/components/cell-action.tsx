'use client';

import toast from 'react-hot-toast';
import axios from 'axios';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Copy, Edit, MoreHorizontal, Trash } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { AlertModal } from '@/components/modals/alert-modal';
import { ProductColumn } from './columns';

interface CellActionProps {
  data: ProductColumn;
}

export const CellAction: React.FC<CellActionProps> = ({ data }) => {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const onCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('Prekės ID nukopijuotas į iškarpinę');
  };
  const onDelete = async () => {
    try {
      setLoading(true);
      await axios.delete(`/api/${params?.storeId}/products/${data.id}`);
      router.refresh();
      toast.success('Prekė pašalinta.');
    } catch (error) {
      toast.error('Kažkas nepavyko.');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      <AlertModal isOpen={open} onClose={() => setOpen(false)} onConfirm={onDelete} loading={loading} />
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only"> Meniu </span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Veiksmai</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onCopy(data.id)}>
              <Copy className="mr-2 h-4 w-4" />
              Nukopijuoti ID
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/${params?.storeId}/products/${data.id}`)}>
              <Edit className="mr-2 h-4 w-4" />
              Atnaujinti
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpen(true)}>
              <Trash className="mr-2 h-4 w-4" />
              Ištrinti
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};
