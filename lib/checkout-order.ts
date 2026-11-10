import 'server-only';

import type { Carrier } from '@prisma/client';

import {
  type CheckoutItem,
  type CheckoutTotals,
  getStockChangedItems,
  type StockChangedItem,
  type ValidCheckoutFields,
} from '@/lib/checkout-rules';
import type { CourierCarrier, LockerCarrier } from '@/lib/delivery-config';
import type { Bank, PickupPoint } from '@/lib/montonio-client';
import prismadb from '@/lib/prismadb';
import { releaseExpiredOrders, reserveStock, StockChangedError } from '@/lib/reservation';
import { getReservationExpiresAt } from '@/lib/reservation-config';
import { reserveWithRetry } from '@/lib/reservation-retry';
import { getVariantStockCounts } from '@/queries/get-variant-stock-counts';

type Fields = ValidCheckoutFields<PickupPoint, Bank>;

type ReservedOrder = { id: string; number: number };

type CreateReservedOrderOptions = {
  storeId: string;
  items: CheckoutItem[];
  totals: CheckoutTotals;
  fields: Fields;
  now?: Date;
};

const CARRIERS = {
  omniva: 'OMNIVA',
  unisend: 'UNISEND',
  smartposti: 'SMARTPOSTI',
} satisfies Record<LockerCarrier | CourierCarrier, Carrier>;

const COURIER_CARRIER = 'smartposti' satisfies CourierCarrier;

export const createReservedOrder = async ({
  storeId,
  items,
  totals,
  fields,
  now = new Date(),
}: CreateReservedOrderOptions) => {
  const variantIds = items.map(({ variantId }) => variantId);

  await releaseExpiredOrders({ variantIds, now });

  return reserveWithRetry<ReservedOrder, StockChangedItem>({
    reserve: () => reserveAndCreateOrder({ storeId, items, totals, fields, now }),
    getShortages: async () => {
      const stockCounts = await getVariantStockCounts(variantIds);

      return getStockChangedItems({ items, stockCounts });
    },
  });
};

const reserveAndCreateOrder = async ({ storeId, items, totals, fields, now }: Required<CreateReservedOrderOptions>) => {
  try {
    const order = await prismadb.$transaction(async (tx) => {
      const { nextOrderNumber } = await tx.store.update({
        where: { id: storeId },
        data: { nextOrderNumber: { increment: 1 } },
        select: { nextOrderNumber: true },
      });

      await reserveStock({ tx, lines: items });

      return tx.order.create({
        data: {
          storeId,
          number: nextOrderNumber - 1,
          ...getContactData(fields.contact),
          ...getDeliveryData(fields.delivery),
          ...getPaymentData(fields.payment),
          ...totals,
          expiresAt: getReservationExpiresAt(now),
          orderItems: { create: items.map(getOrderItemData) },
        },
        select: { id: true, number: true },
      });
    });

    return { status: 'reserved', order } as const;
  } catch (error) {
    if (!(error instanceof StockChangedError)) {
      throw error;
    }

    return { status: 'short' } as const;
  }
};

const getOrderItemData = ({
  productId,
  variantId,
  quantity,
  productName,
  sku,
  options,
  unitPrice,
  regularUnitPrice,
}: CheckoutItem) => ({ productId, variantId, quantity, productName, sku, options, unitPrice, regularUnitPrice });

const getContactData = ({ firstName, lastName, email, phone }: Fields['contact']) => ({
  firstName,
  lastName,
  email,
  phoneNumber: phone,
});

const getDeliveryData = (delivery: Fields['delivery']) => {
  if (delivery.method === 'locker') {
    const { id, carrier, name, address, city } = delivery.pickupPoint;

    return {
      deliveryMethod: 'LOCKER',
      carrier: CARRIERS[carrier],
      pickupPointId: id,
      pickupPointName: name,
      pickupPointAddress: address,
      pickupPointCity: city,
    } as const;
  }

  const { street, apartment, city, postalCode } = delivery.address;

  return {
    deliveryMethod: 'COURIER',
    carrier: CARRIERS[COURIER_CARRIER],
    street,
    apartment: apartment ?? null,
    city,
    postalCode,
  } as const;
};

const getPaymentData = (payment: Fields['payment']) => {
  if (payment.method === 'card') {
    return { paymentMethod: 'CARD' } as const;
  }

  return { paymentMethod: 'BANK', bankCode: payment.bank.code, bankName: payment.bank.name } as const;
};
