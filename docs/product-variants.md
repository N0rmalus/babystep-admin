# Product variants

Decisions from the planning session of 2026-11-07. This is the source for `/to-prd`: one PRD per step in "Build order". Terms follow `GLOSSARY.md`. Hard-to-reverse choices are in `docs/adr/0001-every-product-has-a-variant.md` and `docs/adr/0002-reserve-stock-by-decrementing.md`.

Related: `TODO.md` ("Product variants"), `docs/montonio-research.md` ("Decisions"), `../babystep-store/TODO.md` ("Product variants").

## Option groups and values

- **Two kinds of option group:**
  - **Store-level groups** are managed on their own admin page, "Savybės", and shared by all products. Start with **Dydis** (chips) and **Spalva** (swatches), with no values seeded.
  - **Product groups** belong to one product, e.g. Stilius.
- A product uses **at most 3** option groups.
- **Values of store-level groups are always store-level.** If a product needs a size that doesn't exist, it is added to Dydis from the product form ("+ Naujas dydis"). Products never add private values to a store-level group.
- **Display type** is set on the group: `CHIPS` (text pills) or `SWATCH` (color circle; every value needs a hex color). There is no image-thumbnail type.
- Values are ordered within their group. A product shows only the values its active variants use, in the group's order.
- A store-level value that variants use can't be deleted, only renamed. Order snapshots keep the old text.
- **Dydis values** can store an optional age range (`ageFromMonths`/`ageToMonths`), height range (cm) and weight range (kg). Non-age sizes like "S" or "70 cm" leave the age range empty.

## Variants

- **Every product has at least one variant** (ADR 0001). A product without options has exactly one **default variant** with no option values. The API hides the default variant. `Product.amountInStock` goes away.
- A variant has:
  - one value from each of the product's option groups
  - an optional SKU, unique per store when set
  - its own available stock
  - an optional price override
  - `isArchived`
- **Sparse combinations are allowed.** "Generate combinations" creates every combination, and the owner deletes the ones that don't exist. The server enforces that each combination exists once per product.
- **Price inheritance:** a variant either inherits **both** the product's `price` and `salePrice`, or overrides **both**: its own `price` plus an optional own `salePrice`, where null means not on sale. The sale window (`saleStartsAt`/`saleEndsAt`) stays on the product. `getProductPricing` receives the resolved pair and stays the only judge of whether a sale is active.
- **All variant price changes go through one write path,** so price history (see "Later") can be added in one place.
- **Archived variants** are left out of the public API entirely. They don't count toward the price range, the sale badge or catalog filters. If all of a product's variants are archived, the product is **unavailable** and treated like a sold-out product, so the storefront never shows an empty picker.
- A product is **sold out** when every active variant has 0 available stock. There's **no automatic archiving** of sold-out products: they stay listed with the "Išparduota" card. Archiving is only done by hand.

## Images

- The product keeps one image pool, ordered in the admin. Each image can be **tagged with one option value** (e.g. Spalva = Avižų).
- On the product page, the gallery for the selected variant shows images tagged with its values first, then the untagged ones.
- **Product cards always use the product's first image** (by admin order), for products with and without variants. The card image never switches when a variant sells out.
- Image tags are only in the single-product response.

## Specifications and size guide

Built as their own feature (build step 4), with this shape fixed now:

- Specifications are ordered label/value rows per product.
- A row can be marked **"varies by <group>"** (one group per row). It then has one value per value of that group and falls back to the product-level value.
- The storefront shows the value for the selected variant's options, and the product-level value before a choice is made.
- **Size guide ("Kaip išsirinkti dydį?"):**
  - The Ūgis and Svoris columns come from the Dydis values' height and weight ranges.
  - Product columns such as Ilgis come from specification rows that vary by Dydis.
  - The table lists only the product's own sizes.
  - The link shows only when the product uses Dydis and at least one column has data.
  - There's no separate size-guide model.

## Age picker

