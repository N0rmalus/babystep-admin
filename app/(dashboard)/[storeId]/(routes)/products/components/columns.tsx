'use client';

import { ColumnDef } from '@tanstack/react-table';
import { CellAction } from './cell-action';

export type ProductColumn = {
  id: string;
  name: string;
  price: string;
  subcategory: string;
  isFeatured: boolean;
  isArchived: boolean;
  createdAt: string;
};

export const columns: ColumnDef<ProductColumn>[] = [
  {
    accessorKey: 'name',
    header: 'Pavadinimas',
  },
  {
    accessorKey: 'isArchived',
    header: 'Archyvuota',
  },
  {
    accessorKey: 'isFeatured',
    header: 'Rekomenduojama',
  },
  {
    accessorKey: 'price',
    header: 'Kaina',
  },
  {
    accessorKey: 'subcategory',
    header: 'Subkategorija',
  },
  {
    accessorKey: 'createdAt',
    header: 'Data',
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellAction data={row.original} />,
  },
];
