import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getMontonioClient, type MontonioClient } from '@/lib/montonio-client';
import { type OrderTokenRejection, syncOrderToken } from '@/lib/montonio-order-sync';
import { applyWebhookAction, OrderChangedError } from '@/lib/montonio-webhook';
import { getWebhookOrder } from '@/queries/get-webhook-order';

const webhookBodySchema = z.union([
  z.object({ orderToken: z.string().min(1) }),
  z.object({ refundToken: z.string().min(1) }),
]);

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
  const result = await syncOrderToken({
    token,
    verifyOrderToken: client.verifyOrderToken,
    getOrder: (orderId) => getWebhookOrder({ orderId }),
    applyAction: applyWebhookAction,
  });

  switch (result.status) {
    case 'invalid':
      return emptyResponse(HTTP_UNAUTHORIZED);
    case 'rejected':
      return rejectToken(result);
    case 'uuid-missing':
      Sentry.captureMessage('Montonio webhook arrived before checkout stored the order UUID', {
        level: 'warning',
        extra: { orderId: result.orderId },
      });

      return emptyResponse(HTTP_INTERNAL_ERROR);
    case 'applied':
      return emptyResponse(HTTP_OK);
  }
};

const rejectToken = ({ reason, orderId }: { reason: OrderTokenRejection; orderId?: string }) => {
  Sentry.captureMessage('Montonio webhook token rejected', { level: 'error', extra: { reason, orderId } });
  console.log(LOG_TAG, reason, orderId ?? '');

  return emptyResponse(HTTP_BAD_REQUEST);
};

const emptyResponse = (status: number) => new NextResponse(null, { status });
