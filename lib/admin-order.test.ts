import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { type AdminOrderRow, getAdminPaymentStatus, PAYMENT_STATUS_LABELS, toAdminOrder } from '@/lib/admin-order';

const RELEASED_AT = new Date('2026-11-01T10:00:00Z');

const createOrder = (overrides: Partial<AdminOrderRow> = {}) =>
  ({
    id: 'order-1',
    number: 10001,
    createdAt: new Date('2026-11-01T09:30:00Z'),
    paymentStatus: 'PAID',
    stockReleasedAt: null,
    firstName: 'Ona',
    lastName: 'Onaitė',
    email: 'ona@example.test',
    phoneNumber: '+37061234567',
    deliveryMethod: 'LOCKER',
    carrier: 'OMNIVA',
    pickupPointName: 'Omniva Akropolis',
    pickupPointAddress: 'Ozo g. 25',
    pickupPointCity: 'Vilnius',
    street: null,
    apartment: null,
    city: null,
    postalCode: null,
    itemsTotal: new Prisma.Decimal('39.97'),
    shippingPrice: new Prisma.Decimal('3.49'),
    total: new Prisma.Decimal('43.46'),
    orderItems: [
      { id: 'item-1', quantity: 1, productName: 'Miego maišas', options: [] },
      { id: 'item-2', quantity: 2, productName: 'Muslino merliukas', options: [{ name: 'Dydis', value: '0–6 mėn.' }] },
    ],
    ...overrides,
  }) satisfies AdminOrderRow;

describe('toAdminOrder', () => {
  it('shows a locker order with its customer, pickup point, items and totals', () => {
    expect(toAdminOrder(createOrder())).toEqual({
      id: 'order-1',
      number: 'U-10001',
      createdAt: '2026-11-01 11:30',
      customer: { name: 'Ona Onaitė', email: 'ona@example.test', phone: '+37061234567' },
      delivery: { method: 'Paštomatas', carrier: 'Omniva', destination: 'Omniva Akropolis, Ozo g. 25, Vilnius' },
      items: [
        { id: 'item-1', text: 'Miego maišas', quantity: 1 },
        { id: 'item-2', text: 'Muslino merliukas – Dydis: 0–6 mėn.', quantity: 2 },
      ],
      itemsTotal: '39,97\u00a0€',
      shippingPrice: '3,49\u00a0€',
      total: '43,46\u00a0€',
      paymentStatus: 'paid',
    });
  });

  it.each([
    ['5', 'Gedimino pr. 1-5, 01103 Vilnius'],
    [null, 'Gedimino pr. 1, 01103 Vilnius'],
  ])('shows a courier order with its address (apartment %s)', (apartment, destination) => {
    const order = createOrder({
      deliveryMethod: 'COURIER',
      carrier: 'SMARTPOSTI',
      pickupPointName: null,
      pickupPointAddress: null,
      pickupPointCity: null,
      street: 'Gedimino pr. 1',
      apartment,
      city: 'Vilnius',
      postalCode: '01103',
    });

    expect(toAdminOrder(order).delivery).toEqual({ method: 'Kurjeris', carrier: 'SmartPosti', destination });
  });

  it('shows a legacy order with empty customer and delivery details', () => {
    const order = createOrder({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      deliveryMethod: null,
      carrier: null,
      pickupPointName: null,
      pickupPointAddress: null,
      pickupPointCity: null,
      shippingPrice: new Prisma.Decimal('0'),
      itemsTotal: new Prisma.Decimal('39.97'),
      total: new Prisma.Decimal('39.97'),
    });

    expect(toAdminOrder(order)).toMatchObject({
      number: 'U-10001',
      customer: { name: '', email: '', phone: '' },
      delivery: null,
      shippingPrice: '0,00 €',
      total: '39,97 €',
    });
  });
});

describe('getAdminPaymentStatus', () => {
  it.each([
    ['PAID', null, 'Apmokėta'],
    ['PENDING', null, 'Laukiama apmokėjimo'],
    ['PENDING', RELEASED_AT, 'Nebaigtas'],
    ['ABANDONED', RELEASED_AT, 'Nebaigtas'],
    ['ABANDONED', null, 'Nebaigtas'],
    ['VOIDED', null, 'Atmesta'],
    ['REFUNDED', null, 'Grąžinta'],
    ['PARTIALLY_REFUNDED', null, 'Grąžinta dalis'],
    ['AUTHORIZED', null, 'Laukiama apmokėjimo'],
    ['AUTHORIZED', RELEASED_AT, 'Nebaigtas'],
  ] as const)('labels %s (released: %s) as %s', (paymentStatus, stockReleasedAt, label) => {
    expect(PAYMENT_STATUS_LABELS[getAdminPaymentStatus({ paymentStatus, stockReleasedAt })]).toBe(label);
  });
});
