-- Montonio checkout, expand step (#78). Nothing is removed.

BEGIN;

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'VOIDED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'ABANDONED', 'AUTHORIZED');
CREATE TYPE "PaymentMethod" AS ENUM ('BANK', 'CARD');
CREATE TYPE "DeliveryMethod" AS ENUM ('LOCKER', 'COURIER');
CREATE TYPE "Carrier" AS ENUM ('OMNIVA', 'UNISEND', 'SMARTPOSTI');
CREATE TYPE "ReviewReason" AS ENUM ('LATE_PAYMENT_OUT_OF_STOCK', 'VOIDED_AFTER_PAID');

ALTER TABLE "Store" ADD COLUMN "nextOrderNumber" INTEGER NOT NULL DEFAULT 10001;

ALTER TABLE "Order"
ADD COLUMN "number" INTEGER,
ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "montonioOrderUuid" TEXT,
ADD COLUMN "paymentMethod" "PaymentMethod",
ADD COLUMN "bankCode" TEXT,
ADD COLUMN "bankName" TEXT,
ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "email" TEXT NOT NULL DEFAULT '',
ADD COLUMN "phoneNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN "deliveryMethod" "DeliveryMethod",
ADD COLUMN "carrier" "Carrier",
ADD COLUMN "pickupPointId" TEXT,
ADD COLUMN "pickupPointName" TEXT,
ADD COLUMN "pickupPointAddress" TEXT,
ADD COLUMN "pickupPointCity" TEXT,
ADD COLUMN "street" TEXT,
ADD COLUMN "apartment" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "postalCode" TEXT,
ADD COLUMN "itemsTotal" DECIMAL(65,30),
ADD COLUMN "shippingPrice" DECIMAL(65,30),
ADD COLUMN "total" DECIMAL(65,30),
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "stockReleasedAt" TIMESTAMP(3),
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reviewReason" "ReviewReason";

-- Backfill: number per store from 10001 by creation time
UPDATE "Order" o
SET "number" = n."number"
FROM (
    SELECT "id", 10000 + ROW_NUMBER() OVER (PARTITION BY "storeId" ORDER BY "createdAt", "id") AS "number"
    FROM "Order"
) n
WHERE o."id" = n."id";

-- Backfill: totals from the order items, no shipping was charged
UPDATE "Order" o
SET "itemsTotal" = COALESCE(t."sum", 0),
    "shippingPrice" = 0,
    "total" = COALESCE(t."sum", 0)
FROM (
    SELECT o2."id", SUM(i."unitPrice" * i."quantity") AS "sum"
    FROM "Order" o2
    LEFT JOIN "OrderItem" i ON i."orderId" = o2."id"
    GROUP BY o2."id"
) t
WHERE o."id" = t."id";

-- Backfill: paid legacy orders
UPDATE "Order"
SET "paymentStatus" = 'PAID',
    "paidAt" = "updatedAt"
WHERE "isPaid" = true;

-- Backfill: legacy unpaid orders never decremented stock, so they count as released
UPDATE "Order"
SET "expiresAt" = "createdAt",
    "stockReleasedAt" = "updatedAt"
WHERE "isPaid" = false;

UPDATE "Store" s
SET "nextOrderNumber" = COALESCE(
    (SELECT MAX(o."number") + 1 FROM "Order" o WHERE o."storeId" = s."id"),
    10001
);

ALTER TABLE "Order"
ALTER COLUMN "number" SET NOT NULL,
ALTER COLUMN "itemsTotal" SET NOT NULL,
ALTER COLUMN "shippingPrice" SET NOT NULL,
ALTER COLUMN "total" SET NOT NULL;

CREATE UNIQUE INDEX "Order_storeId_number_key" ON "Order"("storeId", "number");
CREATE INDEX "Order_stockReleasedAt_expiresAt_idx" ON "Order"("stockReleasedAt", "expiresAt");

COMMIT;
