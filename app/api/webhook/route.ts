import * as Sentry from '@sentry/nextjs';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { stripe } from '@/lib/stripe';
import prismadb from '@/lib/prismadb';

const buildQuantityByProductId = (productIds: string[]) => {
  return productIds.reduce<Record<string, number>>((accumulator, productId) => {
    accumulator[productId] = (accumulator[productId] ?? 0) + 1;
    return accumulator;
  }, {});
};

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature');

  if (!signature) {
    return new NextResponse('Missing Stripe signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook error';
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return new NextResponse(null, { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session?.metadata?.orderId;

  if (!orderId) {
    return new NextResponse('Webhook Error: missing order id', { status: 400 });
  }

  const address = session.customer_details?.address;
  const addressComponents = [
    address?.line1,
    address?.line2,
    address?.city,
    address?.state,
    address?.postal_code,
    address?.country,
  ];
  const addressString = addressComponents.filter(Boolean).join(', ');
  const phone = session.customer_details?.phone || '';

  try {
    await prismadb.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: {
          id: orderId,
        },
        include: {
          orderItems: true,
        },
      });

      if (!order) {
        throw new Error(`ORDER_NOT_FOUND:${orderId}`);
      }

      const markPaid = await tx.order.updateMany({
        where: {
          id: orderId,
          isPaid: false,
        },
        data: {
          isPaid: true,
          address: addressString,
          phone,
        },
      });

      if (markPaid.count === 0) {
        return;
      }

      const quantityByProductId = buildQuantityByProductId(order.orderItems.map((orderItem) => orderItem.productId));

      for (const [productId, quantity] of Object.entries(quantityByProductId)) {
        const stockUpdate = await tx.product.updateMany({
          where: {
            id: productId,
            amountInStock: {
              gte: quantity,
            },
          },
          data: {
            amountInStock: {
              decrement: quantity,
            },
          },
        });

        if (stockUpdate.count === 0) {
          throw new Error(`INSUFFICIENT_STOCK:${productId}`);
        }
      }

      await tx.product.updateMany({
        where: {
          id: {
            in: Object.keys(quantityByProductId),
          },
          amountInStock: {
            lte: 0,
          },
        },
        data: {
          isArchived: true,
        },
      });
    });
  } catch (error) {
    Sentry.captureException(error);
    console.log('[WEBHOOK_CHECKOUT_SESSION_COMPLETED]', error);
    return new NextResponse('Webhook processing error', { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
