import 'server-only';

import { NextResponse } from 'next/server';

import { corsHeaders } from '@/lib/cors';
import { toStorefrontOrder } from '@/lib/storefront-order';
import { getStorefrontOrder } from '@/queries/get-storefront-order';

type StorefrontOrderResponseOptions = {
  storeId: string;
  orderId: string;
  logTag: string;
};

const NOT_FOUND_STATUS = 404;

export const ORDER_NOT_FOUND_MESSAGE = 'Užsakymas nerastas';

export const storefrontOrderResponse = async ({
  storeId,
  orderId,
  logTag,
}: StorefrontOrderResponseOptions): Promise<NextResponse> => {
  const storedOrder = await getStorefrontOrder({ storeId, orderId });

  if (!storedOrder) {
    return orderNotFoundResponse();
  }

  const order = toStorefrontOrder(storedOrder);

  if (!order) {
    console.log(logTag, `Order ${orderId} has no delivery or payment snapshot`);
    return orderNotFoundResponse();
  }

  return NextResponse.json(order, { headers: corsHeaders });
};

export const orderNotFoundResponse = (): NextResponse =>
  new NextResponse(ORDER_NOT_FOUND_MESSAGE, { status: NOT_FOUND_STATUS, headers: corsHeaders });
