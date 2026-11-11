import type { PaymentStatus } from '@prisma/client';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

import { DELIVERY_CONFIG, type LockerCarrier } from '@/lib/delivery-config';
import type { MontonioOrderPayload } from '@/lib/montonio-order-payload';

type MontonioClientOptions = {
  apiUrl: string;
  shippingApiUrl: string;
  accessKey: string;
  secretKey: string;
  fetch?: typeof fetch;
  now?: () => Date;
};

export type CreateOrderResult =
  | { status: 'created'; uuid: string; paymentUrl: string }
  | { status: 'failed'; reason: 'HTTP_ERROR'; httpStatus: number }
  | { status: 'failed'; reason: 'NETWORK_ERROR' | 'INVALID_RESPONSE' };

const PAYMENT_STATUSES = [
  'PENDING',
  'PAID',
  'VOIDED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'ABANDONED',
  'AUTHORIZED',
] as const satisfies readonly PaymentStatus[];

const orderTokenSchema = z.object({
  accessKey: z.string(),
  uuid: z.string().min(1),
  merchantReference: z.string().min(1),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  grandTotal: z.number(),
  currency: z.string(),
});

const refundTokenSchema = z.object({ accessKey: z.string() });

export type MontonioOrderToken = Omit<z.infer<typeof orderTokenSchema>, 'accessKey'>;

export type VerifyOrderTokenResult =
  { status: 'valid'; order: MontonioOrderToken } | { status: 'invalid' } | { status: 'foreign-access-key' };

export type VerifyRefundTokenResult = { status: 'valid' } | { status: 'invalid' } | { status: 'foreign-access-key' };

const bankSchema = z.object({
  code: z.string(),
  name: z.string(),
  logoUrl: z.string().optional(),
  uiPosition: z.number().optional(),
  supportedCurrencies: z.array(z.string()).optional(),
});

const paymentMethodsResponseSchema = z.object({
  paymentMethods: z.object({
    paymentInitiation: z
      .object({
        setup: z.record(z.object({ paymentMethods: z.array(bankSchema) })),
      })
      .optional(),
    cardPayments: z.object({}).passthrough().optional(),
  }),
});

export type Bank = { code: string; name: string; logoUrl?: string };

export type PaymentMethods = { banks: Bank[]; isCardEnabled: boolean };

export class MontonioApiError extends Error {
  readonly httpStatus: number;

  constructor({ url, httpStatus }: { url: string; httpStatus: number }) {
    super(`Montonio request to ${url} failed with ${httpStatus}`);
    this.name = 'MontonioApiError';
    this.httpStatus = httpStatus;
  }
}

const pickupPointsResponseSchema = z.object({
  pickupPoints: z.array(
    z.object({ id: z.string(), name: z.string(), streetAddress: z.string(), locality: z.string() }),
  ),
});

export type PickupPoint = { id: string; carrier: LockerCarrier; name: string; address: string; city: string };

const LOCKER_CARRIERS = DELIVERY_CONFIG.options.flatMap((option) =>
  option.method === 'locker' ? option.carriers : [],
);

const CARRIER_CODES = {
  omniva: 'omniva',
  unisend: 'unisend',
} satisfies Record<LockerCarrier, string>;

const PICKUP_POINT_COUNTRY = 'LT';
const PICKUP_POINT_TYPE = 'parcelMachine';
const SEARCH_LOCALE = 'lt';
const WORD_ENDINGS = [
  'iaus',
  'iai',
  'ius',
  'iu',
  'ys',
  'is',
  'as',
  'us',
  'ai',
  'es',
  'os',
  'io',
  'a',
  'e',
  'o',
  'i',
  'u',
];
const PLAIN_LETTERS: Record<string, string> = {
  ą: 'a',
  č: 'c',
  ę: 'e',
  ė: 'e',
  į: 'i',
  š: 's',
  ų: 'u',
  ū: 'u',
  ž: 'z',
};
const LITHUANIAN_LETTER_PATTERN = /[ąčęėįšųūž]/g;
const MIN_STEM_LENGTH = 4;
const BANK_COUNTRY = 'LT';
const CURRENCY = 'EUR';
const CACHE_TTL_MILLISECONDS = 5 * 60 * 1000;
const JWT_ALGORITHM = 'HS256';
const REQUEST_TOKEN_TTL_SECONDS = 10 * 60;
const MILLISECONDS_PER_SECOND = 1000;

