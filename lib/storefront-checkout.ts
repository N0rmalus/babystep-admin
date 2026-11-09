import { NextResponse } from 'next/server';

import { corsHeaders } from '@/lib/cors';
import { DELIVERY_CONFIG } from '@/lib/delivery-config';
import type { MontonioClient } from '@/lib/montonio-client';

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
};

export const getPickupPointsResponse = ({ getClient, query }: PickupPointsResponseOptions): Promise<NextResponse> =>
  respondWithMontonio({
    load: () => getClient().getPickupPoints({ query }),
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
