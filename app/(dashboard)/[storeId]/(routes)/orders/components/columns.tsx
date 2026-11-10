'use client';

import { ColumnDef } from '@tanstack/react-table';
import type { ReactNode } from 'react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { type AdminOrder, type AdminPaymentStatus, PAYMENT_STATUS_LABELS } from '@/lib/admin-order';
import { cn } from '@/lib/utils';

type NowrapCellProps = {
  children: ReactNode;
  className?: string;
};

type DetailsCellProps = {
  title: ReactNode;
  lines: string[];
};

export const SEARCH_COLUMN_ID = 'customer';

const SEARCH_SEPARATOR = ' ';

const PAYMENT_STATUS_VARIANTS = {
  paid: 'default',
  pending: 'secondary',
  unfinished: 'outline',
  voided: 'destructive',
  refunded: 'outline',
  partiallyRefunded: 'outline',
} satisfies Record<AdminPaymentStatus, BadgeProps['variant']>;

export const columns: ColumnDef<AdminOrder>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Data',
    cell: ({ row }) => <NowrapCell>{row.original.createdAt}</NowrapCell>,
  },
  {
    accessorKey: 'number',
    header: 'Nr.',
    cell: ({ row }) => <NowrapCell className="font-medium">{row.original.number}</NowrapCell>,
  },
  {
    id: SEARCH_COLUMN_ID,
    header: 'Pirkėjas',
    accessorFn: getSearchText,
    cell: ({ row }) => {
      const { name, email, phone } = row.original.customer;

      return <DetailsCell title={name} lines={[email, phone]} />;
    },
  },
  {
    id: 'delivery',
    header: 'Pristatymas',
    cell: ({ row }) => {
      const { delivery } = row.original;

      if (!delivery) {
        return null;
      }

      return <DetailsCell title={`${delivery.method}, ${delivery.carrier}`} lines={[delivery.destination]} />;
    },
  },
  {
    id: 'items',
    header: 'Prekės',
    cell: ({ row }) => (
      <ul className="flex flex-col gap-1">
        {row.original.items.map(({ id, text, quantity }) => (
          <li key={id}>
            {text} × {quantity}
          </li>
        ))}
      </ul>
    ),
  },
  {
    accessorKey: 'itemsTotal',
    header: 'Prekių suma',
    cell: ({ row }) => <NowrapCell>{row.original.itemsTotal}</NowrapCell>,
  },
  {
    accessorKey: 'shippingPrice',
    header: 'Siuntimas',
    cell: ({ row }) => <NowrapCell>{row.original.shippingPrice}</NowrapCell>,
  },
  {
    accessorKey: 'total',
    header: 'Iš viso',
    cell: ({ row }) => <NowrapCell className="font-medium">{row.original.total}</NowrapCell>,
  },
  {
    accessorKey: 'paymentStatus',
    header: 'Mokėjimas',
    cell: ({ row }) => {
      const { paymentStatus } = row.original;

      return (
        <Badge variant={PAYMENT_STATUS_VARIANTS[paymentStatus]} className="whitespace-nowrap">
          {PAYMENT_STATUS_LABELS[paymentStatus]}
        </Badge>
      );
    },
  },
];

const NowrapCell = ({ children, className }: NowrapCellProps) => (
  <span className={cn('whitespace-nowrap', className)}>{children}</span>
);

const DetailsCell = ({ title, lines }: DetailsCellProps) => (
  <div className="flex flex-col">
    <span className="font-medium">{title}</span>
    {lines.filter(Boolean).map((line, index) => (
      <span key={index} className="text-muted-foreground">
        {line}
      </span>
    ))}
  </div>
);

function getSearchText({ number, customer, items }: AdminOrder) {
  const itemTexts = items.map(({ text }) => text);

  return [number, customer.name, customer.email, customer.phone, ...itemTexts].join(SEARCH_SEPARATOR);
}
