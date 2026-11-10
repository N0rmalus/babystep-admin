import type { Carrier, Prisma } from '@prisma/client';

import { type CourierAddress, getStorefrontOrderStatus, type StorefrontOrderStatus } from '@/lib/checkout-rules';
import type { CourierCarrier, LockerCarrier } from '@/lib/delivery-config';
import type { PickupPoint } from '@/lib/montonio-client';
import { ORDER_NUMBER_PREFIX } from '@/lib/montonio-order-payload';
import { CENTS_PER_EURO, getOrderItemTotal } from '@/lib/product-pricing';
import { DEFAULT_COMBINATION_KEY } from '@/lib/product-variant';
import { getOrderItemText } from '@/lib/variant-label';

export const STOREFRONT_ORDER_SELECT = {
  id: true,
  number: true,
  paymentStatus: true,
  isPaid: true,
  stockReleasedAt: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  deliveryMethod: true,
  carrier: true,
  pickupPointId: true,
  pickupPointName: true,
  pickupPointAddress: true,
  pickupPointCity: true,
  street: true,
  apartment: true,
  city: true,
  postalCode: true,
  paymentMethod: true,
  bankName: true,
  itemsTotal: true,
  shippingPrice: true,
  total: true,
  orderItems: {
    select: {
      productId: true,
      variantId: true,
      quantity: true,
      productName: true,
      options: true,
      unitPrice: true,
      product: {
        select: { images: { select: { url: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], take: 1 } },
      },
      variant: { select: { combinationKey: true } },
    },
  },
} satisfies Prisma.OrderSelect;

export type StorefrontOrderRow = Prisma.OrderGetPayload<{ select: typeof STOREFRONT_ORDER_SELECT }>;

type StorefrontOrderLine = {
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
  total: number;
  imageUrl: string | null;
};

type StorefrontOrderDelivery =
  | { method: 'locker'; carrier: LockerCarrier; pickupPoint: PickupPoint }
  | { method: 'courier'; carrier: CourierCarrier; address: CourierAddress };

type StorefrontOrderPayment = { method: 'bank'; bankName: string } | { method: 'card' };

export type StorefrontOrder = {
  id: string;
  number: string;
  status: StorefrontOrderStatus;
  email: string;
  recipient: { name: string; phone: string };
  lines: StorefrontOrderLine[];
  subtotal: number;
  deliveryPrice: number;
  total: number;
  delivery: StorefrontOrderDelivery;
  payment: StorefrontOrderPayment;
};

const LOCKER_CARRIERS = {
  OMNIVA: 'omniva',
  UNISEND: 'unisend',
} satisfies Partial<Record<Carrier, LockerCarrier>>;

const COURIER_CARRIER = 'smartposti' satisfies CourierCarrier;

export const toStorefrontOrder = (order: StorefrontOrderRow): StorefrontOrder | null => {
  const delivery = getDelivery(order);
  const payment = getPayment(order);

  if (!delivery || !payment) {
    return null;
  }

  return {
    id: order.id,
    number: `${ORDER_NUMBER_PREFIX}${order.number}`,
    status: getStorefrontOrderStatus(order),
    email: order.email,
    recipient: { name: `${order.firstName} ${order.lastName}`, phone: order.phoneNumber },
    lines: order.orderItems.map(toLine),
    subtotal: toEuros(order.itemsTotal),
    deliveryPrice: toEuros(order.shippingPrice),
    total: toEuros(order.total),
    delivery,
    payment,
  };
};

const toLine = (item: StorefrontOrderRow['orderItems'][number]) => {
  const isDefaultVariant = item.variant.combinationKey === DEFAULT_COMBINATION_KEY;

  return {
    productId: item.productId,
    ...(isDefaultVariant ? {} : { variantId: item.variantId }),
    name: getOrderItemText(item),
    quantity: item.quantity,
    total: getOrderItemTotal(item),
    imageUrl: item.product.images.at(0)?.url ?? null,
  };
};

const getDelivery = (order: StorefrontOrderRow) => {
  if (order.deliveryMethod === 'COURIER') {
    return getCourierDelivery(order);
  }

  if (order.deliveryMethod === 'LOCKER') {
    return getLockerDelivery(order);
  }

  return null;
};

const getCourierDelivery = ({ street, apartment, city, postalCode }: StorefrontOrderRow) => {
  if (!street || !city || !postalCode) {
    return null;
  }

  return {
    method: 'courier',
    carrier: COURIER_CARRIER,
    address: { street, ...(apartment ? { apartment } : {}), city, postalCode },
  } as const;
};

const getLockerDelivery = (order: StorefrontOrderRow) => {
  const { carrier, pickupPointId, pickupPointName, pickupPointAddress, pickupPointCity } = order;

  if (carrier !== 'OMNIVA' && carrier !== 'UNISEND') {
    return null;
  }

  if (!pickupPointId || !pickupPointName || !pickupPointAddress || !pickupPointCity) {
    return null;
  }

  const lockerCarrier = LOCKER_CARRIERS[carrier];

  return {
    method: 'locker',
    carrier: lockerCarrier,
    pickupPoint: {
      id: pickupPointId,
      carrier: lockerCarrier,
      name: pickupPointName,
      address: pickupPointAddress,
      city: pickupPointCity,
    },
  } as const;
};

const getPayment = ({ paymentMethod, bankName }: StorefrontOrderRow) => {
  if (paymentMethod === 'CARD') {
    return { method: 'card' } as const;
  }

  if (paymentMethod !== 'BANK' || !bankName) {
    return null;
  }

  return { method: 'bank', bankName } as const;
};

const toEuros = (amount: Prisma.Decimal) => Math.round(amount.toNumber() * CENTS_PER_EURO) / CENTS_PER_EURO;
