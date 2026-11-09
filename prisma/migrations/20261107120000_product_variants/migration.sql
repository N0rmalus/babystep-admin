-- Product variants, step 1 (#64, ADR 0001).
-- Schema changes and data migration in one transaction.

BEGIN;

-- 1. Enums ------------------------------------------------------------------

CREATE TYPE "OptionDisplayType" AS ENUM ('CHIPS', 'SWATCH');
CREATE TYPE "OptionGroupRole" AS ENUM ('NONE', 'SIZE');

-- 2. New tables -------------------------------------------------------------

CREATE TABLE "OptionGroup" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "displayType" "OptionDisplayType" NOT NULL DEFAULT 'CHIPS',
    "role" "OptionGroupRole" NOT NULL DEFAULT 'NONE',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptionGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OptionValue" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "hex" TEXT,
    "ageFromMonths" INTEGER,
    "ageToMonths" INTEGER,
    "heightFromCm" INTEGER,
    "heightToCm" INTEGER,
    "weightFromKg" DECIMAL(65,30),
    "weightToKg" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptionValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductOptionGroup" (
    "productId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductOptionGroup_pkey" PRIMARY KEY ("productId","groupId")
);

CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT,
    "stockCount" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(65,30),
    "salePrice" DECIMAL(65,30),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "combinationKey" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductVariantOptionValue" (
    "variantId" TEXT NOT NULL,
    "optionValueId" TEXT NOT NULL,

    CONSTRAINT "ProductVariantOptionValue_pkey" PRIMARY KEY ("variantId","optionValueId")
);

CREATE INDEX "OptionGroup_storeId_idx" ON "OptionGroup"("storeId");
CREATE INDEX "OptionGroup_productId_idx" ON "OptionGroup"("productId");
CREATE INDEX "OptionValue_groupId_idx" ON "OptionValue"("groupId");
CREATE INDEX "ProductOptionGroup_productId_idx" ON "ProductOptionGroup"("productId");
CREATE INDEX "ProductOptionGroup_groupId_idx" ON "ProductOptionGroup"("groupId");
CREATE INDEX "ProductVariant_storeId_idx" ON "ProductVariant"("storeId");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE UNIQUE INDEX "ProductVariant_storeId_sku_key" ON "ProductVariant"("storeId", "sku");
CREATE UNIQUE INDEX "ProductVariant_productId_combinationKey_key" ON "ProductVariant"("productId", "combinationKey");
CREATE INDEX "ProductVariantOptionValue_variantId_idx" ON "ProductVariantOptionValue"("variantId");
CREATE INDEX "ProductVariantOptionValue_optionValueId_idx" ON "ProductVariantOptionValue"("optionValueId");

-- 3. Image: position + option value tag --------------------------------------

ALTER TABLE "Image"
ADD COLUMN "optionValueId" TEXT,
ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Image_optionValueId_idx" ON "Image"("optionValueId");

-- Keep the current upload order as the explicit position.
UPDATE "Image" AS i
SET "position" = ranked."rowNumber" - 1
FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "productId" ORDER BY "createdAt", "id") AS "rowNumber"
    FROM "Image"
) AS ranked
WHERE i."id" = ranked."id";

-- 4. Default variant per product, copying amountInStock ----------------------

INSERT INTO "ProductVariant" ("id", "storeId", "productId", "sku", "stockCount", "combinationKey", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."storeId", p."id", NULL, p."amountInStock", '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Product" AS p;

-- 5. OrderItem: quantity, variant link, snapshot, required prices ------------

ALTER TABLE "OrderItem"
ADD COLUMN "options" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "productName" TEXT,
ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "regularUnitPrice" DECIMAL(65,30),
ADD COLUMN "sku" TEXT,
ADD COLUMN "variantId" TEXT;

CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- Merge rows into one per (order, product). The surviving row is the lowest id.
-- A legacy null unitPrice becomes the product's current effective price
-- (same rules as getProductSaleStatus); regularUnitPrice is the current regular price.
WITH grouped AS (
    SELECT
        "orderId",
        "productId",
        MIN("id") AS "keepId",
        COUNT(*)::int AS "quantity",
        MAX("unitPrice") AS "unitPrice"
    FROM "OrderItem"
    GROUP BY "orderId", "productId"
)
UPDATE "OrderItem" AS oi
SET
    "quantity" = g."quantity",
    "unitPrice" = COALESCE(
        g."unitPrice",
        CASE
            WHEN p."salePrice" IS NOT NULL
                AND p."salePrice" > 0
                AND p."salePrice" < p."price"
                AND (p."saleStartsAt" IS NULL OR p."saleStartsAt" <= CURRENT_TIMESTAMP)
                AND (p."saleEndsAt" IS NULL OR p."saleEndsAt" >= CURRENT_TIMESTAMP)
            THEN p."salePrice"
            ELSE p."price"
        END
    ),
    "regularUnitPrice" = p."price",
    "productName" = p."name",
    "sku" = v."sku",
    "options" = '[]'::jsonb,
    "variantId" = v."id"
FROM grouped AS g
JOIN "Product" AS p ON p."id" = g."productId"
JOIN "ProductVariant" AS v ON v."productId" = p."id" AND v."combinationKey" = ''
WHERE oi."id" = g."keepId";

DELETE FROM "OrderItem" AS oi
WHERE EXISTS (
    SELECT 1
    FROM "OrderItem" AS other
    WHERE other."orderId" = oi."orderId"
        AND other."productId" = oi."productId"
        AND other."id" < oi."id"
);

-- Fails the whole migration if any row could not be filled (e.g. an orphaned product).
ALTER TABLE "OrderItem"
ALTER COLUMN "quantity" DROP DEFAULT,
ALTER COLUMN "productName" SET NOT NULL,
ALTER COLUMN "regularUnitPrice" SET NOT NULL,
ALTER COLUMN "variantId" SET NOT NULL,
ALTER COLUMN "unitPrice" SET NOT NULL;

-- 6. Store-level groups Dydis and Spalva, with no values ---------------------

INSERT INTO "OptionGroup" ("id", "storeId", "productId", "name", "displayType", "role", "position", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", NULL, 'Dydis', 'CHIPS', 'SIZE', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Store" AS s;

INSERT INTO "OptionGroup" ("id", "storeId", "productId", "name", "displayType", "role", "position", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", NULL, 'Spalva', 'SWATCH', 'NONE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Store" AS s;

-- 7. Stock now lives only on variants -----------------------------------------

ALTER TABLE "Product" DROP COLUMN "amountInStock";

COMMIT;
