import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createReservedOrder } from '@/lib/checkout-order';
import { checkoutCreatedResponse, checkoutErrorResponse } from '@/lib/checkout-response';
import {
  type CheckoutRequest,
  getCheckoutTotals,
  parseCheckoutRequest,
  resolveCheckoutItems,
  validateCheckoutFields,
} from '@/lib/checkout-rules';
import { corsHeaders } from '@/lib/cors';
import { getMontonioClient, type MontonioClient } from '@/lib/montonio-client';
import { buildMontonioOrderPayload, getCheckoutUrls, type MontonioOrderPayload } from '@/lib/montonio-order-payload';
import prismadb from '@/lib/prismadb';
import { releaseReservation } from '@/lib/reservation';
import { getProducts } from '@/queries/get-products';

const checkoutEnvSchema = z.object({
  FRONTEND_STORE_URL: z.string().url(),
  ADMIN_PUBLIC_URL: z.string().url(),
  VERCEL_PROTECTION_BYPASS_SECRET: z.string().optional(),
});

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;

  try {
    const parsed = parseCheckoutRequest(await req.json().catch(() => null));

    if (parsed.status === 'rejected') {
      return checkoutErrorResponse(parsed.error);
    }

    const { request } = parsed;
    const products = await getProducts(params.storeId, {
      productIds: [...new Set(request.lines.map(({ productId }) => productId))],
      selectCheckoutFields: true,
    });
    const resolved = resolveCheckoutItems({ lines: request.lines, products });

    if (resolved.status === 'rejected') {
      return checkoutErrorResponse(resolved.error);
    }

    const client = getMontonioClient();
    const fields = validateCheckoutFields({ ...request, ...(await loadMontonioLists({ client, request })) });

    if (fields.status === 'rejected') {
      return checkoutErrorResponse(fields.error);
    }

    const env = checkoutEnvSchema.parse(process.env);
    const { items } = resolved;
    const totals = getCheckoutTotals({ items, deliveryMethod: fields.delivery.method });
    const reservation = await createReservedOrder({ storeId: params.storeId, items, totals, fields });

    if (reservation.status === 'stock-changed') {
      return checkoutErrorResponse({ code: 'STOCK_CHANGED', items: reservation.items });
    }

    const { order } = reservation;
    const payload = buildMontonioOrderPayload({
      order,
      items,
      totals,
      ...fields,
      ...getCheckoutUrls({
        orderId: order.id,
        storeUrl: env.FRONTEND_STORE_URL,
        adminUrl: env.ADMIN_PUBLIC_URL,
        bypassSecret: env.VERCEL_PROTECTION_BYPASS_SECRET,
      }),
    });
    const created = await createMontonioOrder({ client, payload });

    if (created.status === 'failed') {
      reportCheckoutError({ tag: '[CHECKOUT_POST_MONTONIO]', error: created.error, orderId: order.id });
      await releaseReservation({ orderId: order.id });

      return checkoutErrorResponse({ code: 'PAYMENT_UNAVAILABLE' });
    }

    try {
      await prismadb.order.update({ where: { id: order.id }, data: { montonioOrderUuid: created.uuid } });
    } catch (error) {
      await releaseReservation({ orderId: order.id });
      throw error;
    }

    return checkoutCreatedResponse({ orderId: order.id, paymentUrl: created.paymentUrl });
  } catch (error) {
    reportCheckoutError({ tag: '[CHECKOUT_POST]', error });

    return checkoutErrorResponse({ code: 'INTERNAL' });
  }
}

const loadMontonioLists = async ({ client, request }: { client: MontonioClient; request: CheckoutRequest }) => {
  const [pickupPoints, banks] = await Promise.all([
    request.delivery.method === 'locker' ? client.getPickupPoints() : [],
    request.payment.method === 'bank' ? client.getPaymentMethods().then(({ banks }) => banks) : [],
  ]);

  return { pickupPoints, banks };
};

const createMontonioOrder = async ({ client, payload }: { client: MontonioClient; payload: MontonioOrderPayload }) => {
  try {
    const created = await client.createOrder(payload);

    if (created.status === 'failed') {
      return {
        status: 'failed',
        error: new Error(`Montonio order creation failed: ${JSON.stringify(created)}`),
      } as const;
    }

    return created;
  } catch (error) {
    return { status: 'failed', error } as const;
  }
};

const reportCheckoutError = ({ tag, error, orderId }: { tag: string; error: unknown; orderId?: string }) => {
  Sentry.captureException(error, orderId ? { extra: { orderId } } : undefined);
  console.log(tag, orderId ?? '', error);
};
