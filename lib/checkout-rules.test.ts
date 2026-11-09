import { describe, expect, it } from 'vitest';

import { DELIVERY_CONFIG } from '@/lib/delivery-config';
import {
  getCheckoutTotals,
  getStockChangedItems,
  getStorefrontOrderStatus,
  getWebhookAction,
  getWebhookOrderMismatch,
  parseCheckoutRequest,
  resolveCheckoutItems,
  validateCheckoutFields,
} from '@/lib/checkout-rules';

type CheckoutProduct = Parameters<typeof resolveCheckoutItems>[0]['products'][number];

const NOW = new Date('2026-06-15T12:00:00Z');

const SIZE_GROUP = { id: 'size', name: 'Dydis' };
const COLOR_GROUP = { id: 'color', name: 'Spalva' };

const muslin = {
  id: 'muslin',
  name: 'Muslino merliukas',
  price: 20,
  salePrice: null,
  saleStartsAt: null,
  saleEndsAt: null,
  isArchived: false,
  optionGroups: [],
  variants: [
    {
      id: 'muslin-default',
      sku: 'MM-1',
      price: null,
      salePrice: null,
      isArchived: false,
      combinationKey: '',
      optionValues: [],
    },
  ],
};

const sleepingBagVariant = {
  sku: null,
  price: null,
  salePrice: null,
  isArchived: false,
};

const sleepingBag = {
  id: 'sleeping-bag',
  name: 'Miegmaišis „Meškiukai“',
  price: 45,
  salePrice: null,
  saleStartsAt: null,
  saleEndsAt: null,
  isArchived: false,
  optionGroups: [{ group: SIZE_GROUP }, { group: COLOR_GROUP }],
  variants: [
    {
      ...sleepingBagVariant,
      id: 'sleeping-bag-s-sage',
      sku: 'MB-S-SAGE',
      combinationKey: 'sage,size-s',
      // Stored out of group order on purpose
      optionValues: [
        { optionValue: { label: 'Šalavijų', groupId: 'color' } },
        { optionValue: { label: '0–6 mėn.', groupId: 'size' } },
      ],
    },
    {
      ...sleepingBagVariant,
      id: 'sleeping-bag-m-sage',
      combinationKey: 'sage,size-m',
      price: 52,
      salePrice: 39,
      optionValues: [
        { optionValue: { label: '6–18 mėn.', groupId: 'size' } },
        { optionValue: { label: 'Šalavijų', groupId: 'color' } },
      ],
    },
    {
      ...sleepingBagVariant,
      id: 'sleeping-bag-l-sage',
      combinationKey: 'sage,size-l',
      isArchived: true,
      optionValues: [
        { optionValue: { label: '18–36 mėn.', groupId: 'size' } },
        { optionValue: { label: 'Šalavijų', groupId: 'color' } },
      ],
    },
  ],
};

const VALID_REQUEST = {
  lines: [
    { productId: 'muslin', quantity: 2 },
    { productId: 'sleeping-bag', variantId: 'sleeping-bag-s-sage', quantity: 1 },
  ],
  contact: { firstName: 'Ona', lastName: 'Kazlauskienė', email: 'ona@pastas.lt', phone: '+370 612 34567' },
  delivery: { method: 'locker', pickupPointId: 'omniva-vilnius-akropolis' },
  payment: { method: 'bank', bankCode: 'SWEDBANK_LT' },
};

