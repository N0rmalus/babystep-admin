'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { DataTable } from '@/components/ui/data-table';
import type { AdminOrder } from '@/lib/admin-order';

import { columns, SEARCH_COLUMN_ID } from './columns';
import { REVIEW_LABEL } from './review-label';

type Props = {
  data: AdminOrder[];
};

export const OrderClient = ({ data }: Props) => {
  const [isReviewFilterOn, setIsReviewFilterOn] = useState(false);

  const flaggedOrders = data.filter(({ review }) => review);
  const visibleOrders = isReviewFilterOn ? flaggedOrders : data;

  const handleReviewFilterToggle = () => setIsReviewFilterOn((isOn) => !isOn);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Heading title={`Užsakymai (${data.length})`} />
        <Button
          variant={isReviewFilterOn ? 'default' : 'outline'}
          aria-pressed={isReviewFilterOn}
          onClick={handleReviewFilterToggle}
        >
          {REVIEW_LABEL} ({flaggedOrders.length})
        </Button>
      </div>
      <Separator />
      <DataTable searchKey={SEARCH_COLUMN_ID} columns={columns} data={visibleOrders} />
    </>
  );
};
