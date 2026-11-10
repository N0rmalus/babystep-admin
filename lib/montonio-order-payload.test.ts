import { describe, expect, it } from 'vitest';

import { buildMontonioOrderPayload, getCheckoutUrls } from '@/lib/montonio-order-payload';

type PayloadOptions = Parameters<typeof buildMontonioOrderPayload>[0];

const muslinItem = {
  productName: 'Muslino merliukas',
  options: [],
  unitPrice: 20,
  quantity: 2,
};

const sleepingBagItem = {
  productName: 'Miegmaišis „Meškiukai“',
  options: [
    { name: 'Dydis', value: '0–6 mėn.' },
    { name: 'Spalva', value: 'Šalavijų' },
  ],
  unitPrice: 39.9,
  quantity: 1,
};

const baseOptions = {
  order: { id: 'order-uuid-1', number: 10001 },
  items: [muslinItem],
  totals: { itemsTotal: 40, shippingPrice: 3.49, total: 43.49 },
  contact: { firstName: 'Ona', lastName: 'Kazlauskienė', email: 'ona@example.lt', phone: '+37061234567' },
  delivery: {
    method: 'locker',
    pickupPoint: { name: 'Vilniaus Akropolis paštomatas', address: 'Ozo g. 25', city: 'Vilnius' },
  },
  payment: { method: 'card' },
  returnUrl: 'https://babystep.lt/uzsakymas/order-uuid-1',
  notificationUrl: 'https://admin.babystep.lt/api/webhook/montonio',
} satisfies PayloadOptions;

describe('buildMontonioOrderPayload', () => {
  it('references our order and shows its number', () => {
    const payload = buildMontonioOrderPayload(baseOptions);

    expect(payload).toMatchObject({
      merchantReference: 'order-uuid-1',
      merchantReferenceDisplay: 'U-10001',
      returnUrl: 'https://babystep.lt/uzsakymas/order-uuid-1',
      notificationUrl: 'https://admin.babystep.lt/api/webhook/montonio',
      locale: 'lt',
      currency: 'EUR',
      expiresIn: 30,
    });
  });

  it('charges the order total', () => {
    const payload = buildMontonioOrderPayload(baseOptions);

    expect(payload.grandTotal).toBe(43.49);
    expect(payload.payment).toMatchObject({ amount: 43.49, currency: 'EUR' });
  });

  it('names a default-variant item by product name and a variant item with its label', () => {
    const payload = buildMontonioOrderPayload({
      ...baseOptions,
      items: [muslinItem, sleepingBagItem],
      totals: { itemsTotal: 79.9, shippingPrice: 3.49, total: 83.39 },
    });

    expect(payload.lineItems.slice(0, 2)).toEqual([
      { name: 'Muslino merliukas', quantity: 2, finalPrice: 20 },
      { name: 'Miegmaišis „Meškiukai“ – Dydis: 0–6 mėn. · Spalva: Šalavijų', quantity: 1, finalPrice: 39.9 },
    ]);
  });

  it('adds a shipping line when shipping is charged', () => {
    const payload = buildMontonioOrderPayload(baseOptions);

    expect(payload.lineItems).toEqual([
      { name: 'Muslino merliukas', quantity: 2, finalPrice: 20 },
      { name: 'Pristatymas', quantity: 1, finalPrice: 3.49 },
    ]);
  });

  it('leaves out the shipping line when shipping is free', () => {
    const payload = buildMontonioOrderPayload({
      ...baseOptions,
      items: [{ ...muslinItem, quantity: 4 }],
      totals: { itemsTotal: 80, shippingPrice: 0, total: 80 },
    });

    expect(payload.lineItems).toEqual([{ name: 'Muslino merliukas', quantity: 4, finalPrice: 20 }]);
  });

  it('pays through the chosen bank', () => {
    const payload = buildMontonioOrderPayload({
      ...baseOptions,
      payment: { method: 'bank', bank: { code: 'HABALT22' } },
    });

    expect(payload.payment).toEqual({
      method: 'paymentInitiation',
      amount: 43.49,
      currency: 'EUR',
      methodOptions: { preferredProvider: 'HABALT22', preferredCountry: 'LT' },
    });
  });

  it('pays by card', () => {
    const payload = buildMontonioOrderPayload(baseOptions);

    expect(payload.payment).toEqual({ method: 'cardPayments', amount: 43.49, currency: 'EUR' });
  });

  it('ships to the pickup point and bills the contact', () => {
    const payload = buildMontonioOrderPayload(baseOptions);

    const contact = {
      firstName: 'Ona',
      lastName: 'Kazlauskienė',
      email: 'ona@example.lt',
      phoneNumber: '61234567',
      phoneCountry: '370',
    };

    expect(payload.billingAddress).toEqual(contact);
    expect(payload.shippingAddress).toEqual({
      ...contact,
      addressLine1: 'Ozo g. 25',
      locality: 'Vilnius',
      country: 'LT',
    });
  });

  it('ships and bills to the courier address', () => {
    const payload = buildMontonioOrderPayload({
      ...baseOptions,
      delivery: {
        method: 'courier',
        address: { street: 'Gedimino pr. 9', apartment: '12', city: 'Kaunas', postalCode: 'LT-44280' },
      },
      totals: { itemsTotal: 40, shippingPrice: 6.49, total: 46.49 },
    });

    const address = {
      firstName: 'Ona',
      lastName: 'Kazlauskienė',
      email: 'ona@example.lt',
      phoneNumber: '61234567',
      phoneCountry: '370',
      addressLine1: 'Gedimino pr. 9',
      addressLine2: '12',
      locality: 'Kaunas',
      postalCode: 'LT-44280',
      country: 'LT',
    };

    expect(payload.billingAddress).toEqual(address);
    expect(payload.shippingAddress).toEqual(address);
  });
});

