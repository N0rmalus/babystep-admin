export type LockerCarrier = 'omniva' | 'unisend';
export type CourierCarrier = 'smartposti';

export type DeliveryOption =
  | { method: 'locker'; price: number; carriers: LockerCarrier[] }
  | { method: 'courier'; price: number; carriers: CourierCarrier[] };

export type DeliveryMethod = DeliveryOption['method'];

type DeliveryConfig = {
  options: DeliveryOption[];
  freeShippingThreshold: number;
};

export const DELIVERY_CONFIG = {
  options: [
    { method: 'locker', price: 3.49, carriers: ['omniva', 'unisend'] },
    { method: 'courier', price: 6.49, carriers: ['smartposti'] },
  ],
  freeShippingThreshold: 80,
} satisfies DeliveryConfig;

type ShippingPriceOptions = {
  method: DeliveryMethod;
  itemsTotal: number;
};

export const getShippingPrice = ({ method, itemsTotal }: ShippingPriceOptions): number => {
  if (itemsTotal >= DELIVERY_CONFIG.freeShippingThreshold) {
    return 0;
  }

  const option = DELIVERY_CONFIG.options.find((deliveryOption) => deliveryOption.method === method);

  if (!option) {
    throw new Error(`Unknown delivery method: ${method}`);
  }

  return option.price;
};
