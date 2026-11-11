import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { corsHeaders } from '@/lib/cors';
import { resolveOrderReview } from '@/lib/order-review';
import { ORDER_NOT_FOUND_MESSAGE, storefrontOrderResponse } from '@/lib/storefront-order-response';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';

type Params = { params: Promise<{ storeId: string; orderId: string }> };

const BAD_REQUEST_STATUS = 400;
const UNAUTHENTICATED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const INTERNAL_ERROR_STATUS = 500;

const resolveReviewSchema = z.object({ needsReview: z.literal(false) }).strict();

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(_req: Request, props: Params) {
  const { storeId, orderId } = await props.params;

  try {
    return await storefrontOrderResponse({ storeId, orderId, logTag: '[ORDER_GET]' });
  } catch (error) {
    console.log('[ORDER_GET]', error);
    return new NextResponse('Internal error', { status: INTERNAL_ERROR_STATUS, headers: corsHeaders });
  }
}

export async function PATCH(req: Request, props: Params) {
  const { storeId, orderId } = await props.params;

  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Neautentifikuota', { status: UNAUTHENTICATED_STATUS });
    }

    const store = await getStoreByUserId(storeId, userId);

    if (!store) {
      return new NextResponse('Neautorizuota', { status: FORBIDDEN_STATUS });
    }

    const parsedBody = resolveReviewSchema.safeParse(await req.json().catch(() => null));

    if (!parsedBody.success) {
      return new NextResponse('Galima tik pažymėti užsakymą kaip sutvarkytą', { status: BAD_REQUEST_STATUS });
    }

    const isResolved = await resolveOrderReview({ storeId, orderId });

    if (!isResolved) {
      return new NextResponse(ORDER_NOT_FOUND_MESSAGE, { status: NOT_FOUND_STATUS });
    }

    return NextResponse.json({ id: orderId, needsReview: false });
  } catch (error) {
    console.log('[ORDER_PATCH]', error);
    return new NextResponse('Vidinė serverio klaida', { status: INTERNAL_ERROR_STATUS });
  }
}