describe('getCheckoutUrls', () => {
  it('returns to the order confirmation page and notifies the Montonio webhook', () => {
    const urls = getCheckoutUrls({
      orderId: 'order-uuid-1',
      storeUrl: 'https://babystep.lt',
      adminUrl: 'https://admin.babystep.lt',
    });

    expect(urls).toEqual({
      returnUrl: 'https://babystep.lt/uzsakymas/order-uuid-1',
      notificationUrl: 'https://admin.babystep.lt/api/webhook/montonio',
    });
  });

  it('adds the deployment protection bypass to the notification URL when a bypass secret is set', () => {
    const { notificationUrl } = getCheckoutUrls({
      orderId: 'order-uuid-1',
      storeUrl: 'https://babystep.lt',
      adminUrl: 'https://babystep-admin-git-feat.vercel.app',
      bypassSecret: 'preview secret/1',
    });

    expect(notificationUrl).toBe(
      'https://babystep-admin-git-feat.vercel.app/api/webhook/montonio?x-vercel-protection-bypass=preview+secret%2F1',
    );
  });

  it('leaves the notification URL plain when the bypass secret is empty', () => {
    const { notificationUrl } = getCheckoutUrls({
      orderId: 'order-uuid-1',
      storeUrl: 'https://babystep.lt',
      adminUrl: 'https://admin.babystep.lt',
      bypassSecret: '',
    });

    expect(notificationUrl).toBe('https://admin.babystep.lt/api/webhook/montonio');
  });

  it('ignores a trailing slash on the base URLs', () => {
    const urls = getCheckoutUrls({
      orderId: 'order-uuid-1',
      storeUrl: 'https://babystep.lt/',
      adminUrl: 'https://admin.babystep.lt/',
    });

    expect(urls).toEqual({
      returnUrl: 'https://babystep.lt/uzsakymas/order-uuid-1',
      notificationUrl: 'https://admin.babystep.lt/api/webhook/montonio',
    });
  });
});
