import type { PaymentStatus } from '@prisma/client';
import { type DeliveryMethod, getShippingPrice } from '@/lib/delivery-config';
import { CENTS_PER_EURO, getOrderItemTotal, getProductPricing, resolveVariantPrices } from '@/lib/product-pricing';
import { DEFAULT_COMBINATION_KEY, getSellableVariants } from '@/lib/product-variant';
import type { VariantOption } from '@/lib/variant-label';
import { z } from 'zod';

type LineKey = {
  productId: string;
  variantId?: string;
};

const lineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  quantity: z.number().int().positive(),
});

const checkoutRequestSchema = z.object({
  lines: z.array(lineSchema).min(1).refine(hasUniqueLines),
  contact: z.object({ firstName: z.string(), lastName: z.string(), email: z.string(), phone: z.string() }),
  delivery: z.discriminatedUnion('method', [
    z.object({ method: z.literal('locker'), pickupPointId: z.string() }),
    z.object({
      method: z.literal('courier'),
      address: z.object({
        street: z.string(),
        apartment: z.string().optional(),
        city: z.string(),
        postalCode: z.string(),
      }),
    }),
  ]),
  payment: z.discriminatedUnion('method', [
    z.object({ method: z.literal('bank'), bankCode: z.string() }),
    z.object({ method: z.literal('card') }),
  ]),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export type CheckoutRequestResult =
  | { status: 'ok'; request: CheckoutRequest }
  | { status: 'rejected'; error: { code: 'INVALID_REQUEST' } };

export const parseCheckoutRequest = (body: unknown): CheckoutRequestResult => {
  const result = checkoutRequestSchema.safeParse(body);

  if (!result.success) {
    return { status: 'rejected', error: { code: 'INVALID_REQUEST' } };
  }

  return { status: 'ok', request: result.data };
};

function hasUniqueLines(lines: LineKey[]) {
  const keys = new Set(lines.map(getLineKey));

  return keys.size === lines.length;
}

function getLineKey({ productId, variantId }: LineKey) {
  return JSON.stringify([productId, variantId ?? null]);
}

type PriceLike = Parameters<typeof getProductPricing>[0]['price'];

type CheckoutVariant = {
  id: string;
  sku: string | null;
  price: PriceLike;
  salePrice: PriceLike;
  isArchived: boolean;
  combinationKey: string;
  optionValues: { optionValue: { label: string; groupId: string } }[];
};

type CheckoutProduct = {
  id: string;
  name: string;
  price: PriceLike;
  salePrice: PriceLike;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  isArchived: boolean;
  optionGroups: { group: { id: string; name: string } }[];
  variants: CheckoutVariant[];
};

type ResolveCheckoutItemsOptions = {
  lines: CheckoutRequest['lines'];
  products: CheckoutProduct[];
  now?: Date;
};

export type CheckoutItem = {
  productId: string;
  variantId: string;
  lineKey: LineKey;
  quantity: number;
  productName: string;
  sku: string | null;
  options: VariantOption[];
  unitPrice: number;
  regularUnitPrice: number;
};

export type InvalidItemReason = 'NOT_FOUND' | 'UNAVAILABLE' | 'VARIANT_REQUIRED' | 'VARIANT_NOT_ALLOWED';

export type InvalidItem = LineKey & { reason: InvalidItemReason };

export type CheckoutItemsResult =
  | { status: 'ok'; items: CheckoutItem[] }
  | { status: 'rejected'; error: { code: 'INVALID_ITEMS'; items: InvalidItem[] } };

// A missing variantId means the product's default variant (ADR 0001).
export const resolveCheckoutItems = ({
  lines,
  products,
  now = new Date(),
}: ResolveCheckoutItemsOptions): CheckoutItemsResult => {
  const productById = new Map(products.map((product) => [product.id, product]));
  const items: CheckoutItem[] = [];
  const invalidItems: InvalidItem[] = [];

  lines.forEach(({ quantity, ...line }) => {
    const lineKey = toLineKey(line);
    const resolution = resolveLine({ product: productById.get(line.productId), variantId: line.variantId });

    if (resolution.status === 'invalid') {
      invalidItems.push({ ...lineKey, reason: resolution.reason });
      return;
    }

    items.push(toCheckoutItem({ ...resolution, lineKey, quantity, now }));
  });

  if (invalidItems.length > 0) {
    return { status: 'rejected', error: { code: 'INVALID_ITEMS', items: invalidItems } };
  }

  return { status: 'ok', items };
};

const resolveLine = ({
  product,
  variantId,
}: {
  product: CheckoutProduct | undefined;
  variantId: string | undefined;
}) => {
  if (!product) {
    return invalidLine('NOT_FOUND');
  }

  if (product.isArchived) {
    return invalidLine('UNAVAILABLE');
  }

  const sellableVariants = getSellableVariants({
    hasOptionGroups: product.optionGroups.length > 0,
    variants: product.variants,
  });

  if (variantId === undefined) {
    if (!sellableVariants.hasOptions) {
      return resolvedLine({ product, variant: sellableVariants.defaultVariant });
    }

    return invalidLine(sellableVariants.optionVariants.length > 0 ? 'VARIANT_REQUIRED' : 'UNAVAILABLE');
  }

  if (!sellableVariants.hasOptions) {
    return invalidLine('VARIANT_NOT_ALLOWED');
  }

  const variant = product.variants.find(
    ({ id, combinationKey }) => id === variantId && combinationKey !== DEFAULT_COMBINATION_KEY,
  );

  if (!variant) {
    return invalidLine('NOT_FOUND');
  }

  if (variant.isArchived) {
    return invalidLine('UNAVAILABLE');
  }

  return resolvedLine({ product, variant });
};

const invalidLine = (reason: InvalidItemReason) => ({ status: 'invalid', reason }) as const;

const resolvedLine = ({ product, variant }: { product: CheckoutProduct; variant: CheckoutVariant }) =>
  ({ status: 'resolved', product, variant }) as const;

const toLineKey = ({ productId, variantId }: LineKey) => {
  return variantId === undefined ? { productId } : { productId, variantId };
};

const toCheckoutItem = ({
  product,
  variant,
  lineKey,
  quantity,
  now,
}: {
  product: CheckoutProduct;
  variant: CheckoutVariant;
  lineKey: LineKey;
  quantity: number;
  now: Date;
}) => {
  const pricing = getProductPricing({ ...product, ...resolveVariantPrices({ product, variant }) }, now);

  return {
    productId: product.id,
    variantId: variant.id,
    lineKey,
    quantity,
    productName: product.name,
    sku: variant.sku,
    options: getVariantOptions({ product, variant }),
    unitPrice: pricing.effectivePrice,
    regularUnitPrice: pricing.regularPrice,
  };
};

const getVariantOptions = ({ product, variant }: { product: CheckoutProduct; variant: CheckoutVariant }) => {
  return product.optionGroups.flatMap(({ group }) => {
    const value = variant.optionValues.find(({ optionValue }) => optionValue.groupId === group.id);

    return value ? [{ name: group.name, value: value.optionValue.label }] : [];
  });
};

type StockChangedOptions = {
  items: CheckoutItem[];
  stockCounts: { variantId: string; stockCount: number }[];
};

export type StockChangedItem = LineKey & { availableCount: number };

export const getStockChangedItems = ({ items, stockCounts }: StockChangedOptions): StockChangedItem[] => {
  const stockCountByVariantId = new Map(stockCounts.map(({ variantId, stockCount }) => [variantId, stockCount]));

  return items.flatMap(({ variantId, lineKey, quantity }) => {
    const availableCount = stockCountByVariantId.get(variantId) ?? 0;

    if (quantity <= availableCount) {
      return [];
    }

    return [{ ...lineKey, availableCount }];
  });
};

type ValidateCheckoutFieldsOptions<TPickupPoint extends { id: string }, TBank extends { code: string }> = {
  contact: CheckoutRequest['contact'];
  delivery: CheckoutRequest['delivery'];
  payment: CheckoutRequest['payment'];
  pickupPoints: TPickupPoint[];
  banks: TBank[];
};

export type CheckoutField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'pickupPoint'
  | 'street'
  | 'city'
  | 'postalCode'
  | 'payment';

export type FieldErrorReason = 'REQUIRED' | 'INVALID_FORMAT' | 'NOT_FOUND';

export type FieldError = { field: CheckoutField; reason: FieldErrorReason };

export type CourierAddress = {
  street: string;
  apartment?: string;
  city: string;
  postalCode: string;
};

export type CheckoutFieldsResult<TPickupPoint, TBank> =
  | {
      status: 'ok';
      contact: CheckoutRequest['contact'];
      delivery: { method: 'locker'; pickupPoint: TPickupPoint } | { method: 'courier'; address: CourierAddress };
      payment: { method: 'bank'; bank: TBank } | { method: 'card' };
    }
  | { status: 'rejected'; error: { code: 'INVALID_FIELDS'; fields: FieldError[] } };

export type ValidCheckoutFields<TPickupPoint, TBank> = Extract<
  CheckoutFieldsResult<TPickupPoint, TBank>,
  { status: 'ok' }
>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_DIGITS_PATTERN = /^\d{8}$/;
const POSTAL_CODE_PATTERN = /^(LT-?)?(\d{5})$/i;
const POSTAL_CODE_DIGITS_GROUP = 2;
const POSTAL_CODE_PREFIX = 'LT-';
const PHONE_COUNTRY_CODE = '370';
const PHONE_TRUNK_PREFIX = '8';
const NATIONAL_PHONE_LENGTH = 8;

export const validateCheckoutFields = <TPickupPoint extends { id: string }, TBank extends { code: string }>({
  contact,
  delivery,
  payment,
  pickupPoints,
  banks,
}: ValidateCheckoutFieldsOptions<TPickupPoint, TBank>): CheckoutFieldsResult<TPickupPoint, TBank> => {
  const fields: FieldError[] = [];
  const addError = (field: CheckoutField, reason: FieldErrorReason) => fields.push({ field, reason });
  const firstName = contact.firstName.trim();
  const lastName = contact.lastName.trim();
  const email = contact.email.trim();
  const phone = normalizePhone(contact.phone);

  if (!firstName) {
    addError('firstName', 'REQUIRED');
  }

  if (!lastName) {
    addError('lastName', 'REQUIRED');
  }

  if (!email) {
    addError('email', 'REQUIRED');
  } else if (!EMAIL_PATTERN.test(email)) {
    addError('email', 'INVALID_FORMAT');
  }

  if (!contact.phone.trim()) {
    addError('phone', 'REQUIRED');
  } else if (!PHONE_DIGITS_PATTERN.test(phone)) {
    addError('phone', 'INVALID_FORMAT');
  }

  const validDelivery = validateDelivery({ delivery, pickupPoints, addError });
  const validPayment = validatePayment({ payment, banks, addError });

  if (fields.length > 0 || !validDelivery || !validPayment) {
    return { status: 'rejected', error: { code: 'INVALID_FIELDS', fields } };
  }

  return {
    status: 'ok',
    contact: { firstName, lastName, email, phone: `+${PHONE_COUNTRY_CODE}${phone}` },
    delivery: validDelivery,
    payment: validPayment,
  };
};

type AddFieldError = (field: CheckoutField, reason: FieldErrorReason) => void;

const validateDelivery = <TPickupPoint extends { id: string }>({
  delivery,
  pickupPoints,
  addError,
}: {
  delivery: CheckoutRequest['delivery'];
  pickupPoints: TPickupPoint[];
  addError: AddFieldError;
}) => {
  if (delivery.method === 'locker') {
    const pickupPointId = delivery.pickupPointId.trim();
    const pickupPoint = pickupPoints.find(({ id }) => id === pickupPointId);

    if (!pickupPointId) {
      addError('pickupPoint', 'REQUIRED');
      return null;
    }

    if (!pickupPoint) {
      addError('pickupPoint', 'NOT_FOUND');
      return null;
    }

    return { method: delivery.method, pickupPoint };
  }

  const street = delivery.address.street.trim();
  const apartment = delivery.address.apartment?.trim();
  const city = delivery.address.city.trim();
  const postalCode = delivery.address.postalCode.trim();
  const postalCodeDigits = postalCode.match(POSTAL_CODE_PATTERN)?.at(POSTAL_CODE_DIGITS_GROUP);

  if (!street) {
    addError('street', 'REQUIRED');
  }

  if (!city) {
    addError('city', 'REQUIRED');
  }

  if (!postalCode) {
    addError('postalCode', 'REQUIRED');
  } else if (!postalCodeDigits) {
    addError('postalCode', 'INVALID_FORMAT');
  }

  if (!street || !city || !postalCodeDigits) {
    return null;
  }

  const address = {
    street,
    ...(apartment ? { apartment } : {}),
    city,
    postalCode: `${POSTAL_CODE_PREFIX}${postalCodeDigits}`,
  };

  return { method: delivery.method, address };
};

const validatePayment = <TBank extends { code: string }>({
  payment,
  banks,
  addError,
}: {
  payment: CheckoutRequest['payment'];
  banks: TBank[];
  addError: AddFieldError;
}) => {
  if (payment.method === 'card') {
    return { method: payment.method };
  }

  const bankCode = payment.bankCode.trim();
  const bank = banks.find(({ code }) => code === bankCode);

  if (!bankCode) {
    addError('payment', 'REQUIRED');
    return null;
  }

  if (!bank) {
    addError('payment', 'NOT_FOUND');
    return null;
  }

  return { method: payment.method, bank };
};

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, '');

  if (digits.startsWith(PHONE_COUNTRY_CODE) && digits.length === PHONE_COUNTRY_CODE.length + NATIONAL_PHONE_LENGTH) {
    return digits.slice(PHONE_COUNTRY_CODE.length);
  }

  if (digits.startsWith(PHONE_TRUNK_PREFIX) && digits.length === PHONE_TRUNK_PREFIX.length + NATIONAL_PHONE_LENGTH) {
    return digits.slice(PHONE_TRUNK_PREFIX.length);
  }

  return digits;
};

