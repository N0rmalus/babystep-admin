import type { CheckoutTotals, CourierAddress } from '@/lib/checkout-rules';
import { RESERVATION_MINUTES } from '@/lib/reservation-config';
import { getOrderItemText, type VariantOption } from '@/lib/variant-label';

type PayloadItem = {
  productName: string;
  options: VariantOption[];
  unitPrice: number;
  quantity: number;
};

type PayloadContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type PayloadDelivery =
  | { method: 'locker'; pickupPoint: { name: string; address: string; city: string } }
  | { method: 'courier'; address: CourierAddress };

type PayloadPayment = { method: 'bank'; bank: { code: string } } | { method: 'card' };

type MontonioOrderPayloadOptions = {
  order: { id: string; number: number };
  items: PayloadItem[];
  totals: CheckoutTotals;
  contact: PayloadContact;
  delivery: PayloadDelivery;
  payment: PayloadPayment;
  returnUrl: string;
  notificationUrl: string;
};

type MontonioLineItem = {
  name: string;
  quantity: number;
  finalPrice: number;
};

type MontonioAddress = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  phoneCountry: string;
  addressLine1?: string;
  addressLine2?: string;
  locality?: string;
  postalCode?: string;
  country?: string;
};

type MontonioPayment =
  | {
      method: 'paymentInitiation';
      amount: number;
      currency: string;
      methodOptions: { preferredProvider: string; preferredCountry: string };
    }
  | { method: 'cardPayments'; amount: number; currency: string };

export type MontonioOrderPayload = {
  merchantReference: string;
  merchantReferenceDisplay: string;
  returnUrl: string;
  notificationUrl: string;
  locale: string;
  currency: string;
  expiresIn: number;
  grandTotal: number;
  lineItems: MontonioLineItem[];
  billingAddress: MontonioAddress;
  shippingAddress: MontonioAddress;
  payment: MontonioPayment;
};

export const ORDER_NUMBER_PREFIX = 'U-';

const LOCALE = 'lt';
const CURRENCY = 'EUR';
const COUNTRY = 'LT';
const SHIPPING_LINE_NAME = 'Pristatymas';
const SHIPPING_LINE_QUANTITY = 1;

export const buildMontonioOrderPayload = ({
  order,
  items,
  totals,
  contact,
  delivery,
  payment,
  returnUrl,
  notificationUrl,
}: MontonioOrderPayloadOptions): MontonioOrderPayload => {
  const contactAddress = {
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phoneNumber: contact.phone,
    phoneCountry: COUNTRY,
  };
  const shippingAddress = { ...contactAddress, ...getDeliveryAddress(delivery) };

  return {
    merchantReference: order.id,
    merchantReferenceDisplay: `${ORDER_NUMBER_PREFIX}${order.number}`,
    returnUrl,
    notificationUrl,
    locale: LOCALE,
    currency: CURRENCY,
    expiresIn: RESERVATION_MINUTES,
    grandTotal: totals.total,
    lineItems: getLineItems({ items, shippingPrice: totals.shippingPrice }),
    billingAddress: delivery.method === 'courier' ? shippingAddress : contactAddress,
    shippingAddress,
    payment: getPayment({ payment, amount: totals.total }),
  };
};

const getLineItems = ({ items, shippingPrice }: { items: PayloadItem[]; shippingPrice: number }) => {
  const lineItems = items.map(({ productName, options, unitPrice, quantity }) => ({
    name: getOrderItemText({ productName, options }),
    quantity,
    finalPrice: unitPrice,
  }));

  if (shippingPrice <= 0) {
    return lineItems;
  }

  return [...lineItems, { name: SHIPPING_LINE_NAME, quantity: SHIPPING_LINE_QUANTITY, finalPrice: shippingPrice }];
};

const getDeliveryAddress = (delivery: PayloadDelivery) => {
  if (delivery.method === 'locker') {
    return {
      addressLine1: delivery.pickupPoint.address,
      locality: delivery.pickupPoint.city,
      country: COUNTRY,
    };
  }

  const { street, apartment, city, postalCode } = delivery.address;

  return {
    addressLine1: street,
    ...(apartment ? { addressLine2: apartment } : {}),
    locality: city,
    postalCode,
    country: COUNTRY,
  };
};

const getPayment = ({ payment, amount }: { payment: PayloadPayment; amount: number }): MontonioPayment => {
  if (payment.method === 'card') {
    return { method: 'cardPayments', amount, currency: CURRENCY };
  }

  return {
    method: 'paymentInitiation',
    amount,
    currency: CURRENCY,
    methodOptions: { preferredProvider: payment.bank.code, preferredCountry: COUNTRY },
  };
};