Built as part of "Product age range" (build step 5), with this rule fixed now:

- A product with age-based Dydis values matches an age group when it has an in-stock variant whose size overlaps the group. Its card in the age rail links to that size, or preselects it.
- A product without age-based sizes falls back to the product-level `ageFromMonths`/`ageToMonths` from "Product age range".

## Stock and reservation

Built in the Montonio checkout step (build step 3):

- **A variant's stock column is its available stock** ("Laisva"). Checkout reserves stock by decrementing that column with a `stock >= quantity` guard in the transaction that creates the order (ADR 0002). The `PAID` webhook only marks the order paid and doesn't decrement.
- **Order fields:** `paymentStatus` mirrors Montonio's statuses. `expiresAt` comes from the 30-minute reservation in `montonio-research.md` "Decisions". `stockReleasedAt` records when the reservation was put back.
- **Release rule, the same everywhere:** the `ABANDONED` webhook, or about **10 minutes after `expiresAt`**. That grace period is one shared constant.
  - Releases only touch orders that aren't `PAID`.
  - Stock is added back only if the `updateMany` that sets `stockReleasedAt` (where it is null and the order isn't paid) changed exactly one row. Both steps run in the same transaction.
- **Release paths:**
  - **`ABANDONED` webhook.**
  - **Checkout:** before reserving, it releases expired orders that hold the same variants.
  - **Cleanup route:** `POST /api/cron/release-reservations`.
    - It sits outside `[storeId]` and covers all stores.
    - Auth: `Authorization: Bearer ${CRON_SECRET}` is preferred, with `?token=` as a fallback if the host's cron can only call a plain URL. Anything else gets a 401. The secret must be long and random, because a query token ends up in access logs.
    - Selection: orders with `stockReleasedAt` null, not paid and past the grace period, oldest first, at most 50 per call, each in its own short transaction.
    - Index on `Order(stockReleasedAt, expiresAt)`.
    - Returns `{ releasedCount }`.
    - A cron job on the host calls it every 5 minutes (UTC).
- **Late `PAID` after release:** the webhook tries the guarded decrement again. On success, it's a normal paid order. On failure, the order is marked paid and flagged `LATE_PAYMENT_OUT_OF_STOCK`. The webhook returns 200 in both cases.
- An order released without an `ABANDONED` webhook keeps `paymentStatus: PENDING`. The admin shows it as "Nebaigtas" based on `stockReleasedAt`.

## Review flags

- **Order fields:** `needsReview` and `reviewReason` (`LATE_PAYMENT_OUT_OF_STOCK`, `VOIDED_AFTER_PAID`).
- **Admin:** a badge and a "Reikia peržiūrėti" filter in the orders table. "Pažymėti kaip sutvarkytą" clears the flag.
- **Sentry:** each flagged order is logged as a warning with the order ID and reason, so alerts work before an email provider exists.
- **Email:** sent to `ADMIN_NOTIFICATION_EMAIL` through the transactional email provider once it's chosen (it comes with the order confirmation email work). A failed email never fails the webhook.

## Checkout contract

Built in the Montonio checkout step (build step 3):

- **Request:** line items `{ productId, variantId?, quantity }` plus delivery, contact and payment method, as in `montonio-research.md` "Decisions". Leaving out `variantId` means a product without variants.
- **Bad requests:** the whole request is rejected, with no partial orders.
- **409 `{ code: 'STOCK_CHANGED', items: [{ productId, variantId?, availableCount }] }`:**
  - The storefront caps or marks those cart lines and shows a toast.
  - The customer stays on checkout and has to click pay again. Never continue to payment automatically with changed quantities.
- **400 `{ code: 'INVALID_ITEMS', items: [{ productId, variantId?, reason }] }`:** `reason` is one of:
  - `NOT_FOUND`
  - `UNAVAILABLE`: archived, or all its variants archived
  - `VARIANT_REQUIRED`: it has variants but no `variantId` was sent
  - `VARIANT_NOT_ALLOWED`: a `variantId` was sent for a product without variants
- These replace `invalidProductIds` / `insufficientStockItems`. The Montonio work defines the code for delivery and contact field errors.

## Orders

- **`OrderItem` fields:**
  - `quantity`: one row per product and variant, not one per unit
  - `variantId`
  - snapshot fields `productName`, `sku` and `options` (JSON `[{ "name": "Dydis", "value": "0–6 mėn." }]`)
  - `unitPrice`, required
  - `regularUnitPrice`
- The links to product and variant may break later. The snapshot is what gets shown.
- A variant that has orders is archived, never deleted.
- **Variant label:**
  - One admin helper builds it from the snapshot, with group names, `·` as the separator and the groups in order: `Muslino merliukas „Meškiukai“ – Dydis: 0–6 mėn. · Spalva: Šalavijų`.
  - The same helper is used for Montonio line items, the confirmation email and the admin orders table. The API returns the label for order items.
  - A default-variant item has no label: just the product name, with no " – ".

## Public API

- **The list and single-product responses share one product shape:**
  - `options: [{ id, name, displayType, values: [{ id, label, hex?, ageFromMonths?, ageToMonths?, … }] }]`, holding only the values the product's active variants use, in group order.
  - `variants: [{ id, sku, label, optionValueIds, price, salePrice, stockCount }]`, with active variants only.
    - `price` and `salePrice` are **already resolved** (inheritance applied).
    - `label` is display text (`Dydis: 0–6 mėn. · Spalva: Šalavijų`). `optionValueIds` is the structured form the picker needs.
  - **A product without variants** has `options: []` and `variants: []`, and its product-level `price`, `salePrice` and `stockCount` come from its default variant.
  - `saleStartsAt`/`saleEndsAt` stay on the product.
- **`stockCount` is the variant's stock column,** which already excludes active reservations. `amountInStock` is renamed to `stockCount`.
- **The single-product response** also has the image tags and the specifications.
- The storefront shows `${name} – ${label}` and never formats options itself.

## Catalog (API)

For products with variants:

- **Price sort** uses the lowest effective price.
- **The price filter** matches when any active variant's effective price is in range.
- **The price-range slider** spans all active variant prices.
- **"In stock"** means any active variant has stock above 0.
- **`akcijos` and the sale badge** mean any active variant has an active sale.

## Storefront

- **One generic option picker** replaces `size-picker`, `color-picker` and the mock state in `product-purchase-provider`. It's used on the product page and in the quick view, and the mobile buy bar shows the selection.
  - A group with one value is auto-selected. Otherwise nothing is preselected.
  - The buy button reads "Pasirinkti savybes" and is disabled until a full combination is chosen.
  - After each choice, values in other groups with no buyable combination are crossed out. Combinations that don't exist and sold-out ones both show as unavailable. A picked sold-out combination shows "Išparduota".
  - The selection is mirrored to the URL as `?variantId=` with `router.replace`.
  - **Price before a full selection:** the range of effective prices, with no strikethrough, or one price when they're all equal. **After a full selection:** the variant's effective price, with its regular price struck through when on sale.
- **Product cards** for products with variants:
  - The button reads "Pasirinkti savybes" instead of "Į krepšelį" and opens the quick view on desktop, or the product page on mobile.
  - The price is the range of effective prices, or one price when they're all equal.
  - The badge shows "-X%" only when every variant has the same discount, and "iki -X%" when discounts differ or only some variants are on sale.
  - The image is the product's first image.
- **Cart:**
  - Lines are keyed by `productId` + `variantId`. The storage version goes up, and `migrate` keeps existing lines.
  - A line shows `name – label`, and its quantity is capped at the variant's `stockCount`.
  - **A line without `variantId` for a product that now has variants:** a "Pasirink savybes" prompt instead of picking an option for the customer. Checkout is blocked until an option is chosen.
  - **A line whose variant is no longer available:** shown as unavailable with "Šis pasirinkimas nebegalimas", a link to the product page and a remove button. Checkout is blocked until the line is removed.
  - A deleted product shows as missing, as today.
- **Wishlist:**
  - It stays per product.
  - Products with variants get "Pasirinkti savybes" instead of "Į krepšelį".
  - "Viską į krepšelį" adds only products without variants and lists the ones that need a choice.

## Admin

- **The Savybės page:** store-level groups, their values in order, hex colors for swatches, and the Dydis fields (age, height, weight).
- **The variant editor in the product form:**
  - Choose up to 3 groups (store-level, or a new product group), pick values, then "Generate combinations". It creates missing combinations and leaves existing ones alone. Delete combinations that don't exist.
  - Table columns: SKU, **Laisva** (editable, with the hint "Įveskite laisvą kiekį, be rezervuotų"), **Rezervuota** (read-only: the sum of quantities in `PENDING` orders whose `stockReleasedAt` is empty), **Viso** (read-only: Laisva + Rezervuota), price override and sale price override.
  - **Bulk edit:** a "Taikyti visiems" row sets Laisva, price or sale price on all rows or on the ticked ones. Quick selection by value (e.g. "Spalva: Šalavijų", "Dydis: 0–6 mėn.") ticks the matching rows. Bulk changes only fill the fields, and nothing is saved until Save. There's no CSV import.
  - **Editing after variants exist:**
    - Adding a value creates its combinations on "Generate".
    - Removing a value archives the variants that use it if they have orders, and deletes them otherwise.
    - Adding or removing a whole group replaces all variants after a confirmation. Variants with orders are archived.
  - A product without options shows the same stock fields and SKU for its default variant, with no variant table.
- **Image uploader:** each image can be tagged with one option value.
- **Orders table:** variant labels on items, the review-flag badge and filter, and "Nebaigtas" for orders whose stock was released.

## Data migration

- **One Prisma migration, on the `dev` branch only.** It:
  - creates a default variant per product, copying `amountInStock`
  - merges `OrderItem` rows into one row per product with a `quantity`, filling the snapshot from the current product
  - drops `Product.amountInStock`
  - seeds the store-level groups Dydis and Spalva with no values
- The owner checks that the admin and storefront still work before it touches `prod`.
- **Real products and variants are entered by hand** in the new admin. On switch-over day, the owner updates stock numbers from WooCommerce. There's no importer.

## Later

- **Price history for discount rules (Omnibus):**
  - Built **before launch**, so history starts recording early.
  - It's recorded per variant, which covers products without variants through their default variant.
  - The API returns a reference price per variant, and `getProductPricing` uses it for the discount.
  - Until 30 days of history exist, the current regular price is the reference.

## Build order

Each step gets its own PRD and issues and is committed separately. The owner tests on `dev` after each one.

1. **Admin, variants:**
   - the schema and the data migration, the Savybės page, the variant editor and image tags
   - the public product shape and the catalog rules
   - the order item snapshot fields and the label helper

   Until step 3, checkout keeps `{ productIds }`, resolved to default variants. That's the only stretch that uses the old request, and there's no live traffic.
2. **Storefront, variants:** the option picker, cards and badges, cart lines and their edge cases, and the wishlist. Products with variants can't be checked out until step 3.
3. **Montonio checkout** (admin and storefront): the new line-item request, reservation and release, the cleanup route, review flags and error codes. This also closes the overselling item in `TODO.md`.
4. **Specifications and size guide.**
5. **Age filter** ("Product age range").

## Open details for the PRDs

Not decided in the session:

- How the code recognizes the Dydis group for the size guide and ages (a fixed role on the group, or its name).
- How the quick view gallery follows the selected variant, given that the list response has no image tags: fetch the single product when the quick view opens, or add tags to the list.
- What the admin products table shows as stock for a product with variants (e.g. the total Laisva).