type CheckoutTotalsOptions = {
  items: CheckoutItem[];
  deliveryMethod: DeliveryMethod;
};

export type CheckoutTotals = {
  itemsTotal: number;
  shippingPrice: number;
  total: number;
};

export const getCheckoutTotals = ({ items, deliveryMethod }: CheckoutTotalsOptions): CheckoutTotals => {
  const itemsTotalCents = items.reduce((sum, item) => sum + toCents(getOrderItemTotal(item)), 0);
  const itemsTotal = itemsTotalCents / CENTS_PER_EURO;
  const shippingPrice = getShippingPrice({ method: deliveryMethod, itemsTotal });

  return {
    itemsTotal,
    shippingPrice,
    total: (itemsTotalCents + toCents(shippingPrice)) / CENTS_PER_EURO,
  };
};

const toCents = (euros: number) => Math.round(euros * CENTS_PER_EURO);

type StorefrontOrderStatusOptions = {
  paymentStatus: PaymentStatus;
  stockReleasedAt: Date | null;
};

export type StorefrontOrderStatus = 'paid' | 'pending' | 'failed';

// A flagged late payment still counts as paid. AUTHORIZED isn't settled money yet, so it reads like PENDING.
export const getStorefrontOrderStatus = ({
  paymentStatus,
  stockReleasedAt,
}: StorefrontOrderStatusOptions): StorefrontOrderStatus => {
  switch (paymentStatus) {
    case 'PAID':
    case 'PARTIALLY_REFUNDED':
    case 'REFUNDED':
      return 'paid';
    case 'ABANDONED':
    case 'VOIDED':
      return 'failed';
    case 'PENDING':
    case 'AUTHORIZED':
      return stockReleasedAt ? 'failed' : 'pending';
  }
};

