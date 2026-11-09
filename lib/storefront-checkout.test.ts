import { describe, expect, it } from 'vitest';

import { createMontonioClient } from '@/lib/montonio-client';
import {
  getDeliveryOptionsResponse,
  getPaymentMethodsResponse,
  getPickupPointsResponse,
  loadCheckoutLists,
} from '@/lib/storefront-checkout';

const NOW = new Date('2026-06-15T12:00:00Z');
const API_URL = 'https://sandbox-stargate.example.test/api';
const SHIPPING_API_URL = 'https://sandbox-shipping.example.test/api/v2';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const createClient = (respond: (url: string) => Response) => {
  const urls: string[] = [];
  const client = createMontonioClient({
    apiUrl: API_URL,
    shippingApiUrl: SHIPPING_API_URL,
    accessKey: 'test-access-key',
    secretKey: 'test-secret-not-a-real-key',
    fetch: async (input) => {
      const url = input.toString();
      urls.push(url);
      return respond(url);
    },
    now: () => NOW,
  });

  return { client, urls };
};

describe('getDeliveryOptionsResponse', () => {
  it('returns the delivery options and free-shipping threshold in euros', async () => {
    const response = getDeliveryOptionsResponse();

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await response.json()).toEqual({
      options: [
        { method: 'locker', price: 3.49, carriers: ['omniva', 'unisend'] },
        { method: 'courier', price: 6.49, carriers: ['smartposti'] },
      ],
      freeShippingThreshold: 80,
    });
  });
});

describe('getPaymentMethodsResponse', () => {
  it('returns the LT banks in Montonio order and whether cards are enabled', async () => {
    const { client } = createClient(() =>
      jsonResponse({
        paymentMethods: {
          paymentInitiation: {
            setup: {
              LT: {
                paymentMethods: [
                  { code: 'CBVILT2X', name: 'SEB Lithuania', uiPosition: 2 },
                  { code: 'HABALT22', name: 'Swedbank Lithuania', logoUrl: 'https://logo.test/s.png', uiPosition: 1 },
                ],
              },
            },
          },
          cardPayments: { processor: 'adyen' },
        },
      }),
    );

    const response = await getPaymentMethodsResponse(() => client);

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await response.json()).toEqual({
      banks: [
        { code: 'HABALT22', name: 'Swedbank Lithuania', logoUrl: 'https://logo.test/s.png' },
        { code: 'CBVILT2X', name: 'SEB Lithuania' },
      ],
      isCardEnabled: true,
    });
  });

  it('answers 502 with a Lithuanian message when Montonio fails', async () => {
    const { client } = createClient(() => jsonResponse({ error: 'unauthorized' }, 401));

    const response = await getPaymentMethodsResponse(() => client);

    expect(response.status).toBe(502);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await response.json()).toEqual({ message: 'Nepavyko gauti mokėjimo būdų. Bandyk dar kartą vėliau.' });
  });

  it('answers 502 with CORS headers when the Montonio client cannot be created', async () => {
    const response = await getPaymentMethodsResponse(() => {
      throw new Error('MONTONIO_ACCESS_KEY is missing');
    });

    expect(response.status).toBe(502);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

const respondWithPickupPoints = (url: string) => {
  if (url.includes('carrierCode=omniva')) {
    return jsonResponse({
      countryCode: 'LT',
      pickupPoints: [{ id: 'om-1', name: 'Akropolis paštomatas', streetAddress: 'Ozo g. 25', locality: 'Vilnius' }],
    });
  }

  return jsonResponse({
    countryCode: 'LT',
    pickupPoints: [{ id: 'un-1', name: 'Maxima paštomatas', streetAddress: 'Savanorių pr. 1', locality: 'Kaunas' }],
  });
};

describe('getPickupPointsResponse', () => {
  it('returns every Omniva and Unisend point for an empty query', async () => {
    const { client } = createClient(respondWithPickupPoints);

    const response = await getPickupPointsResponse({ getClient: () => client, query: '' });

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await response.json()).toEqual([
      { id: 'om-1', carrier: 'omniva', name: 'Akropolis paštomatas', address: 'Ozo g. 25', city: 'Vilnius' },
      { id: 'un-1', carrier: 'unisend', name: 'Maxima paštomatas', address: 'Savanorių pr. 1', city: 'Kaunas' },
    ]);
  });

  it('filters by the query and serves repeated searches from the cache', async () => {
    const { client, urls } = createClient(respondWithPickupPoints);

    await getPickupPointsResponse({ getClient: () => client, query: 'vilnius' });
    const response = await getPickupPointsResponse({ getClient: () => client, query: 'kaun' });

    expect(await response.json()).toEqual([
      { id: 'un-1', carrier: 'unisend', name: 'Maxima paštomatas', address: 'Savanorių pr. 1', city: 'Kaunas' },
    ]);
    expect(urls).toHaveLength(2);
  });

  it('answers 502 with a Lithuanian message when Montonio fails', async () => {
    const { client } = createClient(() => jsonResponse({ error: 'carrier_not_found_for_store' }, 404));

    const response = await getPickupPointsResponse({ getClient: () => client, query: '' });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: 'Nepavyko gauti paštomatų. Bandyk dar kartą vėliau.' });
  });
});

