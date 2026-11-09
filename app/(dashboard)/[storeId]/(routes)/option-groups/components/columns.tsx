'use client';

import { ColumnDef } from '@tanstack/react-table';
import { CellAction } from './cell-action';

export type OptionGroupColumn = {
  id: string;
  name: string;
  displayTypeLabel: string;
  valueSummary: string;
  valueCount: number;
};

export const columns: ColumnDef<OptionGroupColumn>[] = [
  {
    accessorKey: 'name',
    header: 'Pavadinimas',
  },
  {
    accessorKey: 'displayTypeLabel',
    header: 'Rodymas',
  },
  {
    accessorKey: 'valueSummary',
    header: 'Reikšmės',
    cell: ({ row }) => (
      <span className="text-muted-foreground line-clamp-2 max-w-md">
        {row.original.valueCount > 0 ? row.original.valueSummary : 'Reikšmių dar nėra'}
      </span>
    ),
  },
  {
    accessorKey: 'valueCount',
    header: 'Kiekis',
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellAction data={row.original} />,
  },
];
