import { jwtVerify, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';

import { createMontonioClient } from '@/lib/montonio-client';
import { buildMontonioOrderPayload } from '@/lib/montonio-order-payload';

const NOW = new Date('2026-06-15T12:00:00Z');
const NOW_SECONDS = NOW.getTime() / 1000;
const TEST_SECRET = 'test-secret-not-a-real-key';
const TEST_ACCESS_KEY = 'test-access-key';
const API_URL = 'https://sandbox-stargate.example.test/api';
const SHIPPING_API_URL = 'https://sandbox-shipping.example.test/api/v2';

const encodedSecret = new TextEncoder().encode(TEST_SECRET);

type FetchCall = { url: string; init: RequestInit | undefined };

const createFakeFetch = (respond: (url: string) => Response | Promise<Response>) => {
  const calls: FetchCall[] = [];
  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    calls.push({ url, init });
    return respond(url);
  };

  return { calls, fakeFetch };
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const createClient = ({ fakeFetch, now = () => NOW }: { fakeFetch: typeof fetch; now?: () => Date }) =>
  createMontonioClient({
    apiUrl: API_URL,
    shippingApiUrl: SHIPPING_API_URL,
    accessKey: TEST_ACCESS_KEY,
    secretKey: TEST_SECRET,
    fetch: fakeFetch,
    now,
  });

const verifyAtNow = (token: string) => jwtVerify(token, encodedSecret, { algorithms: ['HS256'], currentDate: NOW });

const getBearerToken = (call: FetchCall | undefined) => {
  const authorization = new Headers(call?.init?.headers).get('Authorization') ?? '';

  return authorization.replace(/^Bearer /, '');
};

const orderPayload = buildMontonioOrderPayload({
  order: { id: 'order-uuid-1', number: 10001 },
  items: [{ productName: 'Muslino merliukas', options: [], unitPrice: 20, quantity: 2 }],
  totals: { itemsTotal: 40, shippingPrice: 3.49, total: 43.49 },
  contact: { firstName: 'Ona', lastName: 'Kazlauskienė', email: 'ona@example.lt', phone: '+37061234567' },
  delivery: {
    method: 'locker',
    pickupPoint: { name: 'Vilniaus Akropolis paštomatas', address: 'Ozo g. 25', city: 'Vilnius' },
  },
  payment: { method: 'card' },
  returnUrl: 'https://babystep.lt/uzsakymas/order-uuid-1',
  notificationUrl: 'https://admin.babystep.lt/api/webhook/montonio',
});

describe('createOrder', () => {
  it('posts the order as a signed token carrying our access key and an expiry', async () => {
    const { calls, fakeFetch } = createFakeFetch(() =>
      jsonResponse({ uuid: 'montonio-uuid', paymentUrl: 'https://pay.example.test/x' }),
    );

    await createClient({ fakeFetch }).createOrder(orderPayload);

    const call = calls.at(0);
    expect(call?.url).toBe(`${API_URL}/orders`);
    expect(call?.init?.method).toBe('POST');

    const body = JSON.parse(String(call?.init?.body));
    const { payload, protectedHeader } = await verifyAtNow(body.data);

    expect(protectedHeader.alg).toBe('HS256');
    expect(payload).toMatchObject({ ...orderPayload, accessKey: TEST_ACCESS_KEY });
    expect(payload.exp).toBeGreaterThan(NOW_SECONDS);
  });

  it('returns the Montonio order UUID and payment URL', async () => {
    const { fakeFetch } = createFakeFetch(() =>
      jsonResponse({ uuid: 'montonio-uuid', paymentUrl: 'https://pay.example.test/x', paymentStatus: 'PENDING' }),
    );

    const result = await createClient({ fakeFetch }).createOrder(orderPayload);

    expect(result).toEqual({ status: 'created', uuid: 'montonio-uuid', paymentUrl: 'https://pay.example.test/x' });
  });

  it('turns a non-2xx response into a failure', async () => {
    const { fakeFetch } = createFakeFetch(() => jsonResponse({ message: 'STORE_NOT_FOUND' }, 401));

    const result = await createClient({ fakeFetch }).createOrder(orderPayload);

    expect(result).toEqual({ status: 'failed', reason: 'HTTP_ERROR', httpStatus: 401 });
  });

  it('turns an unreachable API into a failure', async () => {
    const { fakeFetch } = createFakeFetch(() => Promise.reject(new TypeError('fetch failed')));

    const result = await createClient({ fakeFetch }).createOrder(orderPayload);

    expect(result).toEqual({ status: 'failed', reason: 'NETWORK_ERROR' });
  });

  it('turns a response without a payment URL into a failure', async () => {
    const { fakeFetch } = createFakeFetch(() => jsonResponse({ uuid: 'montonio-uuid' }));

    const result = await createClient({ fakeFetch }).createOrder(orderPayload);

    expect(result).toEqual({ status: 'failed', reason: 'INVALID_RESPONSE' });
  });
});

const orderTokenPayload = {
  uuid: 'montonio-uuid',
  accessKey: TEST_ACCESS_KEY,
  merchantReference: 'order-uuid-1',
  merchantReferenceDisplay: 'U-10001',
  paymentStatus: 'PAID',
  paymentMethod: 'paymentInitiation',
  grandTotal: 43.49,
  currency: 'EUR',
};

const signWebhookToken = ({
  payload,
  secret = TEST_SECRET,
  expiresAt = NOW_SECONDS + 60,
}: {
  payload: Record<string, unknown>;
  secret?: string;
  expiresAt?: number;
}) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(NOW_SECONDS - 60)
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(secret));