describe('loadCheckoutLists', () => {
  it('reports the lists as unavailable when Montonio pickup points fail to load', async () => {
    const { client } = createClient(() => jsonResponse({ message: 'down' }, 503));

    const lists = await loadCheckoutLists({
      client,
      delivery: { method: 'locker', pickupPointId: 'pickup-1' },
      payment: { method: 'card' },
    });

    expect(lists.status).toBe('unavailable');
  });

  it('reports the lists as unavailable when Montonio payment methods fail to load', async () => {
    const { client } = createClient(() => jsonResponse({ message: 'down' }, 500));

    const lists = await loadCheckoutLists({
      client,
      delivery: { method: 'courier', address: { street: 'Gedimino pr. 1', city: 'Vilnius', postalCode: 'LT-01103' } },
      payment: { method: 'bank', bankCode: 'HABALT22' },
    });

    expect(lists.status).toBe('unavailable');
  });

  it('loads nothing from Montonio for a courier order paid by card', async () => {
    const { client, urls } = createClient(() => jsonResponse({ message: 'down' }, 500));

    const lists = await loadCheckoutLists({
      client,
      delivery: { method: 'courier', address: { street: 'Gedimino pr. 1', city: 'Vilnius', postalCode: 'LT-01103' } },
      payment: { method: 'card' },
    });

    expect(lists).toEqual({ status: 'ok', pickupPoints: [], banks: [] });
    expect(urls).toEqual([]);
  });

  it('returns the pickup points and banks a locker order paid by bank needs', async () => {
    const { client } = createClient((url) =>
      url.includes('pickup-points')
        ? jsonResponse({
            pickupPoints: url.includes('carrierCode=omniva')
              ? [
                  {
                    id: 'omniva-1',
                    name: 'Vilniaus Akropolis paštomatas',
                    streetAddress: 'Ozo g. 25',
                    locality: 'Vilnius',
                  },
                ]
              : [],
          })
        : jsonResponse({
            paymentMethods: {
              paymentInitiation: { setup: { LT: { paymentMethods: [{ code: 'HABALT22', name: 'Swedbank' }] } } },
            },
          }),
    );

    const lists = await loadCheckoutLists({
      client,
      delivery: { method: 'locker', pickupPointId: 'omniva-1' },
      payment: { method: 'bank', bankCode: 'HABALT22' },
    });

    expect(lists).toEqual({
      status: 'ok',
      pickupPoints: [
        {
          id: 'omniva-1',
          carrier: 'omniva',
          name: 'Vilniaus Akropolis paštomatas',
          address: 'Ozo g. 25',
          city: 'Vilnius',
        },
      ],
      banks: [{ code: 'HABALT22', name: 'Swedbank' }],
    });
  });
});
