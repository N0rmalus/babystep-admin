import type { Carrier, DeliveryMethod, PaymentStatus, Prisma, ReviewReason } from '@prisma/client';

import { ORDER_NUMBER_PREFIX } from '@/lib/montonio-order-payload';
import { formatter } from '@/lib/utils';
import { getOrderItemText } from '@/lib/variant-label';

export const ADMIN_ORDER_SELECT = {
  id: true,
  number: true,
  createdAt: true,
  paymentStatus: true,
  stockReleasedAt: true,
  needsReview: true,
  reviewReason: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  deliveryMethod: true,
  carrier: true,
  pickupPointName: true,
  pickupPointAddress: true,
  pickupPointCity: true,
  street: true,
  apartment: true,
  city: true,
  postalCode: true,
  itemsTotal: true,
  shippingPrice: true,
  total: true,
  orderItems: { select: { id: true, quantity: true, productName: true, options: true } },
} satisfies Prisma.OrderSelect;

export type AdminOrderRow = Prisma.OrderGetPayload<{ select: typeof ADMIN_ORDER_SELECT }>;

type AdminOrderDelivery = {
  method: string;
  carrier: string;
  destination: string;
};

export type AdminOrder = {
  id: string;
  number: string;
  createdAt: string;
  customer: { name: string; email: string; phone: string };
  delivery: AdminOrderDelivery | null;
  items: { id: string; text: string; quantity: number }[];
  itemsTotal: string;
  shippingPrice: string;
  total: string;
  paymentStatus: AdminPaymentStatus;
  review: AdminOrderReview | null;
};

type AdminOrderReview = {
  reason: string | null;
};

type PaymentStatusOptions = {
  paymentStatus: PaymentStatus;
  stockReleasedAt: Date | null;
};

export const PAYMENT_STATUS_LABELS = {
  paid: 'Apmokėta',
  pending: 'Laukiama apmokėjimo',
  unfinished: 'Nebaigtas',
  voided: 'Atmesta',
  refunded: 'Grąžinta',
  partiallyRefunded: 'Grąžinta dalis',
} as const;

export type AdminPaymentStatus = keyof typeof PAYMENT_STATUS_LABELS;

const REVIEW_REASON_LABELS = {
  LATE_PAYMENT_OUT_OF_STOCK: 'Apmokėta po rezervacijos pabaigos, prekių neliko',
  VOIDED_AFTER_PAID: 'Bankas atmetė apmokėtą mokėjimą',
} satisfies Record<ReviewReason, string>;

const DELIVERY_METHOD_LABELS = {
  LOCKER: 'Paštomatas',
  COURIER: 'Kurjeris',
} satisfies Record<DeliveryMethod, string>;

const CARRIER_LABELS = {
  OMNIVA: 'Omniva',
  UNISEND: 'Unisend',
  SMARTPOSTI: 'SmartPosti',
} satisfies Record<Carrier, string>;

const DATE_FORMATTER = new Intl.DateTimeFormat('lt-LT', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Vilnius',
});

const DESTINATION_SEPARATOR = ', ';
const WORD_SEPARATOR = ' ';
const APARTMENT_SEPARATOR = '-';

export const toAdminOrder = (order: AdminOrderRow): AdminOrder => {
  return {
    id: order.id,
    number: `${ORDER_NUMBER_PREFIX}${order.number}`,
    createdAt: DATE_FORMATTER.format(order.createdAt),
    customer: {
      name: joinParts([order.firstName, order.lastName], WORD_SEPARATOR),
      email: order.email,
      phone: order.phoneNumber,
    },
    delivery: getDelivery(order),
    items: order.orderItems.map(({ id, quantity, ...snapshot }) => ({
      id,
      text: getOrderItemText(snapshot),
      quantity,
    })),
    itemsTotal: formatter.format(order.itemsTotal.toNumber()),
    shippingPrice: formatter.format(order.shippingPrice.toNumber()),
    total: formatter.format(order.total.toNumber()),
    paymentStatus: getAdminPaymentStatus(order),
    review: getReview(order),
  };
};

export const getAdminPaymentStatus = ({ paymentStatus, stockReleasedAt }: PaymentStatusOptions): AdminPaymentStatus => {
  switch (paymentStatus) {
    case 'PAID':
      return 'paid';
    case 'VOIDED':
      return 'voided';
    case 'REFUNDED':
      return 'refunded';
    case 'PARTIALLY_REFUNDED':
      return 'partiallyRefunded';
    case 'ABANDONED':
      return 'unfinished';
    case 'PENDING':
    case 'AUTHORIZED':
      return stockReleasedAt ? 'unfinished' : 'pending';
  }
};

const getReview = ({ needsReview, reviewReason }: AdminOrderRow) => {
  if (!needsReview) {
    return null;
  }

  return { reason: reviewReason ? REVIEW_REASON_LABELS[reviewReason] : null };
};

const getDelivery = (order: AdminOrderRow) => {
  if (!order.deliveryMethod || !order.carrier) {
    return null;
  }

  return {
    method: DELIVERY_METHOD_LABELS[order.deliveryMethod],
    carrier: CARRIER_LABELS[order.carrier],
    destination: getDestination(order),
  };
};

const getDestination = (order: AdminOrderRow) => {
  if (order.deliveryMethod === 'COURIER') {
    const cityLine = joinParts([order.postalCode, order.city], WORD_SEPARATOR);

    return joinParts([getStreetLine(order), cityLine], DESTINATION_SEPARATOR);
  }

  return joinParts([order.pickupPointName, order.pickupPointAddress, order.pickupPointCity], DESTINATION_SEPARATOR);
};

const getStreetLine = ({ street, apartment }: AdminOrderRow) => {
  if (!street || !apartment) {
    return street;
  }

  return `${street}${APARTMENT_SEPARATOR}${apartment}`;
};

const joinParts = (parts: (string | null)[], separator: string) => parts.filter(Boolean).join(separator);