const tamperPayload = (token: string, changes: Record<string, unknown>) => {
  const [header, payload, signature] = token.split('.');
  const decoded = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString());
  const tampered = Buffer.from(JSON.stringify({ ...decoded, ...changes })).toString('base64url');

  return [header, tampered, signature].join('.');
};

const { fakeFetch: unusedFetch } = createFakeFetch(() => jsonResponse({}));

describe('verifyOrderToken', () => {
  it('accepts a token signed with our secret and returns its order fields', async () => {
    const token = await signWebhookToken({ payload: orderTokenPayload });

    const result = await createClient({ fakeFetch: unusedFetch }).verifyOrderToken(token);

    expect(result).toEqual({
      status: 'valid',
      order: {
        uuid: 'montonio-uuid',
        merchantReference: 'order-uuid-1',
        paymentStatus: 'PAID',
        grandTotal: 43.49,
        currency: 'EUR',
      },
    });
  });

  it('rejects a token signed with another secret', async () => {
    const token = await signWebhookToken({ payload: orderTokenPayload, secret: 'someone-elses-secret' });

    const result = await createClient({ fakeFetch: unusedFetch }).verifyOrderToken(token);

    expect(result).toEqual({ status: 'invalid' });
  });

  it('rejects a token whose payload was changed after signing', async () => {
    const token = tamperPayload(await signWebhookToken({ payload: orderTokenPayload }), { grandTotal: 0.01 });

    const result = await createClient({ fakeFetch: unusedFetch }).verifyOrderToken(token);

    expect(result).toEqual({ status: 'invalid' });
  });

  it('rejects an expired token', async () => {
    const token = await signWebhookToken({ payload: orderTokenPayload, expiresAt: NOW_SECONDS - 1 });

    const result = await createClient({ fakeFetch: unusedFetch }).verifyOrderToken(token);

    expect(result).toEqual({ status: 'invalid' });
  });

  it('rejects a token that is not a JWT', async () => {
    const result = await createClient({ fakeFetch: unusedFetch }).verifyOrderToken('not-a-token');

    expect(result).toEqual({ status: 'invalid' });
  });

  it('rejects a token with an unknown payment status', async () => {
    const token = await signWebhookToken({ payload: { ...orderTokenPayload, paymentStatus: 'SOMETHING_NEW' } });

    const result = await createClient({ fakeFetch: unusedFetch }).verifyOrderToken(token);

    expect(result).toEqual({ status: 'invalid' });
  });

  it('reports a correctly signed token for another access key', async () => {
    const token = await signWebhookToken({ payload: { ...orderTokenPayload, accessKey: 'other-store' } });

    const result = await createClient({ fakeFetch: unusedFetch }).verifyOrderToken(token);

    expect(result).toEqual({ status: 'foreign-access-key' });
  });
});