type WebhookOrderState = {
  isPaid: boolean;
  paymentStatus: PaymentStatus;
  stockReleasedAt: Date | null;
};

type WebhookActionOptions = {
  order: WebhookOrderState;
  status: PaymentStatus;
};

export type WebhookAction =
  | { type: 'none' }
  | { type: 'mark-paid' }
  | { type: 'late-payment' }
  | { type: 'abandon' }
  | { type: 'flag-voided' }
  | { type: 'mirror'; paymentStatus: PaymentStatus };

const NO_ACTION = { type: 'none' } as const;

export const getWebhookAction = ({ order, status }: WebhookActionOptions): WebhookAction => {
  if (status === order.paymentStatus) {
    return NO_ACTION;
  }

  switch (status) {
    case 'PAID':
      return getPaidAction(order);
    case 'ABANDONED':
      return order.isPaid ? NO_ACTION : { type: 'abandon' };
    case 'VOIDED':
      return order.isPaid ? { type: 'flag-voided' } : { type: 'mirror', paymentStatus: status };
    case 'PARTIALLY_REFUNDED':
    case 'REFUNDED':
      return { type: 'mirror', paymentStatus: status };
    case 'AUTHORIZED':
      return order.isPaid ? NO_ACTION : { type: 'mirror', paymentStatus: status };
    case 'PENDING':
      return NO_ACTION;
  }
};

const getPaidAction = (order: WebhookOrderState) => {
  if (order.isPaid) {
    return NO_ACTION;
  }

  if (order.stockReleasedAt) {
    return { type: 'late-payment' } as const;
  }

  return { type: 'mark-paid' } as const;
};

type WebhookOrderMismatchOptions = {
  token: { uuid: string; grandTotal: number; currency: string };
  order: { montonioOrderUuid: string | null; total: number };
};

export type WebhookOrderMismatch = 'UUID_MISSING' | 'UUID' | 'AMOUNT' | 'CURRENCY';

const ORDER_CURRENCY = 'EUR';

export const getWebhookOrderMismatch = ({ token, order }: WebhookOrderMismatchOptions): WebhookOrderMismatch | null => {
  if (order.montonioOrderUuid === null) {
    return 'UUID_MISSING';
  }

  if (token.uuid !== order.montonioOrderUuid) {
    return 'UUID';
  }

  if (toCents(token.grandTotal) !== toCents(order.total)) {
    return 'AMOUNT';
  }

  if (token.currency !== ORDER_CURRENCY) {
    return 'CURRENCY';
  }

  return null;
};
