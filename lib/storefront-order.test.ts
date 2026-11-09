import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { type StorefrontOrderRow, toStorefrontOrder } from '@/lib/storefront-order';

const createOrder = (overrides: Partial<StorefrontOrderRow> = {}) => ({
  id: 'order-1',
  number: 10001,
  paymentStatus: 'PAID',
  stockReleasedAt: null,
  firstName: 'Ona',
  lastName: 'Onaitė',
  email: 'ona@example.test',
  phoneNumber: '+37061234567',
  deliveryMethod: 'LOCKER',
  carrier: 'OMNIVA',
  pickupPointId: 'pp-1',
  pickupPointName: 'Omniva Akropolis',
  pickupPointAddress: 'Ozo g. 25',
  pickupPointCity: 'Vilnius',
  street: null,
  apartment: null,
  city: null,
  postalCode: null,
  paymentMethod: 'BANK',
  bankName: 'Swedbank',
  itemsTotal: new Prisma.Decimal('39.97'),
  shippingPrice: new Prisma.Decimal('2.99'),
  total: new Prisma.Decimal('42.96'),
  orderItems: [
    {
      productId: 'product-1',
      variantId: 'variant-default',
      quantity: 1,
      productName: 'Miego maišas',
      options: [],
      unitPrice: new Prisma.Decimal('19.99'),
      product: { images: [{ url: 'https://img.example.test/bag.jpg' }] },
      variant: { combinationKey: '' },
    },
    {
      productId: 'product-2',
      variantId: 'variant-2',
      quantity: 2,
      productName: 'Muslino merliukas',
      options: [{ name: 'Dydis', value: '0–6 mėn.' }],
      unitPrice: new Prisma.Decimal('9.99'),
      product: { images: [] },
      variant: { combinationKey: 'ov-1' },
    },
  ],
  ...overrides,
}) satisfies StorefrontOrderRow;

describe('toStorefrontOrder', () => {
  it('returns a paid locker order with bank payment in the storefront shape', () => {
    expect(toStorefrontOrder(createOrder())).toEqual({
      id: 'order-1',
      number: 'U-10001',
      status: 'paid',
      email: 'ona@example.test',
      recipient: { name: 'Ona Onaitė', phone: '+37061234567' },
      lines: [
        {
          productId: 'product-1',
          name: 'Miego maišas',
          quantity: 1,
          total: 19.99,
          imageUrl: 'https://img.example.test/bag.jpg',
        },
        {
          productId: 'product-2',
          variantId: 'variant-2',
          name: 'Muslino merliukas – Dydis: 0–6 mėn.',
          quantity: 2,
          total: 19.98,
          imageUrl: null,
        },
      ],
      subtotal: 39.97,
      deliveryPrice: 2.99,
      total: 42.96,
      delivery: {
        method: 'locker',
        carrier: 'omniva',
        pickupPoint: { id: 'pp-1', carrier: 'omniva', name: 'Omniva Akropolis', address: 'Ozo g. 25', city: 'Vilnius' },
      },
      payment: { method: 'bank', bankName: 'Swedbank' },
    });
  });

  it('returns courier delivery with the address and card payment', () => {
    const order = createOrder({
      deliveryMethod: 'COURIER',
      carrier: 'SMARTPOSTI',
      pickupPointId: null,
      pickupPointName: null,
      pickupPointAddress: null,
      pickupPointCity: null,
      street: 'Gedimino pr. 1',
      apartment: '12',
      city: 'Vilnius',
      postalCode: 'LT-01103',
      paymentMethod: 'CARD',
      bankName: null,
    });

    expect(toStorefrontOrder(order)).toMatchObject({
      delivery: {
        method: 'courier',
        carrier: 'smartposti',
        address: { street: 'Gedimino pr. 1', apartment: '12', city: 'Vilnius', postalCode: 'LT-01103' },
      },
      payment: { method: 'card' },
    });
  });

  it('shows a pending order as pending and a released one as failed', () => {
    expect(toStorefrontOrder(createOrder({ paymentStatus: 'PENDING' }))?.status).toBe('pending');
    expect(
      toStorefrontOrder(createOrder({ paymentStatus: 'PENDING', stockReleasedAt: new Date('2026-06-15T12:30:00Z') }))
        ?.status,
    ).toBe('failed');
  });

  it('returns null for an order from before the Montonio checkout', () => {
    const order = createOrder({ deliveryMethod: null, carrier: null, paymentMethod: null, bankName: null });

    expect(toStorefrontOrder(order)).toBeNull();
  });

  it('leaves the apartment out of a courier address without one', () => {
    const order = createOrder({
      deliveryMethod: 'COURIER',
      carrier: 'SMARTPOSTI',
      street: 'Gedimino pr. 1',
      apartment: null,
      city: 'Vilnius',
      postalCode: 'LT-01103',
    });

    expect(toStorefrontOrder(order)?.delivery).toStrictEqual({
      method: 'courier',
      carrier: 'smartposti',
      address: { street: 'Gedimino pr. 1', city: 'Vilnius', postalCode: 'LT-01103' },
    });
  });
});
