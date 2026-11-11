import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { corsHeaders } from '@/lib/cors';
import { getMontonioClient } from '@/lib/montonio-client';
import { syncOrderToken } from '@/lib/montonio-order-sync';
import { applyWebhookAction, OrderChangedError } from '@/lib/montonio-webhook';
import { orderNotFoundResponse, storefrontOrderResponse } from '@/lib/storefront-order-response';
import { getWebhookOrder } from '@/queries/get-webhook-order';

type Params = { params: Promise<{ storeId: string; orderId: string }> };

// A signed Montonio order token is well under 2 KB; the cap keeps a public endpoint from parsing oversized input
const MAX_TOKEN_LENGTH = 4096;

const syncBodySchema = z.object({ orderToken: z.string().min(1).max(MAX_TOKEN_LENGTH) });

const LOG_TAG = '[ORDER_SYNC_POST]';
const BAD_REQUEST_STATUS = 400;
const UNAUTHORIZED_STATUS = 401;
const CONFLICT_STATUS = 409;
const INTERNAL_ERROR_STATUS = 500;

const INVALID_REQUEST_MESSAGE = 'Neteisinga užklausa';
const INVALID_TOKEN_MESSAGE = 'Mokėjimo patvirtinimas netinkamas';
const NOT_READY_MESSAGE = 'Užsakymas dar ruošiamas. Bandyk dar kartą po akimirkos.';
const INTERNAL_ERROR_MESSAGE = 'Vidinė serverio klaida';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// The storefront posts the order-token Montonio appends to the return URL, so the order updates before the webhook lands.
export async function POST(req: Request, props: Params) {
  const { storeId, orderId } = await props.params;

  try {
    const parsedBody = syncBodySchema.safeParse(await req.json().catch(() => null));

    if (!parsedBody.success) {
      return textResponse(INVALID_REQUEST_MESSAGE, BAD_REQUEST_STATUS);
    }

    const result = await syncOrderToken({
      token: parsedBody.data.orderToken,
      expectedOrderId: orderId,
      verifyOrderToken: getMontonioClient().verifyOrderToken,
      getOrder: (tokenOrderId) => getWebhookOrder({ orderId: tokenOrderId, storeId }),
      applyAction: applyActionUnlessRaced,
    });

    switch (result.status) {
      case 'invalid':
        return textResponse(INVALID_TOKEN_MESSAGE, UNAUTHORIZED_STATUS);
      case 'rejected':
        Sentry.captureMessage('Montonio return token rejected', {
          level: 'warning',
          extra: { reason: result.reason, orderId },
        });
        console.log(LOG_TAG, result.reason, orderId);

        return result.reason === 'ORDER_NOT_FOUND'
          ? orderNotFoundResponse()
          : textResponse(INVALID_TOKEN_MESSAGE, BAD_REQUEST_STATUS);
      case 'uuid-missing':
        return textResponse(NOT_READY_MESSAGE, CONFLICT_STATUS);
      case 'applied':
        return await storefrontOrderResponse({ storeId, orderId, logTag: LOG_TAG });
    }
  } catch (error) {
    Sentry.captureException(error, { extra: { orderId } });
    console.log(LOG_TAG, error);

    return textResponse(INTERNAL_ERROR_MESSAGE, INTERNAL_ERROR_STATUS);
  }
}

// The webhook may apply the same transition at the same moment; the order is then already up to date.
const applyActionUnlessRaced = async (options: Parameters<typeof applyWebhookAction>[0]) => {
  try {
    await applyWebhookAction(options);
  } catch (error) {
    if (!(error instanceof OrderChangedError)) {
      throw error;
    }

    console.log(LOG_TAG, error.message);
  }
};

const textResponse = (message: string, status: number) => new NextResponse(message, { status, headers: corsHeaders });