describe('parseCheckoutRequest', () => {
  it('accepts a well-formed request', () => {
    expect(parseCheckoutRequest(VALID_REQUEST)).toEqual({ status: 'ok', request: VALID_REQUEST });
  });

  it.each([
    ['a body that is not an object', null],
    ['empty lines', { ...VALID_REQUEST, lines: [] }],
    ['a zero quantity', { ...VALID_REQUEST, lines: [{ productId: 'muslin', quantity: 0 }] }],
    ['a negative quantity', { ...VALID_REQUEST, lines: [{ productId: 'muslin', quantity: -1 }] }],
    ['a fractional quantity', { ...VALID_REQUEST, lines: [{ productId: 'muslin', quantity: 1.5 }] }],
    [
      'the same product twice',
      {
        ...VALID_REQUEST,
        lines: [
          { productId: 'muslin', quantity: 1 },
          { productId: 'muslin', quantity: 2 },
        ],
      },
    ],
    [
      'the same product and variant twice',
      {
        ...VALID_REQUEST,
        lines: [
          { productId: 'sleeping-bag', variantId: 'sleeping-bag-s-sage', quantity: 1 },
          { productId: 'sleeping-bag', variantId: 'sleeping-bag-s-sage', quantity: 1 },
        ],
      },
    ],
    ['an unknown delivery method', { ...VALID_REQUEST, delivery: { method: 'dpd', pickupPointId: 'x' } }],
    ['an unknown payment method', { ...VALID_REQUEST, payment: { method: 'paypal' } }],
    ['missing contact', { ...VALID_REQUEST, contact: undefined }],
  ])('rejects %s as INVALID_REQUEST', (_, body) => {
    expect(parseCheckoutRequest(body)).toEqual({ status: 'rejected', error: { code: 'INVALID_REQUEST' } });
  });

  it('accepts two variants of the same product as separate lines', () => {
    const lines = [
      { productId: 'sleeping-bag', variantId: 'sleeping-bag-s-sage', quantity: 1 },
      { productId: 'sleeping-bag', variantId: 'sleeping-bag-m-sage', quantity: 1 },
    ];

    expect(parseCheckoutRequest({ ...VALID_REQUEST, lines })).toMatchObject({ status: 'ok' });
  });
});

describe('resolveCheckoutItems', () => {
  it('resolves a line without variantId to the default variant with its snapshot and prices', () => {
    const result = resolveCheckoutItems({
      lines: [{ productId: 'muslin', quantity: 2 }],
      products: [muslin],
      now: NOW,
    });

    expect(result).toEqual({
      status: 'ok',
      items: [
        {
          productId: 'muslin',
          variantId: 'muslin-default',
          lineKey: { productId: 'muslin' },
          quantity: 2,
          productName: 'Muslino merliukas',
          sku: 'MM-1',
          options: [],
          unitPrice: 20,
          regularUnitPrice: 20,
        },
      ],
    });
  });

  it('snapshots the chosen variant with its option values in group order and its inherited price', () => {
    const result = resolveCheckoutItems({
      lines: [{ productId: 'sleeping-bag', variantId: 'sleeping-bag-s-sage', quantity: 1 }],
      products: [sleepingBag],
      now: NOW,
    });

    expect(result).toEqual({
      status: 'ok',
      items: [
        {
          productId: 'sleeping-bag',
          variantId: 'sleeping-bag-s-sage',
          lineKey: { productId: 'sleeping-bag', variantId: 'sleeping-bag-s-sage' },
          quantity: 1,
          productName: 'Miegmaišis „Meškiukai“',
          sku: 'MB-S-SAGE',
          options: [
            { name: 'Dydis', value: '0–6 mėn.' },
            { name: 'Spalva', value: 'Šalavijų' },
          ],
          unitPrice: 45,
          regularUnitPrice: 45,
        },
      ],
    });
  });
});