describe('verifyRefundToken', () => {
  const refundTokenPayload = { accessKey: TEST_ACCESS_KEY, orderUuid: 'montonio-uuid', refundStatus: 'SUCCESSFUL' };

  it('accepts a refund token signed with our secret', async () => {
    const token = await signWebhookToken({ payload: refundTokenPayload });

    const result = await createClient({ fakeFetch: unusedFetch }).verifyRefundToken(token);

    expect(result).toEqual({ status: 'valid' });
  });

  it('rejects a refund token signed with another secret', async () => {
    const token = await signWebhookToken({ payload: refundTokenPayload, secret: 'someone-elses-secret' });

    const result = await createClient({ fakeFetch: unusedFetch }).verifyRefundToken(token);

    expect(result).toEqual({ status: 'invalid' });
  });

  it('rejects an expired refund token', async () => {
    const token = await signWebhookToken({ payload: refundTokenPayload, expiresAt: NOW_SECONDS - 1 });

    const result = await createClient({ fakeFetch: unusedFetch }).verifyRefundToken(token);

    expect(result).toEqual({ status: 'invalid' });
  });

  it('reports a refund token for another access key', async () => {
    const token = await signWebhookToken({ payload: { ...refundTokenPayload, accessKey: 'other-store' } });

    const result = await createClient({ fakeFetch: unusedFetch }).verifyRefundToken(token);

    expect(result).toEqual({ status: 'foreign-access-key' });
  });
});

const paymentMethodsResponse = {
  uuid: 'store-uuid',
  name: 'Babystep',
  paymentMethods: {
    paymentInitiation: {
      processor: 'montonio',
      setup: {
        EE: {
          supportedCurrencies: ['EUR'],
          paymentMethods: [
            {
              code: 'HABAEE2X',
              name: 'Swedbank Estonia',
              logoUrl: 'https://logos.example.test/hab-ee.png',
              supportedCurrencies: ['EUR'],
              uiPosition: 1,
            },
          ],
        },
        LT: {
          supportedCurrencies: ['EUR'],
          paymentMethods: [
            {
              code: 'CBVILT2X',
              name: 'SEB',
              logoUrl: 'https://logos.example.test/seb.png',
              supportedCurrencies: ['EUR'],
              uiPosition: 2,
            },
            { code: 'RVUALT2V', name: 'Revolut', supportedCurrencies: ['EUR'], uiPosition: 3 },
            {
              code: 'HABALT22',
              name: 'Swedbank',
              logoUrl: 'https://logos.example.test/hab.png',
              supportedCurrencies: ['EUR'],
              uiPosition: 1,
            },
          ],
        },
      },
    },
    cardPayments: { processor: 'adyen', logoUrl: 'https://logos.example.test/cards.png', requiredToBeEnabled: true },
  },
};

