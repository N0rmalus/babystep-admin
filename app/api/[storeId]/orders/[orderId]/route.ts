import { NextResponse } from 'next/server';

import { corsHeaders } from '@/lib/cors';
import { toStorefrontOrder } from '@/lib/storefront-order';
import { getStorefrontOrder } from '@/queries/get-storefront-order';

const NOT_FOUND_STATUS = 404;
const INTERNAL_ERROR_STATUS = 500;

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(_req: Request, props: { params: Promise<{ storeId: string; orderId: string }> }) {
  const { storeId, orderId } = await props.params;

  try {
    const storedOrder = await getStorefrontOrder({ storeId, orderId });

    if (!storedOrder) {
      return notFoundResponse();
    }

    const order = toStorefrontOrder(storedOrder);

    if (!order) {
      console.log('[ORDER_GET]', `Order ${orderId} has no delivery or payment snapshot`);
      return notFoundResponse();
    }

    return NextResponse.json(order, { headers: corsHeaders });
  } catch (error) {
    console.log('[ORDER_GET]', error);
    return new NextResponse('Internal error', { status: INTERNAL_ERROR_STATUS, headers: corsHeaders });
  }
}

const notFoundResponse = () =>
  new NextResponse('Užsakymas nerastas', { status: NOT_FOUND_STATUS, headers: corsHeaders });