describe('resolveCheckoutItems rejections', () => {
  const resolve = (
    lines: { productId: string; variantId?: string; quantity: number }[],
    products = [muslin, sleepingBag],
  ) => resolveCheckoutItems({ lines, products, now: NOW });

  const rejectedWith = (items: { productId: string; variantId?: string; reason: string }[]) => ({
    status: 'rejected',
    error: { code: 'INVALID_ITEMS', items },
  });

  it.each([
    ['an unknown product', { productId: 'gone', quantity: 1 }, 'NOT_FOUND'],
    ['an unknown product with a variantId', { productId: 'gone', variantId: 'gone-s', quantity: 1 }, 'NOT_FOUND'],
    [
      'a variant of another product',
      { productId: 'sleeping-bag', variantId: 'muslin-default', quantity: 1 },
      'NOT_FOUND',
    ],
    ['an unknown variant', { productId: 'sleeping-bag', variantId: 'sleeping-bag-xl-sage', quantity: 1 }, 'NOT_FOUND'],
    [
      'an archived variant',
      { productId: 'sleeping-bag', variantId: 'sleeping-bag-l-sage', quantity: 1 },
      'UNAVAILABLE',
    ],
    ['a product with variants and no variantId', { productId: 'sleeping-bag', quantity: 1 }, 'VARIANT_REQUIRED'],
    [
      'a variantId for a product without variants',
      { productId: 'muslin', variantId: 'muslin-default', quantity: 1 },
      'VARIANT_NOT_ALLOWED',
    ],
  ])('rejects %s', (_, { quantity, ...key }, reason) => {
    expect(resolve([{ ...key, quantity }])).toEqual(rejectedWith([{ ...key, reason }]));
  });

  it('rejects an archived product as UNAVAILABLE, with or without variantId', () => {
    const archivedMuslin = { ...muslin, isArchived: true };
    const archivedBag = { ...sleepingBag, isArchived: true };

    const result = resolve(
      [
        { productId: 'muslin', quantity: 1 },
        { productId: 'sleeping-bag', variantId: 'sleeping-bag-s-sage', quantity: 1 },
      ],
      [archivedMuslin, archivedBag],
    );

    expect(result).toEqual(
      rejectedWith([
        { productId: 'muslin', reason: 'UNAVAILABLE' },
        { productId: 'sleeping-bag', variantId: 'sleeping-bag-s-sage', reason: 'UNAVAILABLE' },
      ]),
    );
  });

  it('rejects a product whose variants are all archived as UNAVAILABLE when no variantId is sent', () => {
    const soldOutBag = {
      ...sleepingBag,
      variants: sleepingBag.variants.map((variant) => ({ ...variant, isArchived: true })),
    };

    expect(resolve([{ productId: 'sleeping-bag', quantity: 1 }], [soldOutBag])).toEqual(
      rejectedWith([{ productId: 'sleeping-bag', reason: 'UNAVAILABLE' }]),
    );
  });

  it('rejects a product with neither options nor an active default variant as UNAVAILABLE', () => {
    const brokenMuslin = {
      ...muslin,
      variants: muslin.variants.map((variant) => ({ ...variant, isArchived: true })),
    };

    expect(resolve([{ productId: 'muslin', quantity: 1 }], [brokenMuslin])).toEqual(
      rejectedWith([{ productId: 'muslin', reason: 'UNAVAILABLE' }]),
    );
  });

  it('lists every failing line and none of the valid ones', () => {
    const result = resolve([
      { productId: 'muslin', quantity: 1 },
      { productId: 'gone', quantity: 1 },
      { productId: 'sleeping-bag', variantId: 'sleeping-bag-s-sage', quantity: 1 },
      { productId: 'sleeping-bag', quantity: 1 },
      { productId: 'sleeping-bag', variantId: 'sleeping-bag-l-sage', quantity: 1 },
    ]);

    expect(result).toEqual(
      rejectedWith([
        { productId: 'gone', reason: 'NOT_FOUND' },
        { productId: 'sleeping-bag', reason: 'VARIANT_REQUIRED' },
        { productId: 'sleeping-bag', variantId: 'sleeping-bag-l-sage', reason: 'UNAVAILABLE' },
      ]),
    );
  });
});

