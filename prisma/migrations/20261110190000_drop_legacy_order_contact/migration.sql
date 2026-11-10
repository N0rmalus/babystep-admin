-- Montonio checkout, contract step (#90): drop the legacy Stripe contact strings.

ALTER TABLE "Order"
DROP COLUMN "phone",
DROP COLUMN "address";
