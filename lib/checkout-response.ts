import { NextResponse } from 'next/server';

import type { FieldError, InvalidItem, StockChangedItem } from '@/lib/checkout-rules';
import { corsHeaders } from '@/lib/cors';

export type CheckoutError =
  | { code: 'INVALID_REQUEST' }
  | { code: 'INVALID_ITEMS'; items: InvalidItem[] }
  | { code: 'INVALID_FIELDS'; fields: FieldError[] }
  | { code: 'STOCK_CHANGED'; items: StockChangedItem[] }
  | { code: 'PAYMENT_UNAVAILABLE' }
  | { code: 'INTERNAL' };

type CheckoutErrorCode = CheckoutError['code'];

const CHECKOUT_ERRORS = {
  INVALID_REQUEST: { status: 400, message: 'Neteisinga užklausa. Atnaujink puslapį ir bandyk dar kartą.' },
  INVALID_ITEMS: { status: 400, message: 'Kai kurių prekių nebegalima įsigyti. Peržiūrėk krepšelį.' },
  INVALID_FIELDS: { status: 400, message: 'Patikrink pažymėtus laukus.' },
  STOCK_CHANGED: { status: 409, message: 'Kai kurių prekių likutis pasikeitė. Peržiūrėk kiekius ir bandyk dar kartą.' },
  PAYMENT_UNAVAILABLE: { status: 502, message: 'Nepavyko sukurti mokėjimo. Bandyk dar kartą po kelių minučių.' },
  INTERNAL: { status: 500, message: 'Įvyko klaida. Bandyk dar kartą vėliau.' },
} satisfies Record<CheckoutErrorCode, { status: number; message: string }>;

const CREATED_STATUS = 201;

export const checkoutErrorResponse = (error: CheckoutError): NextResponse => {
  const { status, message } = CHECKOUT_ERRORS[error.code];

  return NextResponse.json({ ...error, message }, { status, headers: corsHeaders });
};

export const checkoutCreatedResponse = (body: { orderId: string; paymentUrl: string }): NextResponse =>
  NextResponse.json(body, { status: CREATED_STATUS, headers: corsHeaders });
