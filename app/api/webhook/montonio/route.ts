import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getWebhookAction, getWebhookOrderMismatch, type WebhookOrderMismatch } from '@/lib/checkout-rules';
import { getMontonioClient, type MontonioClient } from '@/lib/montonio-client';
import { applyWebhookAction, OrderChangedError } from '@/lib/montonio-webhook';
import { getWebhookOrder } from '@/queries/get-webhook-order';

const webhookBodySchema = z.union([
  z.object({ orderToken: z.string().min(1) }),
  z.object({ refundToken: z.string().min(1) }),
]);

type TokenRejection = Exclude<WebhookOrderMismatch, 'UUID_MISSING'> | 'FOREIGN_ACCESS_KEY' | 'ORDER_NOT_FOUND';

const LOG_TAG = '[MONTONIO_WEBHOOK_POST]';
const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_INTERNAL_ERROR = 500;

export async function POST(req: Request) {
  try {
    const parsedBody = webhookBodySchema.safeParse(await req.json().catch(() => null));

    if (!parsedBody.success) {
      return emptyResponse(HTTP_BAD_REQUEST);
    }

    const client = getMontonioClient();

    if ('refundToken' in parsedBody.data) {
      return await handleRefundToken({ client, token: parsedBody.data.refundToken });
    }

    return await handleOrderToken({ client, token: parsedBody.data.orderToken });
  } catch (error) {
    if (error instanceof OrderChangedError) {
      console.log(LOG_TAG, error.message);

      return emptyResponse(HTTP_INTERNAL_ERROR);
    }

    Sentry.captureException(error);
    console.log(LOG_TAG, error);

    return emptyResponse(HTTP_INTERNAL_ERROR);
  }
}

const handleRefundToken = async ({ client, token }: { client: MontonioClient; token: string }) => {
  const verified = await client.verifyRefundToken(token);

  if (verified.status === 'invalid') {
    return emptyResponse(HTTP_UNAUTHORIZED);
  }

  if (verified.status === 'foreign-access-key') {
    return rejectToken({ reason: 'FOREIGN_ACCESS_KEY' });
  }

  return emptyResponse(HTTP_OK);
};

const handleOrderToken = async ({ client, token }: { client: MontonioClient; token: string }) => {
  const verified = await client.verifyOrderToken(token);

  if (verified.status === 'invalid') {
    return emptyResponse(HTTP_UNAUTHORIZED);
  }

  if (verified.status === 'foreign-access-key') {
    return rejectToken({ reason: 'FOREIGN_ACCESS_KEY' });
  }

  const { order: tokenOrder } = verified;
  const orderId = tokenOrder.merchantReference;
  const order = await getWebhookOrder(orderId);

  if (!order) {
    return rejectToken({ reason: 'ORDER_NOT_FOUND', orderId });
  }

  const mismatch = getWebhookOrderMismatch({ token: tokenOrder, order });

  if (mismatch === 'UUID_MISSING') {
    Sentry.captureMessage('Montonio webhook arrived before checkout stored the order UUID', {
      level: 'warning',
      extra: { orderId },
    });

    return emptyResponse(HTTP_INTERNAL_ERROR);
  }

  if (mismatch) {
    return rejectToken({ reason: mismatch, orderId });
  }

  const action = getWebhookAction({ order, status: tokenOrder.paymentStatus });
  await applyWebhookAction({ order, action });

  return emptyResponse(HTTP_OK);
};

const rejectToken = ({ reason, orderId }: { reason: TokenRejection; orderId?: string }) => {
  Sentry.captureMessage('Montonio webhook token rejected', { level: 'error', extra: { reason, orderId } });
  console.log(LOG_TAG, reason, orderId ?? '');

  return emptyResponse(HTTP_BAD_REQUEST);
};

const emptyResponse = (status: number) => new NextResponse(null, { status });
