import { NextResponse } from 'next/server';
import { z } from 'zod';

import { corsHeaders } from '@/lib/cors';
import { DELIVERY_CONFIG } from '@/lib/delivery-config';
import type { CheckoutRequest } from '@/lib/checkout-rules';
import type { Bank, MontonioClient, PickupPoint } from '@/lib/montonio-client';

const BAD_GATEWAY_STATUS = 502;

export const getDeliveryOptionsResponse = (): NextResponse =>
  NextResponse.json(DELIVERY_CONFIG, { headers: corsHeaders });

export const getPaymentMethodsResponse = (
  getClient: () => Pick<MontonioClient, 'getPaymentMethods'>,
): Promise<NextResponse> =>
  respondWithMontonio({
    load: () => getClient().getPaymentMethods(),
    logTag: '[PAYMENT_METHODS_GET]',
    failureMessage: 'Nepavyko gauti mokėjimo būdų. Bandyk dar kartą vėliau.',
  });

type PickupPointsResponseOptions = {
  getClient: () => Pick<MontonioClient, 'getPickupPoints'>;
  query: string;
  limit?: string | null;
};

export const DEFAULT_PICKUP_POINT_LIMIT = 50;
export const MAX_PICKUP_POINT_LIMIT = 500;

const pickupPointLimitSchema = z.coerce.number().int().min(1).max(MAX_PICKUP_POINT_LIMIT);

// A search defaults to 50 results. A request with neither query nor limit still gets every point, as before.
export const parsePickupPointLimit = ({
  limit,
  query,
}: {
  limit?: string | null;
  query: string;
}): number | undefined => {
  if (limit === undefined || limit === null) {
    return query.trim() ? DEFAULT_PICKUP_POINT_LIMIT : undefined;
  }

  const parsed = pickupPointLimitSchema.safeParse(limit.trim() || undefined);

  return parsed.success ? parsed.data : DEFAULT_PICKUP_POINT_LIMIT;
};

export const getPickupPointsResponse = ({
  getClient,
  query,
  limit,
}: PickupPointsResponseOptions): Promise<NextResponse> =>
  respondWithMontonio({
    load: () => getClient().getPickupPoints({ query, limit: parsePickupPointLimit({ limit, query }) }),
    logTag: '[PICKUP_POINTS_GET]',
    failureMessage: 'Nepavyko gauti paštomatų. Bandyk dar kartą vėliau.',
  });

type RespondWithMontonioOptions = {
  load: () => Promise<unknown>;
  logTag: string;
  failureMessage: string;
};

const respondWithMontonio = async ({ load, logTag, failureMessage }: RespondWithMontonioOptions) => {
  try {
    return NextResponse.json(await load(), { headers: corsHeaders });
  } catch (error) {
    console.log(logTag, error);

    return NextResponse.json({ message: failureMessage }, { status: BAD_GATEWAY_STATUS, headers: corsHeaders });
  }
};

type LoadCheckoutListsOptions = {
  client: Pick<MontonioClient, 'getPickupPoints' | 'getPaymentMethods'>;
  delivery: CheckoutRequest['delivery'];
  payment: CheckoutRequest['payment'];
};

export type CheckoutListsResult =
  { status: 'ok'; pickupPoints: PickupPoint[]; banks: Bank[] } | { status: 'unavailable'; error: unknown };

export const loadCheckoutLists = async ({
  client,
  delivery,
  payment,
}: LoadCheckoutListsOptions): Promise<CheckoutListsResult> => {
  try {
    const [pickupPoints, banks] = await Promise.all([
      delivery.method === 'locker' ? client.getPickupPoints() : [],
      payment.method === 'bank' ? client.getPaymentMethods().then((methods) => methods.banks) : [],
    ]);

    return { status: 'ok', pickupPoints, banks };
  } catch (error) {
    return { status: 'unavailable', error };
  }
};
