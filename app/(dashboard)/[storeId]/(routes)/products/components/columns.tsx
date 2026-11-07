'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { CellAction } from './cell-action';
import { TriangleAlert } from 'lucide-react';

export type ProductColumn = {
  id: string;
  name: string;
  price: string;
  salePrice: string | null;
  saleStatus: string;
  isOnSale: boolean;
  subcategory: string;
  stockCount: number;
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
    header: 'Archyv.',
  },
  {
    accessorKey: 'isFeatured',
    header: 'Rek.',
  },
  {
    accessorKey: 'stockCount',
    header: 'Laisva',
    cell: ({ row }) => {
      const product = row.original;

      if (product.stockCount === 0) {
        return (
          <div className="flex items-center gap-2">
            {product.stockCount}
            <TriangleAlert size={16} className="text-red-500" />
          </div>
        );
      }

      return product.stockCount;
    },
  },
  {
    accessorKey: 'price',
    header: 'Kaina',
    cell: ({ row }) => {
      const product = row.original;

      if (!product.salePrice) {
        return <span>{product.price}</span>;
      }

      return (
        <div className="flex flex-col">
          <span className={product.isOnSale ? 'text-muted-foreground line-through' : 'text-muted-foreground'}>
            {product.price}
          </span>
          <span className="font-medium">{product.salePrice}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'saleStatus',
    header: 'Akcija',
    cell: ({ row }) => <Badge variant={row.original.isOnSale ? 'default' : 'outline'}>{row.original.saleStatus}</Badge>,
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