describe('getPaymentMethods', () => {
  it('asks the configured API with a bearer token carrying our access key and an expiry', async () => {
    const { calls, fakeFetch } = createFakeFetch(() => jsonResponse(paymentMethodsResponse));

    await createClient({ fakeFetch }).getPaymentMethods();

    const call = calls.at(0);
    expect(call?.url).toBe(`${API_URL}/stores/payment-methods`);

    const { payload } = await verifyAtNow(getBearerToken(call));
    expect(payload.accessKey).toBe(TEST_ACCESS_KEY);
    expect(payload.exp).toBeGreaterThan(NOW_SECONDS);
  });

  it('lists the Lithuanian banks in Montonio order and enables cards', async () => {
    const { fakeFetch } = createFakeFetch(() => jsonResponse(paymentMethodsResponse));

    const paymentMethods = await createClient({ fakeFetch }).getPaymentMethods();

    expect(paymentMethods).toEqual({
      banks: [
        { code: 'HABALT22', name: 'Swedbank', logoUrl: 'https://logos.example.test/hab.png' },
        { code: 'CBVILT2X', name: 'SEB', logoUrl: 'https://logos.example.test/seb.png' },
        { code: 'RVUALT2V', name: 'Revolut' },
      ],
      isCardEnabled: true,
    });
  });

  it('reports no banks and no cards when the store has none enabled', async () => {
    const { fakeFetch } = createFakeFetch(() =>
      jsonResponse({ uuid: 'store-uuid', name: 'Babystep', paymentMethods: {} }),
    );

    const paymentMethods = await createClient({ fakeFetch }).getPaymentMethods();

    expect(paymentMethods).toEqual({ banks: [], isCardEnabled: false });
  });

  it('reuses the answer for a short time, then asks again', async () => {
    let now = NOW;
    const { calls, fakeFetch } = createFakeFetch(() => jsonResponse(paymentMethodsResponse));
    const client = createClient({ fakeFetch, now: () => now });

    await client.getPaymentMethods();
    await client.getPaymentMethods();
    expect(calls).toHaveLength(1);

    now = new Date(NOW.getTime() + 60 * 60 * 1000);
    await client.getPaymentMethods();
    expect(calls).toHaveLength(2);
  });

  it('shares one request between concurrent first callers', async () => {
    const { calls, fakeFetch } = createFakeFetch(() => jsonResponse(paymentMethodsResponse));
    const client = createClient({ fakeFetch });

    await Promise.all([client.getPaymentMethods(), client.getPaymentMethods()]);

    expect(calls).toHaveLength(1);
  });

  it('throws when Montonio answers with an error, and does not cache it', async () => {
    let status = 500;
    const { calls, fakeFetch } = createFakeFetch(() => jsonResponse(paymentMethodsResponse, status));
    const client = createClient({ fakeFetch });

    await expect(client.getPaymentMethods()).rejects.toThrow();

    status = 200;
    await expect(client.getPaymentMethods()).resolves.toMatchObject({ isCardEnabled: true });
    expect(calls).toHaveLength(2);
  });
});

const pickupPointsByCarrier: Record<string, unknown> = {
  omniva: {
    countryCode: 'LT',
    pickupPoints: [
      {
        id: 'omniva-1',
        name: 'Akropolio Omniva paštomatas',
        type: 'parcelMachine',
        streetAddress: 'Ozo g. 25',
        locality: 'Vilnius',
        postalCode: '07150',
        carrierCode: 'omniva',
      },
      {
        id: 'omniva-2',
        name: 'Mega Omniva paštomatas',
        type: 'parcelMachine',
        streetAddress: 'Islandijos pl. 32',
        locality: 'Kaunas',
        postalCode: '47446',
        carrierCode: 'omniva',
      },
    ],
  },
  unisend: {
    countryCode: 'LT',
    pickupPoints: [
      {
        id: 'unisend-1',
        name: 'Šiaulių Saulės miesto paštomatas',
        type: 'parcelMachine',
        streetAddress: 'Tilžės g. 109',
        locality: 'Šiauliai',
        postalCode: '76349',
        carrierCode: 'unisend',
      },
    ],
  },
};

const pickupPointsFetch = () =>
  createFakeFetch((url) => {
    const carrierCode = new URL(url).searchParams.get('carrierCode') ?? '';

    return jsonResponse(pickupPointsByCarrier[carrierCode] ?? { countryCode: 'LT', pickupPoints: [] });
  });

const ALL_PICKUP_POINTS = [
  { id: 'omniva-1', carrier: 'omniva', name: 'Akropolio Omniva paštomatas', address: 'Ozo g. 25', city: 'Vilnius' },
  { id: 'omniva-2', carrier: 'omniva', name: 'Mega Omniva paštomatas', address: 'Islandijos pl. 32', city: 'Kaunas' },
  {
    id: 'unisend-1',
    carrier: 'unisend',
    name: 'Šiaulių Saulės miesto paštomatas',
    address: 'Tilžės g. 109',
    city: 'Šiauliai',
  },
];

