import type { PaymentStatus } from '@prisma/client';

import {
  getWebhookAction,
  getWebhookOrderMismatch,
  type WebhookAction,
  type WebhookOrderMismatch,
} from '@/lib/checkout-rules';
import type { VerifyOrderTokenResult } from '@/lib/montonio-client';

export type SyncOrder = {
  id: string;
  isPaid: boolean;
  paymentStatus: PaymentStatus;
  stockReleasedAt: Date | null;
  montonioOrderUuid: string | null;
  total: number;
};

export type OrderTokenRejection =
  Exclude<WebhookOrderMismatch, 'UUID_MISSING'> | 'FOREIGN_ACCESS_KEY' | 'ORDER_NOT_FOUND' | 'ORDER_ID';

type SyncOrderTokenOptions = {
  token: string;
  // Set when the caller already knows which order the token must be for (the return URL carries the order ID)
  expectedOrderId?: string;
  verifyOrderToken: (token: string) => Promise<VerifyOrderTokenResult>;
  getOrder: (orderId: string) => Promise<SyncOrder | null>;
  applyAction: (options: { order: SyncOrder; action: WebhookAction }) => Promise<void>;
};

export type SyncOrderTokenResult =
  | { status: 'applied'; orderId: string; action: WebhookAction }
  | { status: 'invalid' }
  | { status: 'rejected'; reason: OrderTokenRejection; orderId?: string }
  | { status: 'uuid-missing'; orderId: string };

// Shared by the Montonio webhook and the return-URL sync, so both verify a token the same way.
export const syncOrderToken = async ({
  token,
  expectedOrderId,
  verifyOrderToken,
  getOrder,
  applyAction,
}: SyncOrderTokenOptions): Promise<SyncOrderTokenResult> => {
  const verified = await verifyOrderToken(token);

  if (verified.status === 'invalid') {
    return { status: 'invalid' };
  }

  if (verified.status === 'foreign-access-key') {
    return { status: 'rejected', reason: 'FOREIGN_ACCESS_KEY' };
  }

  const { order: tokenOrder } = verified;
  const orderId = tokenOrder.merchantReference;

  if (expectedOrderId !== undefined && orderId !== expectedOrderId) {
    return { status: 'rejected', reason: 'ORDER_ID', orderId };
  }

  const order = await getOrder(orderId);

  if (!order) {
    return { status: 'rejected', reason: 'ORDER_NOT_FOUND', orderId };
  }

  const mismatch = getWebhookOrderMismatch({ token: tokenOrder, order });

  if (mismatch === 'UUID_MISSING') {
    return { status: 'uuid-missing', orderId };
  }

  if (mismatch) {
    return { status: 'rejected', reason: mismatch, orderId };
  }

  const action = getWebhookAction({ order, status: tokenOrder.paymentStatus });
  await applyAction({ order, action });

  return { status: 'applied', orderId, action };
};