describe('resolveCheckoutItems prices', () => {
  const BEFORE_NOW = new Date('2026-06-01T00:00:00Z');
  const AFTER_NOW = new Date('2026-06-30T00:00:00Z');

  const getPrices = (product: CheckoutProduct, variantId: string) => {
    const result = resolveCheckoutItems({
      lines: [{ productId: product.id, variantId, quantity: 1 }],
      products: [product],
      now: NOW,
    });

    if (result.status !== 'ok') {
      throw new Error('Expected the line to resolve');
    }

    return result.items.map(({ unitPrice, regularUnitPrice }) => ({ unitPrice, regularUnitPrice })).at(0);
  };

  const onSale = { ...sleepingBag, salePrice: 36 };

  it.each([
    ['an inherited price with no sale', sleepingBag, 'sleeping-bag-s-sage', { unitPrice: 45, regularUnitPrice: 45 }],
    ['an inherited price with an active sale', onSale, 'sleeping-bag-s-sage', { unitPrice: 36, regularUnitPrice: 45 }],
    [
      'an overridden price with its own active sale',
      onSale,
      'sleeping-bag-m-sage',
      { unitPrice: 39, regularUnitPrice: 52 },
    ],
    [
      'an inherited price with a sale that starts later',
      { ...onSale, saleStartsAt: AFTER_NOW },
      'sleeping-bag-s-sage',
      { unitPrice: 45, regularUnitPrice: 45 },
    ],
    [
      'an overridden price with a sale that already ended',
      { ...onSale, saleEndsAt: BEFORE_NOW },
      'sleeping-bag-m-sage',
      { unitPrice: 52, regularUnitPrice: 52 },
    ],
    [
      'an overridden price inside the sale window',
      { ...onSale, saleStartsAt: BEFORE_NOW, saleEndsAt: AFTER_NOW },
      'sleeping-bag-m-sage',
      { unitPrice: 39, regularUnitPrice: 52 },
    ],
  ])('prices %s', (_, product, variantId, prices) => {
    expect(getPrices(product, variantId)).toEqual(prices);
  });

  it('reads Decimal-like and string prices', () => {
    const decimalMuslin = { ...muslin, price: { toNumber: () => 19.99 }, salePrice: '14.5' };

    const result = resolveCheckoutItems({
      lines: [{ productId: 'muslin', quantity: 1 }],
      products: [decimalMuslin],
      now: NOW,
    });

    expect(result).toMatchObject({ status: 'ok', items: [{ unitPrice: 14.5, regularUnitPrice: 19.99 }] });
  });
});

describe('getStockChangedItems', () => {
  const item = {
    productName: 'Miegmaišis „Meškiukai“',
    sku: null,
    options: [],
    unitPrice: 45,
    regularUnitPrice: 45,
  };
  const defaultItem = {
    ...item,
    productId: 'muslin',
    variantId: 'muslin-default',
    lineKey: { productId: 'muslin' },
    quantity: 3,
  };
  const smallItem = {
    ...item,
    productId: 'sleeping-bag',
    variantId: 'sleeping-bag-s-sage',
    lineKey: { productId: 'sleeping-bag', variantId: 'sleeping-bag-s-sage' },
    quantity: 2,
  };
  const mediumItem = {
    ...smallItem,
    variantId: 'sleeping-bag-m-sage',
    lineKey: { productId: 'sleeping-bag', variantId: 'sleeping-bag-m-sage' },
    quantity: 1,
  };

  it('lists every item whose quantity exceeds its variant stock, with variantId only for chosen variants', () => {
    const result = getStockChangedItems({
      items: [defaultItem, smallItem, mediumItem],
      stockCounts: [
        { variantId: 'muslin-default', stockCount: 2 },
        { variantId: 'sleeping-bag-s-sage', stockCount: 0 },
        { variantId: 'sleeping-bag-m-sage', stockCount: 1 },
      ],
    });

    expect(result).toEqual([
      { productId: 'muslin', availableCount: 2 },
      { productId: 'sleeping-bag', variantId: 'sleeping-bag-s-sage', availableCount: 0 },
    ]);
  });

  it('treats a variant missing from the stock list as having none left', () => {
    expect(getStockChangedItems({ items: [mediumItem], stockCounts: [] })).toEqual([
      { productId: 'sleeping-bag', variantId: 'sleeping-bag-m-sage', availableCount: 0 },
    ]);
  });

  it('is empty when every quantity fits, including an exact match', () => {
    const result = getStockChangedItems({
      items: [defaultItem],
      stockCounts: [{ variantId: 'muslin-default', stockCount: 3 }],
    });

    expect(result).toEqual([]);
  });
});

