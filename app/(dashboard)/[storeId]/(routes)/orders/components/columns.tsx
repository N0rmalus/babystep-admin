'use client';

import { ColumnDef } from '@tanstack/react-table';

export type OrderColumn = {
  id: string;
  phone: string;
  address: string;
  isPaid: boolean;
  totalPrice: string;
  products: string;
  createdAt: string;
};

export const columns: ColumnDef<OrderColumn>[] = [
  {
    accessorKey: 'products',
    header: 'Prekės',
  },
  {
    accessorKey: 'phone',
    header: 'Telefono nr.',
  },
  {
    accessorKey: 'address',
    header: 'Adresas',
  },
  {
    accessorKey: 'totalPrice',
    header: 'Bendra kaina',
  },
  {
    accessorKey: 'isPaid',
    header: 'Apmokėta',
  },
];