const createdOrderSchema = z.object({ uuid: z.string().min(1), paymentUrl: z.string().url() });

export type MontonioClient = ReturnType<typeof createMontonioClient>;

export const createMontonioClient = ({
  apiUrl,
  shippingApiUrl,
  accessKey,
  secretKey,
  fetch: fetchImpl = fetch,
  now = () => new Date(),
}: MontonioClientOptions) => {
  const secret = new TextEncoder().encode(secretKey);

  const signRequestToken = (payload: Record<string, unknown>) => {
    const nowSeconds = Math.floor(now().getTime() / MILLISECONDS_PER_SECOND);

    return new SignJWT({ ...payload, accessKey })
      .setProtectedHeader({ alg: JWT_ALGORITHM, typ: 'JWT' })
      .setIssuedAt(nowSeconds)
      .setExpirationTime(nowSeconds + REQUEST_TOKEN_TTL_SECONDS)
      .sign(secret);
  };

  const createOrder = async (payload: MontonioOrderPayload): Promise<CreateOrderResult> => {
    const token = await signRequestToken(payload);
    const response = await fetchImpl(`${apiUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ data: token }),
    }).catch(() => null);

    if (!response) {
      return { status: 'failed', reason: 'NETWORK_ERROR' };
    }

    if (!response.ok) {
      return { status: 'failed', reason: 'HTTP_ERROR', httpStatus: response.status };
    }

    const result = createdOrderSchema.safeParse(await response.json().catch(() => null));

    if (!result.success) {
      return { status: 'failed', reason: 'INVALID_RESPONSE' };
    }

    return { status: 'created', ...result.data };
  };

  const verifyToken = async (token: string) => {
    try {
      const { payload } = await jwtVerify(token, secret, { algorithms: [JWT_ALGORITHM], currentDate: now() });

      return payload;
    } catch {
      return null;
    }
  };

  const verifyOrderToken = async (token: string): Promise<VerifyOrderTokenResult> => {
    const result = orderTokenSchema.safeParse(await verifyToken(token));

    if (!result.success) {
      return { status: 'invalid' };
    }

    const { accessKey: tokenAccessKey, ...order } = result.data;

    if (tokenAccessKey !== accessKey) {
      return { status: 'foreign-access-key' };
    }

    return { status: 'valid', order };
  };

  const verifyRefundToken = async (token: string): Promise<VerifyRefundTokenResult> => {
    const result = refundTokenSchema.safeParse(await verifyToken(token));

    if (!result.success) {
      return { status: 'invalid' };
    }

    if (result.data.accessKey !== accessKey) {
      return { status: 'foreign-access-key' };
    }

    return { status: 'valid' };
  };

  const getJson = async (url: string) => {
    const token = await signRequestToken({});
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new MontonioApiError({ url, httpStatus: response.status });
    }

    return response.json();
  };

  const paymentMethodsCache = createCache<PaymentMethods>(now);

  const getPaymentMethods = () =>
    paymentMethodsCache.get(async () => {
      const response = paymentMethodsResponseSchema.parse(await getJson(`${apiUrl}/stores/payment-methods`));

      return toPaymentMethods(response);
    });

  const pickupPointsCache = createCache<PickupPoint[]>(now);

  const getCarrierPickupPoints = async (carrier: LockerCarrier) => {
    const searchParams = new URLSearchParams({
      carrierCode: CARRIER_CODES[carrier],
      countryCode: PICKUP_POINT_COUNTRY,
      type: PICKUP_POINT_TYPE,
    });
    const url = `${shippingApiUrl}/shipping-methods/pickup-points?${searchParams}`;
    const { pickupPoints } = pickupPointsResponseSchema.parse(await getJson(url));

    return pickupPoints.map(({ id, name, streetAddress, locality }) => ({
      id,
      carrier,
      name,
      address: streetAddress,
      city: locality,
    }));
  };

  // Without a limit every match is returned; checkout validation relies on that.
  const getPickupPoints = async ({ query = '', limit }: { query?: string; limit?: number } = {}) => {
    const pickupPoints = await pickupPointsCache.get(async () => {
      const carrierPickupPoints = await Promise.all(LOCKER_CARRIERS.map(getCarrierPickupPoints));

      return carrierPickupPoints.flat();
    });

    const matches = filterPickupPoints({ pickupPoints, query });

    if (limit === undefined) {
      return matches;
    }

    // Alternate carriers so a broad query shows both, not just the first carrier's points.
    return interleaveCarriers(matches).slice(0, limit);
  };

  return { createOrder, verifyOrderToken, verifyRefundToken, getPaymentMethods, getPickupPoints };
};

const montonioEnvSchema = z.object({
  MONTONIO_API_URL: z.string().url(),
  MONTONIO_SHIPPING_API_URL: z.string().url(),
  MONTONIO_ACCESS_KEY: z.string().min(1),
  MONTONIO_SECRET_KEY: z.string().min(1),
});

let sharedClient: MontonioClient | null = null;

export const getMontonioClient = (): MontonioClient => {
  if (sharedClient) {
    return sharedClient;
  }

  const env = montonioEnvSchema.parse(process.env);
  sharedClient = createMontonioClient({
    apiUrl: env.MONTONIO_API_URL,
    shippingApiUrl: env.MONTONIO_SHIPPING_API_URL,
    accessKey: env.MONTONIO_ACCESS_KEY,
    secretKey: env.MONTONIO_SECRET_KEY,
  });

  return sharedClient;
};

const toPaymentMethods = ({ paymentMethods }: z.infer<typeof paymentMethodsResponseSchema>) => {
  const banks = (paymentMethods.paymentInitiation?.setup[BANK_COUNTRY]?.paymentMethods ?? [])
    .filter(({ supportedCurrencies }) => !supportedCurrencies || supportedCurrencies.includes(CURRENCY))
    .toSorted((a, b) => (a.uiPosition ?? Infinity) - (b.uiPosition ?? Infinity))
    .map(({ code, name, logoUrl }) => ({ code, name, ...(logoUrl ? { logoUrl } : {}) }));

  return { banks, isCardEnabled: paymentMethods.cardPayments !== undefined };
};

const createCache = <T>(now: () => Date) => {
  let entry: { value: Promise<T>; expiresAt: number } | null = null;

  const get = (load: () => Promise<T>) => {
    const nowMilliseconds = now().getTime();

    if (entry && entry.expiresAt > nowMilliseconds) {
      return entry.value;
    }

    const value = load();
    const loadingEntry = { value, expiresAt: nowMilliseconds + CACHE_TTL_MILLISECONDS };
    entry = loadingEntry;
    value.catch(() => {
      if (entry === loadingEntry) {
        entry = null;
      }
    });

    return value;
  };

  return { get };
};

const filterPickupPoints = ({ pickupPoints, query }: { pickupPoints: PickupPoint[]; query: string }) => {
  const stems = toSearchText(query).split(/\s+/).filter(Boolean).map(toStem);

  if (stems.length === 0) {
    return pickupPoints;
  }

  return pickupPoints.filter(({ city, name, address, carrier }) => {
    const searchableText = toSearchText([city, name, address, carrier].join(' '));

    return stems.every((stem) => searchableText.includes(stem));
  });
};

const interleaveCarriers = (pickupPoints: PickupPoint[]) => {
  const pointsByCarrier = LOCKER_CARRIERS.map((carrier) =>
    pickupPoints.filter((pickupPoint) => pickupPoint.carrier === carrier),
  );
  const roundCount = Math.max(0, ...pointsByCarrier.map(({ length }) => length));

  return Array.from({ length: roundCount }, (_, round) =>
    pointsByCarrier.flatMap((carrierPoints) => carrierPoints.slice(round, round + 1)),
  ).flat();
};

const toStem = (word: string) => {
  const ending = WORD_ENDINGS.find(
    (wordEnding) => word.endsWith(wordEnding) && word.length - wordEnding.length >= MIN_STEM_LENGTH,
  );

  return ending ? word.slice(0, -ending.length) : word;
};

const toSearchText = (text: string) =>
  text.toLocaleLowerCase(SEARCH_LOCALE).replace(LITHUANIAN_LETTER_PATTERN, (letter) => PLAIN_LETTERS[letter] ?? letter);