describe('validateCheckoutFields', () => {
  const pickupPoint = {
    id: 'omniva-vilnius-akropolis',
    carrier: 'omniva',
    name: 'Akropolio paštomatas',
    address: 'Ozo g. 25',
    city: 'Vilnius',
  };
  const bank = { code: 'SWEDBANK_LT', name: 'Swedbank' };
  const contact = { firstName: 'Ona', lastName: 'Kazlauskienė', email: 'ona@pastas.lt', phone: '612 34567' };
  const lockerDelivery = { method: 'locker' as const, pickupPointId: pickupPoint.id };
  const courierAddress = { street: 'Gedimino pr. 1', city: 'Vilnius', postalCode: '01103' };
  const courierDelivery = { method: 'courier' as const, address: courierAddress };
  const bankPayment = { method: 'bank' as const, bankCode: bank.code };
  const cardPayment = { method: 'card' as const };

  const validate = (fields: Partial<Parameters<typeof validateCheckoutFields>[0]>) =>
    validateCheckoutFields({
      contact,
      delivery: lockerDelivery,
      payment: bankPayment,
      pickupPoints: [pickupPoint],
      banks: [bank],
      ...fields,
    });

  const rejectedWith = (fields: { field: string; reason: string }[]) => ({
    status: 'rejected',
    error: { code: 'INVALID_FIELDS', fields },
  });

  it('returns trimmed contact, the chosen pickup point and bank when everything is valid', () => {
    const result = validate({
      contact: { firstName: ' Ona ', lastName: 'Kazlauskienė ', email: ' ona@pastas.lt', phone: '+370 612 34567' },
    });

    expect(result).toEqual({
      status: 'ok',
      contact: { firstName: 'Ona', lastName: 'Kazlauskienė', email: 'ona@pastas.lt', phone: '+37061234567' },
      delivery: { method: 'locker', pickupPoint },
      payment: { method: 'bank', bank },
    });
  });

  it('returns a normalized courier address and card payment', () => {
    const result = validate({
      delivery: {
        method: 'courier',
        address: { street: ' Gedimino pr. 1 ', apartment: ' 5 ', city: 'Vilnius ', postalCode: 'lt01103' },
      },
      payment: cardPayment,
    });

    expect(result).toMatchObject({
      status: 'ok',
      delivery: {
        method: 'courier',
        address: { street: 'Gedimino pr. 1', apartment: '5', city: 'Vilnius', postalCode: 'LT-01103' },
      },
      payment: { method: 'card' },
    });
  });

  it('leaves out a blank apartment', () => {
    const result = validate({ delivery: { method: 'courier', address: { ...courierAddress, apartment: '  ' } } });

    expect(result).toMatchObject({
      delivery: { address: { street: 'Gedimino pr. 1', city: 'Vilnius', postalCode: 'LT-01103' } },
    });
    expect(result).not.toMatchObject({ delivery: { address: { apartment: expect.anything() } } });
  });

  it.each([
    ['8 612 34567', '+37061234567'],
    ['861234567', '+37061234567'],
    ['+370 (612) 34-567', '+37061234567'],
    ['37061234567', '+37061234567'],
    ['61234567', '+37061234567'],
  ])('accepts the phone %s as %s', (phone, normalized) => {
    expect(validate({ contact: { ...contact, phone } })).toMatchObject({
      status: 'ok',
      contact: { phone: normalized },
    });
  });

  it.each(['LT-01103', 'lt-01103', 'LT01103', '01103', ' 01103 '])('accepts the postal code %s', (postalCode) => {
    const result = validate({ delivery: { method: 'courier', address: { ...courierAddress, postalCode } } });

    expect(result).toMatchObject({ status: 'ok', delivery: { address: { postalCode: 'LT-01103' } } });
  });

  it.each([
    ['firstName', 'REQUIRED', { contact: { ...contact, firstName: '  ' } }],
    ['lastName', 'REQUIRED', { contact: { ...contact, lastName: '' } }],
    ['email', 'REQUIRED', { contact: { ...contact, email: ' ' } }],
    ['email', 'INVALID_FORMAT', { contact: { ...contact, email: 'ona@pastas' } }],
    ['email', 'INVALID_FORMAT', { contact: { ...contact, email: 'ona pastas@pastas.lt' } }],
    ['phone', 'REQUIRED', { contact: { ...contact, phone: '' } }],
    ['phone', 'INVALID_FORMAT', { contact: { ...contact, phone: '612 3456' } }],
    ['phone', 'INVALID_FORMAT', { contact: { ...contact, phone: '+371 612 34567' } }],
    ['pickupPoint', 'REQUIRED', { delivery: { method: 'locker', pickupPointId: ' ' } }],
    ['pickupPoint', 'NOT_FOUND', { delivery: { method: 'locker', pickupPointId: 'unisend-kaunas-mega' } }],
    ['street', 'REQUIRED', { delivery: { ...courierDelivery, address: { ...courierAddress, street: ' ' } } }],
    ['city', 'REQUIRED', { delivery: { ...courierDelivery, address: { ...courierAddress, city: '' } } }],
    ['postalCode', 'REQUIRED', { delivery: { ...courierDelivery, address: { ...courierAddress, postalCode: ' ' } } }],
    [
      'postalCode',
      'INVALID_FORMAT',
      { delivery: { ...courierDelivery, address: { ...courierAddress, postalCode: '1103' } } },
    ],
    [
      'postalCode',
      'INVALID_FORMAT',
      { delivery: { ...courierDelivery, address: { ...courierAddress, postalCode: 'LV-01103' } } },
    ],
    ['payment', 'REQUIRED', { payment: { method: 'bank', bankCode: '' } }],
    ['payment', 'NOT_FOUND', { payment: { method: 'bank', bankCode: 'REVOLUT_LT' } }],
  ] as const)('rejects %s as %s', (field, reason, fields) => {
    expect(validate(fields)).toEqual(rejectedWith([{ field, reason }]));
  });

  it('lists every failing field in form order', () => {
    const result = validate({
      contact: { firstName: '', lastName: 'Kazlauskienė', email: 'ona', phone: '' },
      delivery: { method: 'courier', address: { street: '', city: 'Vilnius', postalCode: 'abc' } },
      payment: { method: 'bank', bankCode: 'REVOLUT_LT' },
    });

    expect(result).toEqual(
      rejectedWith([
        { field: 'firstName', reason: 'REQUIRED' },
        { field: 'email', reason: 'INVALID_FORMAT' },
        { field: 'phone', reason: 'REQUIRED' },
        { field: 'street', reason: 'REQUIRED' },
        { field: 'postalCode', reason: 'INVALID_FORMAT' },
        { field: 'payment', reason: 'NOT_FOUND' },
      ]),
    );
  });
});