describe('getPickupPoints', () => {
  it('asks the shipping API for Lithuanian parcel machines of both carriers with a signed bearer token', async () => {
    const { calls, fakeFetch } = pickupPointsFetch();

    await createClient({ fakeFetch }).getPickupPoints();

    const urls = calls.map(({ url }) => new URL(url));
    expect(urls.map((url) => `${url.origin}${url.pathname}`)).toEqual([
      `${SHIPPING_API_URL}/shipping-methods/pickup-points`,
      `${SHIPPING_API_URL}/shipping-methods/pickup-points`,
    ]);
    const searchParams = urls.map((url) => Object.fromEntries(url.searchParams));
    expect(searchParams).toHaveLength(2);
    expect(searchParams).toEqual(
      expect.arrayContaining([
        { carrierCode: 'omniva', countryCode: 'LT', type: 'parcelMachine' },
        { carrierCode: 'unisend', countryCode: 'LT', type: 'parcelMachine' },
      ]),
    );

    const { payload } = await verifyAtNow(getBearerToken(calls.at(0)));
    expect(payload.accessKey).toBe(TEST_ACCESS_KEY);
  });

  it('merges both carriers into the storefront shape', async () => {
    const { fakeFetch } = pickupPointsFetch();

    const pickupPoints = await createClient({ fakeFetch }).getPickupPoints();

    expect(pickupPoints).toEqual(ALL_PICKUP_POINTS);
  });

  it('returns every point for an empty or blank query', async () => {
    const { fakeFetch } = pickupPointsFetch();
    const client = createClient({ fakeFetch });

    expect(await client.getPickupPoints({ query: '' })).toEqual(ALL_PICKUP_POINTS);
    expect(await client.getPickupPoints({ query: '   ' })).toEqual(ALL_PICKUP_POINTS);
  });

  it.each([
    ['city', 'kaunas', ['omniva-2']],
    ['name', 'AKROPOLIO', ['omniva-1']],
    ['address', 'tilžės', ['unisend-1']],
    ['carrier', 'Unisend', ['unisend-1']],
    ['Lithuanian letters case-insensitively', 'ŠIAULIAI', ['unisend-1']],
    ['words spread across fields', 'kaunas mega', ['omniva-2']],
    ['words in any order', 'paštomatas omniva vilnius', ['omniva-1']],
    ['another grammatical case of the word', 'akropolis', ['omniva-1']],
    ['a city in the genitive', 'kauno', ['omniva-2']],
    ['a genitive -aus city', 'vilniaus', ['omniva-1']],
    ['a city typed without Lithuanian letters', 'siauliai', ['unisend-1']],
    ['an address typed without Lithuanian letters', 'TILZES', ['unisend-1']],
    ['a genitive typed without Lithuanian letters', 'siauliu saules', ['unisend-1']],
    ['a query with Lithuanian letters against a plain field', 'omnivą', ['omniva-1', 'omniva-2']],
    ['every word, not any word', 'kaunas akropolis', []],
  ])('filters by %s', async (_label, query, ids) => {
    const { fakeFetch } = pickupPointsFetch();

    const pickupPoints = await createClient({ fakeFetch }).getPickupPoints({ query });

    expect(pickupPoints.map(({ id }) => id)).toEqual(ids);
  });

  it('serves repeated searches from a short-lived cache', async () => {
    let now = NOW;
    const { calls, fakeFetch } = pickupPointsFetch();
    const client = createClient({ fakeFetch, now: () => now });

    await client.getPickupPoints({ query: 'vil' });
    await client.getPickupPoints({ query: 'vilnius' });
    expect(calls).toHaveLength(2);

    now = new Date(NOW.getTime() + 60 * 60 * 1000);
    await client.getPickupPoints({ query: 'vilnius' });
    expect(calls).toHaveLength(4);
  });

  it('throws when the shipping API answers with an error', async () => {
    const { fakeFetch } = createFakeFetch(() => jsonResponse({ message: 'Unauthorized' }, 401));

    await expect(createClient({ fakeFetch }).getPickupPoints()).rejects.toThrow();
  });
});
