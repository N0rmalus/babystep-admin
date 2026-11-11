-- Store the Montonio payment link so the storefront can resume a pending payment. Additive only.

ALTER TABLE "Order" ADD COLUMN "paymentUrl" TEXT;