describe('DELIVERY_CONFIG', () => {
  it('holds the customer prices, carriers and free-shipping threshold served to the storefront', () => {
    expect(DELIVERY_CONFIG).toEqual({
      options: [
        { method: 'locker', price: 3.49, carriers: ['omniva', 'unisend'] },
        { method: 'courier', price: 6.49, carriers: ['smartposti'] },
      ],
      freeShippingThreshold: 80,
    });
  });
});

describe('getCheckoutTotals', () => {
  const item = {
    productId: 'muslin',
    variantId: 'muslin-default',
    lineKey: { productId: 'muslin' },
    productName: 'Muslino merliukas',
    sku: null,
    options: [],
    regularUnitPrice: 20,
  };

  it('sums unit price times quantity and adds shipping, rounded to cents', () => {
    const items = [
      { ...item, quantity: 3, unitPrice: 0.1 },
      { ...item, quantity: 1, unitPrice: 19.99 },
    ];

    expect(getCheckoutTotals({ items, deliveryMethod: 'locker' })).toEqual({
      itemsTotal: 20.29,
      shippingPrice: 3.49,
      total: 23.78,
    });
  });

  it.each([
    ['locker', 79.99, 3.49, 83.48],
    ['locker', 80, 0, 80],
    ['locker', 80.01, 0, 80.01],
    ['courier', 79.99, 6.49, 86.48],
    ['courier', 80, 0, 80],
    ['courier', 80.01, 0, 80.01],
  ] as const)('charges %s shipping on %s € of items as %s €', (deliveryMethod, unitPrice, shippingPrice, total) => {
    const result = getCheckoutTotals({ items: [{ ...item, quantity: 1, unitPrice }], deliveryMethod });

    expect(result).toEqual({ itemsTotal: unitPrice, shippingPrice, total });
  });

  it('totals resolved items at their sale and overridden prices', () => {
    const resolved = resolveCheckoutItems({
      lines: [
        { productId: 'muslin', quantity: 2 },
        { productId: 'sleeping-bag', variantId: 'sleeping-bag-m-sage', quantity: 1 },
      ],
      products: [{ ...muslin, salePrice: 15 }, sleepingBag],
      now: NOW,
    });

    if (resolved.status !== 'ok') {
      throw new Error('Expected the lines to resolve');
    }

    expect(getCheckoutTotals({ items: resolved.items, deliveryMethod: 'courier' })).toEqual({
      itemsTotal: 69,
      shippingPrice: 6.49,
      total: 75.49,
    });
  });

  it('reaches free shipping through quantities', () => {
    const result = getCheckoutTotals({ items: [{ ...item, quantity: 4, unitPrice: 20 }], deliveryMethod: 'courier' });

    expect(result).toEqual({ itemsTotal: 80, shippingPrice: 0, total: 80 });
  });
});

describe('getStorefrontOrderStatus', () => {
  const RELEASED_AT = new Date('2026-06-15T12:40:00Z');

  it.each([
    ['PAID', null, 'paid'],
    ['PAID', RELEASED_AT, 'paid'],
    ['PARTIALLY_REFUNDED', null, 'paid'],
    ['REFUNDED', null, 'paid'],
    ['PENDING', null, 'pending'],
    ['PENDING', RELEASED_AT, 'failed'],
    ['ABANDONED', RELEASED_AT, 'failed'],
    ['ABANDONED', null, 'failed'],
    ['VOIDED', null, 'failed'],
    ['AUTHORIZED', null, 'pending'],
    ['AUTHORIZED', RELEASED_AT, 'failed'],
  ] as const)('maps %s with stockReleasedAt %s to %s', (paymentStatus, stockReleasedAt, status) => {
    expect(getStorefrontOrderStatus({ paymentStatus, stockReleasedAt })).toBe(status);
  });
});

describe('getWebhookAction', () => {
  const RELEASED_AT = new Date('2026-06-15T12:40:00Z');
  const openOrder = { isPaid: false, paymentStatus: 'PENDING', stockReleasedAt: null } as const;

  it('marks an open order paid on PAID', () => {
    expect(getWebhookAction({ order: openOrder, status: 'PAID' })).toEqual({ type: 'mark-paid' });
  });

  const paidOrder = { isPaid: true, paymentStatus: 'PAID', stockReleasedAt: null } as const;

  it('ignores a duplicate PAID', () => {
    expect(getWebhookAction({ order: paidOrder, status: 'PAID' })).toEqual({ type: 'none' });
  });

  const releasedOrder = { ...openOrder, stockReleasedAt: RELEASED_AT };

  it('treats PAID on a released order as a late payment', () => {
    expect(getWebhookAction({ order: releasedOrder, status: 'PAID' })).toEqual({ type: 'late-payment' });
  });

  it('abandons and releases an unpaid order on ABANDONED', () => {
    expect(getWebhookAction({ order: openOrder, status: 'ABANDONED' })).toEqual({ type: 'abandon' });
  });

  it('abandons an order the cleanup already released, leaving the release to the guarded function', () => {
    expect(getWebhookAction({ order: releasedOrder, status: 'ABANDONED' })).toEqual({ type: 'abandon' });
  });

  it('ignores ABANDONED on a paid order', () => {
    expect(getWebhookAction({ order: paidOrder, status: 'ABANDONED' })).toEqual({ type: 'none' });
  });

  const abandonedOrder = { isPaid: false, paymentStatus: 'ABANDONED', stockReleasedAt: RELEASED_AT } as const;

  it('ignores a duplicate ABANDONED', () => {
    expect(getWebhookAction({ order: abandonedOrder, status: 'ABANDONED' })).toEqual({ type: 'none' });
  });

  it('flags a paid order for review on VOIDED', () => {
    expect(getWebhookAction({ order: paidOrder, status: 'VOIDED' })).toEqual({ type: 'flag-voided' });
  });

  it('only mirrors VOIDED on an unpaid order', () => {
    expect(getWebhookAction({ order: openOrder, status: 'VOIDED' })).toEqual({
      type: 'mirror',
      paymentStatus: 'VOIDED',
    });
  });

  it.each(['PARTIALLY_REFUNDED', 'REFUNDED'] as const)('mirrors %s on a paid order', (status) => {
    expect(getWebhookAction({ order: paidOrder, status })).toEqual({ type: 'mirror', paymentStatus: status });
  });

  it('mirrors AUTHORIZED on an unpaid order', () => {
    expect(getWebhookAction({ order: openOrder, status: 'AUTHORIZED' })).toEqual({
      type: 'mirror',
      paymentStatus: 'AUTHORIZED',
    });
  });

  it('ignores PENDING', () => {
    const authorizedOrder = { ...openOrder, paymentStatus: 'AUTHORIZED' } as const;

    expect(getWebhookAction({ order: authorizedOrder, status: 'PENDING' })).toEqual({ type: 'none' });
  });

  it.each(['PENDING', 'AUTHORIZED', 'ABANDONED'] as const)('never moves a paid order back to %s', (status) => {
    expect(getWebhookAction({ order: paidOrder, status })).toEqual({ type: 'none' });
  });

  it.each(['VOIDED', 'REFUNDED'] as const)('ignores a PAID that arrives after %s on a paid order', (paymentStatus) => {
    expect(getWebhookAction({ order: { ...paidOrder, paymentStatus }, status: 'PAID' })).toEqual({ type: 'none' });
  });

  it.each([
    ['REFUNDED', openOrder, { type: 'mirror', paymentStatus: 'REFUNDED' }],
    ['PARTIALLY_REFUNDED', openOrder, { type: 'mirror', paymentStatus: 'PARTIALLY_REFUNDED' }],
    ['AUTHORIZED', releasedOrder, { type: 'mirror', paymentStatus: 'AUTHORIZED' }],
    ['VOIDED', releasedOrder, { type: 'mirror', paymentStatus: 'VOIDED' }],
    ['PENDING', releasedOrder, { type: 'none' }],
  ] as const)('handles %s on an unpaid order %#', (status, order, action) => {
    expect(getWebhookAction({ order, status })).toEqual(action);
  });

  it('marks an authorized order paid on PAID', () => {
    const authorizedOrder = { ...openOrder, paymentStatus: 'AUTHORIZED' } as const;

    expect(getWebhookAction({ order: authorizedOrder, status: 'PAID' })).toEqual({ type: 'mark-paid' });
  });

  it('treats PAID after ABANDONED as a late payment', () => {
    expect(getWebhookAction({ order: abandonedOrder, status: 'PAID' })).toEqual({ type: 'late-payment' });
  });
});

describe('getWebhookOrderMismatch', () => {
  const order = { montonioOrderUuid: 'montonio-uuid', total: 83.49 };
  const token = { uuid: 'montonio-uuid', grandTotal: 83.49, currency: 'EUR' };

  it('accepts a token that matches the order', () => {
    expect(getWebhookOrderMismatch({ token, order })).toBeNull();
  });

  it.each([
    ['UUID', { ...token, uuid: 'other-uuid' }],
    ['AMOUNT', { ...token, grandTotal: 1 }],
    ['CURRENCY', { ...token, currency: 'USD' }],
  ] as const)('reports a %s mismatch', (reason, mismatchedToken) => {
    expect(getWebhookOrderMismatch({ token: mismatchedToken, order })).toBe(reason);
  });

  it('reports a missing UUID while checkout has not stored the Montonio order yet', () => {
    expect(getWebhookOrderMismatch({ token, order: { ...order, montonioOrderUuid: null } })).toBe('UUID_MISSING');
  });

  it('compares amounts in cents', () => {
    expect(
      getWebhookOrderMismatch({ token: { ...token, grandTotal: 0.3 }, order: { ...order, total: 0.1 + 0.2 } }),
    ).toBeNull();
  });
});
